// ── CLARA AVATAR (face + voice) ──────────────────────────────────────
const CLARA_AVATAR_SRC = '/assets/clara-avatar.png';
let claraVoiceEnabled = true;
let claraSpeech = null;
let claraTypewriterTimer = null;

function initClaraAvatar() {
  const toggle = document.getElementById('clara-voice-toggle');
  if (toggle) {
    toggle.checked = claraVoiceEnabled;
    toggle.addEventListener('change', () => {
      claraVoiceEnabled = toggle.checked;
      if (!claraVoiceEnabled) stopClaraSpeech();
    });
  }
  setClaraState('idle');
}

function setClaraState(state) {
  const panel = document.getElementById('clara-avatar-panel');
  const status = document.getElementById('clara-status-text');
  const caption = document.getElementById('clara-caption');
  if (!panel) return;

  panel.classList.remove('idle', 'thinking', 'speaking');
  panel.classList.add(state || 'idle');

  const labels = {
    idle: 'Ready to help',
    thinking: 'Thinking…',
    speaking: 'Speaking'
  };
  if (status) status.textContent = labels[state] || labels.idle;
  if (caption && state !== 'speaking') caption.textContent = '';
}

function setClaraCaption(text) {
  const caption = document.getElementById('clara-caption');
  if (caption) caption.textContent = text ? text.slice(0, 120) + (text.length > 120 ? '…' : '') : '';
}

function claraMiniAvatarHtml() {
  return `<img src="${CLARA_AVATAR_SRC}" alt="Clara" class="clara-mini-img">`;
}

function stopClaraSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  claraSpeech = null;
}

function pickClaraVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    /female|samantha|victoria|karen|moira|zira|jenny|aria|google us english/i.test(v.name)
  );
  return preferred || voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
}

function speakClara(text) {
  if (!claraVoiceEnabled || !window.speechSynthesis || !text) return;

  stopClaraSpeech();
  const plain = String(text).replace(/\s+/g, ' ').trim();
  if (!plain) return;

  const utter = new SpeechSynthesisUtterance(plain);
  utter.rate = 1.02;
  utter.pitch = 1.05;
  const voice = pickClaraVoice();
  if (voice) utter.voice = voice;

  utter.onstart = () => setClaraState('speaking');
  utter.onend = () => {
    claraSpeech = null;
    if (!claraTypewriterTimer) setClaraState('idle');
  };
  utter.onerror = () => {
    claraSpeech = null;
    if (!claraTypewriterTimer) setClaraState('idle');
  };

  claraSpeech = utter;
  window.speechSynthesis.speak(utter);
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => pickClaraVoice();
}

function clearClaraTypewriter() {
  if (claraTypewriterTimer) {
    clearInterval(claraTypewriterTimer);
    claraTypewriterTimer = null;
  }
}

function deliverClaraReply(text) {
  const plain = String(text || '').trim();
  const html = escapeHtml(plain).replace(/\n/g, '<br>');
  const msgs = document.getElementById('bot-msgs');
  if (!msgs) return;

  clearClaraTypewriter();
  setClaraState('thinking');

  const el = document.createElement('div');
  el.className = 'bmsg b';
  el.innerHTML = `<div class="bav clara-mini-av">${claraMiniAvatarHtml()}</div><div class="bbubble"><span class="clara-typewriter"></span><span class="clara-cursor">|</span></div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;

  const span = el.querySelector('.clara-typewriter');
  const cursor = el.querySelector('.clara-cursor');
  let i = 0;

  window.setTimeout(() => {
    setClaraState('speaking');
    setClaraCaption(plain);
    speakClara(plain);

    claraTypewriterTimer = window.setInterval(() => {
      i += plain.length > 280 ? 2 : 1;
      span.innerHTML = escapeHtml(plain.slice(0, i)).replace(/\n/g, '<br>');
      msgs.scrollTop = msgs.scrollHeight;

      if (i >= plain.length) {
        clearClaraTypewriter();
        if (cursor) cursor.style.display = 'none';
        span.innerHTML = html;
        window.setTimeout(() => {
          if (!claraSpeech) setClaraState('idle');
          setClaraCaption('');
        }, 400);
      }
    }, plain.length > 280 ? 14 : 18);
  }, 280);
}

function deliverClaraHtml(html) {
  deliverClaraReply(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

function onClaraThinking() {
  setClaraState('thinking');
  setClaraCaption('');
}

function onClaraTypingRemoved() {
  if (!claraTypewriterTimer && !claraSpeech) setClaraState('idle');
}
