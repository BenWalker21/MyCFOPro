// ── CLARA AVATAR (face + natural voice + lip sync) ───────────────────
const CLARA_AVATAR_SRC = '/assets/clara-avatar.svg';

function claraAvatarImgHtml(className, alt) {
  return `<img src="${CLARA_AVATAR_SRC}" alt="${alt || 'Clara'}" class="${className || ''}" onerror="this.replaceWith(claraAvatarFallback('${className || ''}'))">`;
}

function claraAvatarFallback(className) {
  const el = document.createElement('div');
  el.className = (className || '').includes('mini') ? 'clara-mini-fallback' : 'clara-avatar-fallback';
  el.textContent = 'C';
  el.setAttribute('aria-label', 'Clara');
  return el;
}

function initClaraAvatarImages() {
  document.querySelectorAll('img[src*="clara-avatar"]').forEach(img => {
    img.onerror = () => {
      const fb = claraAvatarFallback(img.className);
      img.replaceWith(fb);
    };
  });
}
let claraVoiceEnabled = true;
let claraVoiceMode = 'loading';
let claraTypewriterTimer = null;
let claraAudio = null;
let claraAudioUrl = null;
let claraAudioCtx = null;
let claraAnalyser = null;
let claraLipSyncFrame = null;
let claraSpeechActive = false;
let claraBrowserUtterance = null;

function initClaraAvatar() {
  initClaraAvatarImages();
  const toggle = document.getElementById('clara-voice-toggle');
  if (toggle) {
    toggle.checked = claraVoiceEnabled;
    toggle.addEventListener('change', () => {
      claraVoiceEnabled = toggle.checked;
      if (!claraVoiceEnabled) stopClaraSpeech();
    });
  }
  setClaraState('idle');
  loadClaraVoiceStatus();
}

async function loadClaraVoiceStatus() {
  const badge = document.getElementById('clara-voice-mode');
  try {
    const res = await fetch('/api/voice/status');
    if (!res.ok) throw new Error('status unavailable');
    const json = await res.json();
    claraVoiceMode = json.provider || 'browser';
    if (badge) {
      badge.textContent = json.label || 'Voice ready';
      badge.className = 'clara-voice-mode' + (json.natural ? ' natural' : ' fallback');
    }
  } catch {
    claraVoiceMode = 'browser';
    if (badge) {
      badge.textContent = 'Browser voice (run npm start for natural voice)';
      badge.className = 'clara-voice-mode fallback';
    }
  }
}

function setClaraVoiceMode(provider) {
  claraVoiceMode = provider || 'browser';
  const badge = document.getElementById('clara-voice-mode');
  if (!badge) return;
  const labels = {
    elevenlabs: 'ElevenLabs natural voice',
    openai: 'OpenAI natural voice',
    browser: 'Browser voice fallback'
  };
  badge.textContent = labels[provider] || labels.browser;
  badge.className = 'clara-voice-mode' + (provider === 'browser' ? ' fallback' : ' natural');
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
  return claraAvatarImgHtml('clara-mini-img', 'Clara');
}

function stopLipSync() {
  if (claraLipSyncFrame) {
    cancelAnimationFrame(claraLipSyncFrame);
    claraLipSyncFrame = null;
  }
  const mouth = document.getElementById('clara-mouth');
  if (mouth) mouth.style.transform = 'scaleY(0.12)';
}

function startLipSync() {
  stopLipSync();
  const mouth = document.getElementById('clara-mouth');
  if (!mouth || !claraAnalyser) return;

  const data = new Uint8Array(claraAnalyser.frequencyBinCount);
  const tick = () => {
    claraAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 2; i < data.length * 0.35; i++) sum += data[i];
    const avg = sum / Math.max(1, Math.floor(data.length * 0.35) - 2);
    const open = Math.min(1, avg / 95);
    mouth.style.transform = `scaleY(${0.12 + open * 0.88})`;
    claraLipSyncFrame = requestAnimationFrame(tick);
  };
  tick();
}

function stopClaraSpeech() {
  claraSpeechActive = false;
  stopLipSync();

  if (claraAudio) {
    claraAudio.pause();
    claraAudio.src = '';
    claraAudio = null;
  }
  if (claraAudioUrl) {
    URL.revokeObjectURL(claraAudioUrl);
    claraAudioUrl = null;
  }
  if (claraAudioCtx) {
    claraAudioCtx.close().catch(() => {});
    claraAudioCtx = null;
  }
  claraAnalyser = null;

  if (window.speechSynthesis) window.speechSynthesis.cancel();
  claraBrowserUtterance = null;
}

async function speakClara(text) {
  if (!claraVoiceEnabled || !text) {
    return { played: false, durationMs: estimateSpeechDuration(text) };
  }

  stopClaraSpeech();
  const plain = String(text).replace(/\s+/g, ' ').trim();
  if (!plain) return { played: false, durationMs: 0 };

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: plain.slice(0, 4000) })
    });

    if (!res.ok) throw new Error(await res.text());

    const provider = res.headers.get('x-voice-provider') || 'openai';
    setClaraVoiceMode(provider);
    const blob = await res.blob();
    return await playNaturalVoice(blob);
  } catch (error) {
    console.warn('Natural TTS unavailable, using browser voice:', error);
    setClaraVoiceMode('browser');
    return speakBrowserVoice(plain);
  }
}

function playNaturalVoice(blob) {
  return new Promise(resolve => {
    claraAudioUrl = URL.createObjectURL(blob);
    claraAudio = new Audio(claraAudioUrl);
    claraAudio.preload = 'auto';
    claraSpeechActive = true;

    const finish = (result) => {
      claraSpeechActive = false;
      stopLipSync();
      resolve(result);
    };

    claraAudio.addEventListener('loadedmetadata', () => {
      try {
        claraAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = claraAudioCtx.createMediaElementSource(claraAudio);
        claraAnalyser = claraAudioCtx.createAnalyser();
        claraAnalyser.fftSize = 512;
        claraAnalyser.smoothingTimeConstant = 0.65;
        source.connect(claraAnalyser);
        claraAnalyser.connect(claraAudioCtx.destination);
      } catch (err) {
        console.warn('Web Audio lip sync unavailable:', err);
      }
    }, { once: true });

    claraAudio.onplay = () => {
      setClaraState('speaking');
      if (claraAudioCtx?.state === 'suspended') claraAudioCtx.resume();
      startLipSync();
    };

    claraAudio.onended = () => {
      finish({ played: true, durationMs: (claraAudio?.duration || 0) * 1000 });
      if (!claraTypewriterTimer) {
        setClaraState('idle');
        setClaraCaption('');
      }
    };

    claraAudio.onerror = () => finish({ played: false, durationMs: estimateSpeechDuration('') });

    claraAudio.play().catch(() => {
      finish({ played: false, durationMs: estimateSpeechDuration('') });
    });
  });
}

function speakBrowserVoice(text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis) {
      resolve({ played: false, durationMs: estimateSpeechDuration(text) });
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.98;
    utter.pitch = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => /female|samantha|victoria|karen|jenny|aria|nova|shimmer/i.test(v.name))
      || voices.find(v => v.lang.startsWith('en'));
    if (voice) utter.voice = voice;

    claraSpeechActive = true;
    utter.onstart = () => {
      setClaraState('speaking');
      startBrowserLipSync();
    };
    utter.onend = () => {
      claraSpeechActive = false;
      stopLipSync();
      resolve({ played: true, durationMs: estimateSpeechDuration(text) });
      if (!claraTypewriterTimer) {
        setClaraState('idle');
        setClaraCaption('');
      }
    };
    utter.onerror = () => {
      claraSpeechActive = false;
      stopLipSync();
      resolve({ played: false, durationMs: estimateSpeechDuration(text) });
    };

    claraBrowserUtterance = utter;
    window.speechSynthesis.speak(utter);
  });
}

function startBrowserLipSync() {
  stopLipSync();
  const mouth = document.getElementById('clara-mouth');
  if (!mouth) return;
  let t = 0;
  const tick = () => {
    t += 0.14;
    const open = 0.25 + Math.abs(Math.sin(t * 3.2)) * 0.55 + Math.abs(Math.sin(t * 7.1)) * 0.15;
    mouth.style.transform = `scaleY(${Math.min(1, open)})`;
    if (claraSpeechActive) claraLipSyncFrame = requestAnimationFrame(tick);
  };
  tick();
}

function estimateSpeechDuration(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1800, words * 340);
}

function clearClaraTypewriter() {
  if (claraTypewriterTimer) {
    clearInterval(claraTypewriterTimer);
    claraTypewriterTimer = null;
  }
}

function runTypewriter(span, cursor, plain, html, msgs, durationMs) {
  let i = 0;
  const totalMs = Math.max(durationMs || estimateSpeechDuration(plain), 1200);
  const step = Math.max(12, totalMs / Math.max(plain.length, 1));

  claraTypewriterTimer = window.setInterval(() => {
    i += plain.length > 320 ? 2 : 1;
    span.innerHTML = escapeHtml(plain.slice(0, i)).replace(/\n/g, '<br>');
    msgs.scrollTop = msgs.scrollHeight;

    if (i >= plain.length) {
      clearClaraTypewriter();
      if (cursor) cursor.style.display = 'none';
      span.innerHTML = html;
      window.setTimeout(() => {
        if (!claraSpeechActive) {
          setClaraState('idle');
          setClaraCaption('');
        }
      }, 400);
    }
  }, step);
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

  window.setTimeout(() => {
    setClaraCaption(plain);
    runTypewriter(span, cursor, plain, html, msgs, estimateSpeechDuration(plain));
    speakClara(plain);
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
  if (!claraTypewriterTimer && !claraSpeechActive) setClaraState('idle');
}
