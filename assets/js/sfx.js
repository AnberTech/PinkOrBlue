// Web Audio ile sentezlenen sesler (dosya yok). Ses ancak bir dokunuştan sonra açılabilir.
let ctx = null, master = null;
let enabled = true;
try { enabled = localStorage.getItem("pob_sound") !== "0"; } catch (e) {}

export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = 0.5;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state !== "running") ctx.resume();
  } catch (e) {}
}
export const running = () => !!ctx && ctx.state === "running";
export const isOn = () => enabled;
export function setOn(v) {
  enabled = v;
  try { localStorage.setItem("pob_sound", v ? "1" : "0"); } catch (e) {}
  if (v) unlock();
}
const ok = () => enabled && ctx && ctx.state === "running";

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, dur, type = "sine", peak = 0.4, when = 0, slideTo = null) {
  if (!ok()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, 0.008, peak, dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(dur, peak = 0.3, when = 0, filter = "bandpass", f1 = 1000, f2 = null, q = 1) {
  if (!ok()) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(f1, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  tick: (hi) => tone(hi ? 880 : 660, 0.12, "sine", 0.35),
  fanfare: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.14, "square", 0.12, i * 0.08)); },
  pump: () => noise(0.07, 0.22, 0, "bandpass", 400, 1200, 2),
  kick: () => tone(120, 0.16, "sine", 0.6, 0, 40),
  snare: (v = 0.15) => noise(0.05, v, 0, "highpass", 1800),
  heart: () => { tone(90, 0.12, "sine", 0.55, 0, 45); tone(80, 0.12, "sine", 0.45, 0.16, 40); },
  sweep: () => tone(200, 3, "sine", 0.12, 0, 800),
  boom: () => { noise(0.18, 0.6, 0, "lowpass", 4000, 300); tone(60, 0.45, "sine", 0.8, 0, 30); },
  celebrate: (girl) => {
    const seq = girl ? [784, 988, 1175, 1568, 1319, 1568, 1760, 2093] : [392, 494, 587, 784, 659, 784, 880, 1047];
    seq.forEach((f, i) => { tone(f, 0.2, "triangle", 0.22, 0.1 + i * 0.13); tone(f * 2, 0.12, "square", 0.04, 0.1 + i * 0.13); });
    for (let i = 0; i < 18; i++) noise(0.04, 0.08 + Math.random() * 0.08, 1.2 + Math.random() * 2, "bandpass", 2500 + Math.random() * 2000, null, 0.8);
  },
  ding: () => { tone(1319, 0.25, "sine", 0.3); tone(1760, 0.3, "sine", 0.25, 0.12); },
  pop: () => { noise(0.04, 0.3, 0, "highpass", 1500); tone(900, 0.05, "sine", 0.2); },
  gold: () => { tone(1047, 0.1, "triangle", 0.25); tone(1568, 0.14, "triangle", 0.25, 0.08); },
  bonk: () => tone(160, 0.2, "square", 0.18, 0, 90),
  plop: () => tone(520, 0.12, "sine", 0.3, 0, 780),
};

let lastVib = 0;
export function vib(p) {
  if (!navigator.vibrate) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const n = performance.now();
  if (typeof p === "number" && p <= 15 && n - lastVib < 125) return;
  lastVib = n;
  try { navigator.vibrate(p); } catch (e) {}
}
