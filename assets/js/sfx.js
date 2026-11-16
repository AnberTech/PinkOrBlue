// Web Audio ile sentezlenen sesler (dosya yok). Ses ancak bir dokunuştan sonra açılabilir.
let ctx = null, master = null;
let enabled = true;
try { enabled = localStorage.getItem("pob_sound") !== "0"; } catch (e) {}

// iOS: sessiz mod anahtarı Web Audio'yu susturur. iOS 17+ audioSession "playback" ile, eski sürümlerde
// sessiz bir <audio> çalarak medya kanalına geçilir; ikisi de yalnız dokunma anında işe yarar.
let mediaKick = null;
export function unlock() {
  try {
    if (navigator.audioSession) { try { navigator.audioSession.type = "playback"; } catch (e) {} }
    if (!mediaKick) {
      mediaKick = new Audio("data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==");
      mediaKick.setAttribute("playsinline", ""); mediaKick.loop = false;
    }
    mediaKick.play().catch(() => {});
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = 0.6;
      analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      master.connect(comp); comp.connect(ctx.destination); comp.connect(analyser);
    }
    if (ctx.state !== "running") ctx.resume().catch(() => {});
  } catch (e) {}
}
let analyser = null;
// Test ve teşhis için: son ~10 ms'deki ses seviyesi (0 = sessiz)
export function level() {
  if (!analyser) return 0;
  const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
  let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m;
}
export const audioState = () => ctx ? ctx.state : "none";
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

// ---- Açılış müziği: assets/audio/reveal-girl.mp3 / reveal-boy.mp3 / reveal.mp3 varsa onu çal, yoksa sentez
const AUDIO_BASE = new URL("../audio/", import.meta.url).href;
const revealBuf = {};
export async function preloadReveal() {
  if (!ctx) return;
  for (const name of (window.POB_AUDIO || []).filter(n => /^reveal(-girl|-boy)?$/.test(n))) {
    if (revealBuf[name] !== undefined) continue;
    revealBuf[name] = null;
    try {
      const r = await fetch(AUDIO_BASE + name + ".mp3", { cache: "force-cache" });
      if (!r.ok) continue;
      const data = await r.arrayBuffer();
      revealBuf[name] = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
    } catch (e) { revealBuf[name] = null; }
  }
}
let reverb = null;
function getReverb() {
  if (reverb || !ctx) return reverb;
  const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  reverb = ctx.createConvolver(); reverb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.35; reverb.connect(wet); wet.connect(master);
  return reverb;
}
// Pirinç benzeri akor: birkaç hafif detune sawtooth + alçak geçiren filtre (parlaklık zarfla açılır)
function brass(freqs, when, dur, peak = 0.07) {
  const t = ctx.currentTime + when, rv = getReverb();
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.7;
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.12); f.frequency.exponentialRampToValueAtTime(1400, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.04); g.gain.setValueAtTime(peak, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g); g.connect(master); if (rv) g.connect(rv);
  freqs.forEach(fr => [-6, 0, 6].forEach(dt => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.1); }));
}
function bell(freq, when, peak = 0.12) {
  const t = ctx.currentTime + when, rv = getReverb();
  [[1, 1], [2.76, .35], [5.4, .15]].forEach(([m, a]) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = freq * m;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak * a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(master); if (rv) g.connect(rv); o.start(t); o.stop(t + 1.7);
  });
}
function revealSynth(girl) {
  const k = girl ? 1 : 0.84;                    // kız biraz daha parlak tonda
  const C = 261.63 * k, n = (st) => C * Math.pow(2, st / 12);
  // vuruş + timpani
  tone(55, 0.9, "sine", 0.7, 0, 38); noise(0.5, 0.35, 0, "lowpass", 900, 120);
  // akor ilerleyişi I – IV – V – I (parlak, kutlama)
  brass([n(0), n(4), n(7), n(12)], 0.02, 0.9, 0.06);
  brass([n(5), n(9), n(12), n(17)], 0.95, 0.55, 0.055);
  brass([n(7), n(11), n(14), n(19)], 1.5, 0.55, 0.055);
  brass([n(0) * 2, n(4) * 2, n(7) * 2, n(12)], 2.05, 2.4, 0.07);
  // çan arpejleri
  [0, 4, 7, 12, 16, 19, 24].forEach((st, i) => bell(n(st) * 2, 0.1 + i * 0.09, 0.1));
  [24, 19, 16, 12].forEach((st, i) => bell(n(st) * 2, 2.1 + i * 0.12, 0.09));
  // alkış ve neşe
  for (let i = 0; i < 40; i++) noise(0.03 + Math.random() * 0.03, 0.05 + Math.random() * 0.07, 0.4 + Math.random() * 3.2, "bandpass", 1800 + Math.random() * 2500, null, 0.9);
}
export function playReveal(girl) {
  if (!ok()) return;
  const buf = revealBuf[girl ? "reveal-girl" : "reveal-boy"] || revealBuf["reveal"];
  if (buf) { const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = 1.4; s.connect(g); g.connect(master); s.start(); return; }
  revealSynth(girl);
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
  deflate: () => { noise(1.4, 0.35, 0, "bandpass", 2600, 300, 1.5); tone(420, 1.3, "sawtooth", 0.06, 0, 110); },
  test: () => { tone(784, 0.12, "triangle", 0.3); tone(1047, 0.18, "triangle", 0.3, 0.1); },
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
