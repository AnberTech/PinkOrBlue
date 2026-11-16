// Mini oyun: Balon Patlat (30 sn, tek parmak).
import { sfx, vib, unlock } from "./sfx.js?v=202611170017";

const DUR = 30;
export function playGame({ root, S, onEnd, names = [], baby = "" }) {
  const pool = names.length ? names : [""];
  const wrap = document.createElement("div");
  wrap.className = "game";
  wrap.innerHTML = `<canvas></canvas>
    <div class="game-hud"><span class="g-score">0</span><span class="g-time">30</span>
    <button class="g-close" aria-label="${S.close}">✕</button></div>
    <div class="game-start"><div class="card">
      <h2>${S.game_name}</h2><p>${S.game_rules_html}</p>${names.length > 1 ? `<p class="muted small">${S.game_names_hint}</p>` : ""}
      <button class="btn btn-gold g-go">${S.game_start}</button></div></div>`;
  root.appendChild(wrap);
  document.body.classList.add("noscroll");
  const cv = wrap.querySelector("canvas"), g = cv.getContext("2d", { desynchronized: true });
  const elScore = wrap.querySelector(".g-score"), elTime = wrap.querySelector(".g-time");
  let W, H, dpr;
  const sprites = new Map();
  function resize() {
    dpr = Math.min(1.75, devicePixelRatio || 1); W = wrap.clientWidth; H = wrap.clientHeight; sprites.clear();
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); addEventListener("resize", resize);

  let objs = [], fx = [], score = 0, t0 = 0, last = 0, spawnAcc = 0, mult = 0, combo = [], running = false, raf = 0, shake = 0;
  const cols = ["#FF8FB8", "#7EC8FF", "#FFB3CF", "#A6D9FF"];
  function spawn(el) {
    const r = Math.random();
    const speed = (3.4 + el / DUR * 2.8) * (H / 700);
    let o;
    if (r < .04) o = { k: "stork", x: -60, y: H * (.2 + Math.random() * .4), vx: 1.6 * (W / 400), vy: 0, r: 30 };
    else if (r < .10) o = { k: "gold", label: baby, x: 30 + Math.random() * (W - 60), y: H + 40, vx: 0, vy: -speed * 1.6, r: 24 };
    else if (r < .28) o = { k: "spike", x: 30 + Math.random() * (W - 60), y: H + 40, vx: 0, vy: -speed * .9, r: 24 };
    else o = { k: "b", label: pool[Math.floor(Math.random() * pool.length)], c: cols[Math.floor(Math.random() * 4)], x: 30 + Math.random() * (W - 60), y: H + 40, vy: -speed * (.85 + Math.random() * .5), r: 22 + Math.random() * 8, vx: (Math.random() - .5) * 1.6 };
    o.ph = Math.random() * 6;
    objs.push(o);
  }
  // ---- Performans: balon, kirpi ve etiketler bir kez önceden çizilir (sprite), her karede yalnız drawImage
  const IMG = new URL("../img/", import.meta.url).href;
  const storkImg = new Image(); storkImg.src = IMG + "stork.png";
  function sprite(key, w, h, draw) {
    let c = sprites.get(key);
    if (!c) {
      c = document.createElement("canvas"); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const x = c.getContext("2d"); x.scale(dpr, dpr); draw(x); sprites.set(key, c);
    }
    return c;
  }
  function shade(c) { return { "#FF8FB8": "#D6336C", "#7EC8FF": "#1C6FB8", "#FFB3CF": "#E05A8A", "#A6D9FF": "#3D8CD0", "#F2B93B": "#A8740A" }[c] || c; }
  const rb = (r) => Math.round(r / 2) * 2;      // yarıçapı 2 px'lik basamaklara yuvarla (az sayıda sprite)
  function balloonSprite(c, r) {
    r = rb(r);
    return sprite("b" + c + r, r * 2 + 12, r * 3.4, (x) => {
      x.translate(r + 6, r * 1.2);
      x.strokeStyle = "rgba(43,33,64,.3)"; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, r * 1.1); x.quadraticCurveTo(6, r * 1.6, 0, r * 2.1); x.stroke();
      const gr = x.createRadialGradient(-r * .3, -r * .4, 2, 0, 0, r * 1.2);
      gr.addColorStop(0, "#fff"); gr.addColorStop(.25, c); gr.addColorStop(1, shade(c));
      x.fillStyle = gr; x.beginPath(); x.ellipse(0, 0, r * .9, r * 1.1, 0, 0, 7); x.fill();
    });
  }
  function drawBalloon(x, y, r, c, ph) {
    const sp = balloonSprite(c, r), R = rb(r);
    g.drawImage(sp, x + Math.sin(ph) * 3 - R - 6, y - R * 1.2, sp.width / dpr, sp.height / dpr);
  }
  function drawSpike(x, y, r) {
    const R = rb(r), sp = sprite("s" + R, R * 2.6, R * 2.6, (c) => {
      c.translate(R * 1.3, R * 1.3); c.fillStyle = "#8A8299"; c.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? R * .7 : R * 1.15; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.fill(); c.fillStyle = "#2B2140"; c.beginPath(); c.arc(-R * .25, -R * .1, 3, 0, 7); c.arc(R * .25, -R * .1, 3, 0, 7); c.fill();
    });
    g.drawImage(sp, x - R * 1.3, y - R * 1.3, R * 2.6, R * 2.6);
  }
  function drawStork(x, y, r) {
    const s = r * 2.6;
    if (storkImg.complete && storkImg.naturalWidth) g.drawImage(storkImg, x - s / 2, y - s / 2, s, s);
    else { g.fillStyle = "#FFF8EE"; g.beginPath(); g.arc(x, y, r * .6, 0, 7); g.fill(); }
  }
  function label(s, x, y, r) {
    const t = s.length > 7 ? s.slice(0, 6) + "…" : s, fs = Math.max(10, Math.round(r * .42));
    const sp = sprite("l" + fs + t, fs * t.length * .7 + 10, fs * 1.6, (c) => {
      c.font = `800 ${fs}px "Baloo 2", system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
      const w = fs * t.length * .7 + 10;
      c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(43,33,64,.25)"; c.lineWidth = 3;
      c.strokeText(t, w / 2, fs * .8); c.fillText(t, w / 2, fs * .8);
    });
    const w = sp.width / dpr, h = sp.height / dpr;
    g.drawImage(sp, x - w / 2, y + 2 - h / 2, w, h);
  }
  function text(s, x, y, size, color, a = 1) {
    g.save(); g.globalAlpha = a; g.font = `800 ${size}px "Baloo 2", system-ui`; g.textAlign = "center"; g.fillStyle = color; g.fillText(s, x, y); g.restore();
  }
  function hit(e) {
    if (!running) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (Math.hypot(o.x - x, o.y - y) < o.r + 6) {
        objs.splice(i, 1);
        const m = mult > performance.now() ? 2 : 1;
        let pts = 0, label, col = "#2B2140";
        if (o.k === "b") { pts = 1 * m; sfx.pop(); }
        else if (o.k === "gold") { pts = 5 * m; sfx.gold(); col = "#A8740A"; }
        else if (o.k === "stork") { mult = performance.now() + 3000; sfx.ding(); label = "×2!"; col = "#A8740A"; }
        else { pts = -5; sfx.bonk(); vib(60); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) shake = 1; col = "#E5484D"; }
        if (pts > 0) {
          const n = performance.now(); combo = combo.filter(c => n - c < 1000); combo.push(n);
          if (combo.length >= 3) { pts += 1; label = S.game_combo.replace("%d", combo.length); combo = []; }
        }
        score = Math.max(0, score + pts);
        fx.push({ x: Math.min(W - 70, Math.max(70, o.x)), y: o.y, s: label || ((o.label && pts > 0 ? o.label + " " : "") + (pts > 0 ? "+" + pts : String(pts))), c: col, life: 1, parts: Array.from({ length: 6 }, () => ({ vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6 })), pc: o.c || (o.k === "gold" ? "#F2B93B" : "#aaa") });
        elScore.textContent = score;
        return;
      }
    }
  }
  cv.addEventListener("pointerdown", hit);

  function frame(now) {
    const el = (now - t0) / 1000;
    const dt = Math.min(50, now - last) / 16.7; last = now;
    elTime.textContent = Math.max(0, Math.ceil(DUR - el));
    spawnAcc += (2.6 + el / DUR * 2.8) * dt / 60;
    while (spawnAcc >= 1) { spawnAcc--; spawn(el); }
    g.save();
    if (shake > 0) { g.translate((Math.random() - .5) * 10 * shake, 0); shake -= .1; }
    g.clearRect(-20, 0, W + 40, H);
    if (shake > 0) { g.fillStyle = `rgba(229,72,77,${shake * .2})`; g.fillRect(0, 0, W, H); }
    if (mult > now) { g.fillStyle = "rgba(242,185,59,.12)"; g.fillRect(0, 0, W, H); text("×2", W - 40, 90, 28, "#A8740A"); }
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]; o.x += o.vx * dt; o.y += o.vy * dt; o.ph += .05 * dt;
      if (o.y < -80 || o.x > W + 80) { objs.splice(i, 1); continue; }
      if (o.k === "b") drawBalloon(o.x, o.y, o.r, o.c, o.ph);
      else if (o.k === "gold") drawBalloon(o.x, o.y, o.r, "#F2B93B", o.ph);
      else if (o.k === "spike") drawSpike(o.x, o.y, o.r);
      else drawStork(o.x, o.y + Math.sin(o.ph) * 10, o.r);
      if (o.label && (o.k === "b" || o.k === "gold")) label(o.label, o.x + Math.sin(o.ph) * 3, o.y, o.r);
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= .025 * dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      g.fillStyle = f.pc; g.globalAlpha = f.life; const q = (1 - f.life) * 12;
      for (const p of f.parts) g.fillRect(f.x + p.vx * q - 3, f.y + p.vy * q - 3, 6, 6);
      g.globalAlpha = 1;
      text(f.s, f.x, f.y - (1 - f.life) * 40, 24, f.c, f.life);
    }
    g.restore();
    if (el >= DUR) return end(false);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    unlock();
    wrap.querySelector(".game-start").remove();
    running = true; t0 = last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function end(aborted) {
    running = false; cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    wrap.remove(); document.body.classList.remove("noscroll");
    onEnd && onEnd(aborted && score === 0 ? null : score);
  }
  wrap.querySelector(".g-go").onclick = start;
  wrap.querySelector(".g-close").onclick = () => end(true);
  return { abort: () => running || wrap.isConnected ? end(true) : null };
}
