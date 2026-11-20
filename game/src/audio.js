// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, siren wail, gunshot, pickup blip, mission jingle and a simple
// procedural bass-and-hat music loop. M toggles mute; audio starts on the
// first user gesture (browsers block it before then).
export function createAudio() {
  let ctx = null, master = null, musicGain = null, muted = false, musicTimer = null, beat = 0;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
    } catch { return false; }
    return true;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol, low) {
    if (!ensure() || muted || !ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  const NOTES = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4, 55, 0, 65.4, 82.4, 49, 58.3, 65.4, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const n = NOTES[beat % NOTES.length]; beat += 1;
      if (n) tone(n, 0.22, 'triangle', 0.5);
      if (beat % 2 === 0) noise(0.03, 0.08, 6000);
    }, 210);
  }
  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    engine(speed01) { if (!ensure() || muted || !ctx) return; tone(50 + speed01 * 90, 0.09, 'sawtooth', 0.05); },
    siren() { tone(700, 0.35, 'sine', 0.07, 1100); },
    gunshot() { noise(0.12, 0.4, 2500); },
    punch() { noise(0.08, 0.25, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.22); tone(990, 0.14, 'sine', 0.22); },
    crash() { noise(0.25, 0.4, 700); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110)); },
    wasted() { [400, 300, 200, 120].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'sawtooth', 0.2), i * 160)); },
  };
}
