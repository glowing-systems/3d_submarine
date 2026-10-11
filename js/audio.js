// 📁 js/audio.js 👷 W8 📝 Zweck: Prozedurales WebAudio — Ping, Diesel, Explosionen, Hydrophon-Rauschen
export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.dieselNodes = null; }
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return !!this.ctx;
  }
  env(g, t0, a, peak, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  ping() {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(840, t + 0.6);
    this.env(g, t, 0.01, 0.25, 1.2); o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 1.4);
  }
  torpLaunch() { this.noiseBurst(0.5, 400, 0.3); }
  gunfire() { this.noiseBurst(0.35, 150, 0.5); }
  splash() { this.noiseBurst(0.8, 900, 0.25); }
  explosion() {
    if (!this.ensure() || this.muted) return;
    this.noiseBurst(2.2, 90, 0.8);
  }
  noiseBurst(dur, cutoff, vol) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime, len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination); src.start(t);
  }
  diesel(on, submerged) {
    if (!this.ensure() || this.muted) { this.stopDiesel(); return; }
    if (!on) { this.stopDiesel(); return; }
    if (this.dieselNodes) return;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = submerged ? 40 : 55; o2.type = 'square'; o2.frequency.value = submerged ? 20 : 27;
    f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0.05;
    o.connect(f); o2.connect(f); f.connect(g).connect(this.ctx.destination); o.start(); o2.start();
    this.dieselNodes = { o, o2, g };
  }
  stopDiesel() { if (this.dieselNodes) { try { this.dieselNodes.o.stop(); this.dieselNodes.o2.stop(); } catch {} this.dieselNodes.g.disconnect(); this.dieselNodes = null; } }
}
