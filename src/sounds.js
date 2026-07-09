let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtor();
  }
  return audioCtx;
}

export function resumeAudio() {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

function tone(freq, duration, options = {}) {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime + (options.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (options.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(options.gain ?? 0.04, now);
    gain.gain.exponentialRampToValueAtTime(options.gainEnd ?? 0.001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

export function playClick() {
  tone(520, 0.045, { freqEnd: 360, type: 'sine', gain: 0.025 });
}

export function playStart() {
  tone(392, 0.18, { freqEnd: 784, type: 'sawtooth', gain: 0.05 });
}

export function playMove() {
  tone(280, 0.07, { freqEnd: 420, type: 'triangle', gain: 0.035 });
}

export function playCollect(combo) {
  tone(660, 0.08, { type: 'sine', gain: 0.045 });
  tone(880, 0.08, { type: 'sine', gain: 0.038, delay: 0.035 });
  tone(1320, 0.08, { type: 'sine', gain: 0.03, delay: 0.07 });
  if (combo >= 3) {
    tone(1480, 0.05, { freqEnd: 1880, type: 'square', gain: 0.025, delay: 0.02 });
  }
}

export function playCrash() {
  tone(180, 0.32, { freqEnd: 48, type: 'sawtooth', gain: 0.07 });
}

export function playWin() {
  tone(523, 0.1, { type: 'triangle', gain: 0.045 });
  tone(659, 0.1, { type: 'triangle', gain: 0.04, delay: 0.09 });
  tone(784, 0.1, { type: 'triangle', gain: 0.038, delay: 0.18 });
  tone(1046, 0.12, { type: 'triangle', gain: 0.04, delay: 0.27 });
}
