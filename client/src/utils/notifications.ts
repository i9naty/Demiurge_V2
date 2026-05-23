let audioCtx: AudioContext | null = null;

const DING_BASE64 = '<base64>';

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export function playMessagePing() {
  playTone(800, 0.1);
  setTimeout(() => playTone(1000, 0.1), 100);
}

export function playUserJoin() {
  playTone(600, 0.08);
  setTimeout(() => playTone(800, 0.08), 80);
  setTimeout(() => playTone(1000, 0.1), 160);
}

export function playUserLeave() {
  playTone(600, 0.1);
  setTimeout(() => playTone(400, 0.15), 100);
}

export function playDiceRoll() {
  const ctx = getCtx();
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(200 + Math.random() * 400, 0.03, 'square'), i * 50);
  }
}

export function playVoiceJoin() {
  playTone(400, 0.1);
  setTimeout(() => playTone(600, 0.1), 100);
  setTimeout(() => playTone(800, 0.15), 200);
}
