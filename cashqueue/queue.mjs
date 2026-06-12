export function buildCollectionQueue(invoices, customersById) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = (invoices || [])
    .filter(inv => parseFloat(inv.Balance || 0) > 0)
    .map(inv => {
      const balance = parseFloat(inv.Balance || 0);
      const dueRaw = inv.DueDate || inv.TxnDate;
      const due = dueRaw ? new Date(dueRaw) : today;
      due.setHours(0, 0, 0, 0);
      const daysOverdue = Math.max(0, Math.floor((today - due) / 86400000));
      const customerId = inv.CustomerRef?.value || '';
      const customer = customersById[customerId] || {};
      const email = customer.PrimaryEmailAddr?.Address || customer.PrimaryEmailAddr || '';
      const customerName = inv.CustomerRef?.name || customer.DisplayName || customer.CompanyName || 'Customer';

      let tag = 'likely';
      let tagLabel = 'Current';
      let action = 'Email';
      if (daysOverdue >= 45) {
        tag = 'call';
        tagLabel = `${daysOverdue} days — call recommended`;
        action = 'Call first';
      } else if (daysOverdue >= 21) {
        tag = 'overdue';
        tagLabel = `${daysOverdue} days overdue`;
      } else if (daysOverdue >= 7) {
        tag = 'overdue';
        tagLabel = `${daysOverdue} days overdue`;
        tagLabel = daysOverdue >= 7 ? `Friendly reminder · ${daysOverdue}d` : tagLabel;
      } else if (daysOverdue > 0) {
        tag = 'likely';
        tagLabel = `${daysOverdue} days past due`;
      }

      const priorityScore = balance * (1 + daysOverdue / 30);

      return {
        id: String(inv.Id),
        invoiceId: String(inv.Id),
        invoiceNumber: inv.DocNumber || inv.Id,
        customerId,
        customerName,
        email: typeof email === 'string' ? email : '',
        balance,
        dueDate: dueRaw,
        daysOverdue,
        tag,
        tagLabel,
        action,
        priorityScore
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const totalOverdue = items.reduce((s, i) => s + i.balance, 0);
  return {
    items,
    summary: {
      count: items.length,
      totalOverdue,
      expectedThisWeek: Math.round(totalOverdue * 0.35)
    }
  };
}

export function templateCollectionEmail(item, companyName) {
  const amt = formatMoney(item.balance);
  const inv = item.invoiceNumber;
  const co = companyName || 'Our team';

  let subject;
  let body;

  if (item.daysOverdue >= 45) {
    subject = `Urgent — Invoice #${inv} (${amt}) now ${item.daysOverdue} days past due`;
    body = `Hi ${firstName(item.customerName)},

Invoice #${inv} for ${amt} is now ${item.daysOverdue} days past due. We've sent prior reminders and need to resolve this balance this week.

Please reply today with a payment date, or call me so we can agree on next steps. I'm willing to discuss a short payment plan if that helps.

Thank you,
${co}`;
  } else if (item.daysOverdue >= 21) {
    subject = `Payment timing — Invoice #${inv} (${amt})`;
    body = `Hi ${firstName(item.customerName)},

I'm following up on invoice #${inv} for ${amt}, which was due ${item.daysOverdue} days ago.

Can you confirm when we should expect payment, or if there's an issue we need to resolve on our side?

Thanks,
${co}`;
  } else {
    subject = `Friendly reminder — Invoice #${inv} (${amt})`;
    body = `Hi ${firstName(item.customerName)},

Hope you're doing well. This is a friendly reminder that invoice #${inv} for ${amt}${item.daysOverdue > 0 ? ` is ${item.daysOverdue} days past due` : ' is coming due'}.

If there's anything we can provide (PO, W-9, etc.), let me know. Could you confirm when we should expect payment?

Best,
${co}`;
  }

  return { subject, body };
}

export async function generateCollectionEmail(item, companyName, callAiModel) {
  if (callAiModel) {
    try {
      const ai = await callAiModel({
        system: `You write professional B2B payment reminder emails. Plain text only. No markdown. 3-5 short paragraphs max. Sign off with the company name provided. Match tone: ${item.daysOverdue >= 45 ? 'firm escalation' : item.daysOverdue >= 21 ? 'firm but professional' : 'friendly reminder'}.`,
        messages: [{
          role: 'user',
          content: `Company: ${companyName}
Customer: ${item.customerName}
Invoice #: ${item.invoiceNumber}
Balance: ${formatMoney(item.balance)}
Days overdue: ${item.daysOverdue}

Write subject line on first line as "Subject: ..." then blank line then email body.`
        }],
        maxTokens: 500
      });
      const text = ai.text || '';
      const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
      const subject = subjectMatch ? subjectMatch[1].trim() : templateCollectionEmail(item, companyName).subject;
      const body = text.replace(/^Subject:.*$/im, '').trim();
      if (body.length > 40) return { subject, body, provider: ai.provider };
    } catch {
      /* fall through to template */
    }
  }
  return { ...templateCollectionEmail(item, companyName), provider: 'template' };
}

function firstName(name) {
  const part = String(name || 'there').split(/[\s,]+/)[0];
  return part || 'there';
}

function formatMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
