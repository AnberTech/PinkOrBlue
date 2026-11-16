// Mini oyun: Balon Patlat (30 sn, tek parmak).
import { sfx, vib, unlock } from "./sfx.js?v=202611161720";

const DUR = 30;
export function playGame({ root, S, onEnd }) {
  const wrap = document.createElement("div");
  wrap.className = "game";
  wrap.innerHTML = `<canvas></canvas>
    <div class="game-hud"><span class="g-score">0</span><span class="g-time">30</span>
    <button class="g-close" aria-label="${S.close}">✕</button></div>
    <div class="game-start"><div class="card">
      <h2>${S.game_name}</h2><p>${S.game_rules_html}</p>
      <button class="btn btn-gold g-go">${S.game_start}</button></div></div>`;
  root.appendChild(wrap);
  document.body.classList.add("noscroll");
  const cv = wrap.querySelector("canvas"), g = cv.getContext("2d");
  const elScore = wrap.querySelector(".g-score"), elTime = wrap.querySelector(".g-time");
  let W, H, dpr;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = wrap.clientWidth; H = wrap.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); addEventListener("resize", resize);

  let objs = [], fx = [], score = 0, t0 = 0, last = 0, spawnAcc = 0, mult = 0, combo = [], running = false, raf = 0, shake = 0;
  const cols = ["#FF8FB8", "#7EC8FF", "#FFB3CF", "#A6D9FF"];
  function spawn(el) {
    const r = Math.random();
    const speed = (1.2 + el / DUR * 1.2) * (H / 700);
    let o;
    if (r < .05) o = { k: "stork", x: -60, y: H * (.2 + Math.random() * .4), vx: 1.6 * (W / 400), vy: 0, r: 30 };
    else if (r < .13) o = { k: "gold", x: 30 + Math.random() * (W - 60), y: H + 40, vx: 0, vy: -speed * 1.6, r: 24 };
    else if (r < .23) o = { k: "spike", x: 30 + Math.random() * (W - 60), y: H + 40, vx: 0, vy: -speed * .9, r: 24 };
    else o = { k: "b", c: cols[Math.floor(Math.random() * 4)], x: 30 + Math.random() * (W - 60), y: H + 40, vx: 0, vy: -speed, r: 26 + Math.random() * 8 };
    o.ph = Math.random() * 6;
    objs.push(o);
  }
  function drawBalloon(x, y, r, c, ph) {
    g.save(); g.translate(x + Math.sin(ph) * 3, y);
    g.strokeStyle = "rgba(43,33,64,.3)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, r * 1.1); g.quadraticCurveTo(6, r * 1.6, 0, r * 2.1); g.stroke();
    const gr = g.createRadialGradient(-r * .3, -r * .4, 2, 0, 0, r * 1.2);
    gr.addColorStop(0, "#fff"); gr.addColorStop(.25, c); gr.addColorStop(1, shade(c));
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * .9, r * 1.1, 0, 0, 7); g.fill();
    g.restore();
  }
  function shade(c) { return { "#FF8FB8": "#D6336C", "#7EC8FF": "#1C6FB8", "#FFB3CF": "#E05A8A", "#A6D9FF": "#3D8CD0", "#F2B93B": "#A8740A" }[c] || c; }
  function drawSpike(x, y, r) {
    g.save(); g.translate(x, y); g.fillStyle = "#8A8299";
    g.beginPath();
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? r * .7 : r * 1.15; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.fill(); g.fillStyle = "#2B2140"; g.beginPath(); g.arc(-r * .25, -r * .1, 3, 0, 7); g.arc(r * .25, -r * .1, 3, 0, 7); g.fill(); g.restore();
  }
  function drawStork(x, y, r) {
    g.save(); g.translate(x, y); g.font = `${r * 1.6}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("🕊️", 0, -r * .2);
    g.fillStyle = "#FFF8EE"; g.strokeStyle = "#F2B93B"; g.lineWidth = 2;
    g.beginPath(); g.arc(0, r * .9, r * .45, 0, 7); g.fill(); g.stroke(); g.restore();
  }
  function text(s, x, y, size, color, a = 1) {
    g.save(); g.globalAlpha = a; g.font = `800 ${size}px "Baloo 2", system-ui`; g.textAlign = "center"; g.fillStyle = color; g.fillText(s, x, y); g.restore();
  }
  function hit(e) {
    if (!running) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (Math.hypot(o.x - x, o.y - y) < o.r + 10) {
        objs.splice(i, 1);
        const m = mult > performance.now() ? 2 : 1;
        let pts = 0, label, col = "#2B2140";
        if (o.k === "b") { pts = 1 * m; sfx.pop(); }
        else if (o.k === "gold") { pts = 5 * m; sfx.gold(); col = "#A8740A"; }
        else if (o.k === "stork") { mult = performance.now() + 3000; sfx.ding(); label = "×2!"; col = "#A8740A"; }
        else { pts = -3; sfx.bonk(); vib(60); shake = 1; col = "#E5484D"; }
        if (pts > 0) {
          const n = performance.now(); combo = combo.filter(c => n - c < 1000); combo.push(n);
          if (combo.length >= 3) { pts += 1; label = S.game_combo.replace("%d", combo.length); combo = []; }
        }
        score = Math.max(0, score + pts);
        fx.push({ x: o.x, y: o.y, s: label || (pts > 0 ? "+" + pts : String(pts)), c: col, life: 1, parts: Array.from({ length: 6 }, () => ({ vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6 })), pc: o.c || (o.k === "gold" ? "#F2B93B" : "#aaa") });
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
    spawnAcc += (0.8 + el / DUR * 1.7) * dt / 60;
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
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= .025 * dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.parts.forEach(p => { g.fillStyle = f.pc; g.globalAlpha = f.life; g.beginPath(); g.arc(f.x + p.vx * (1 - f.life) * 12, f.y + p.vy * (1 - f.life) * 12, 4, 0, 7); g.fill(); });
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
