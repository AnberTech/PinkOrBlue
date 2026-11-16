// Açılış şovu: 22 sn, tamamen sunucu saatine bağlı (t = serverNow - revealAt).
// Geç açan kişi şovu kaldığı saniyeden izler. Çizim tek canvas + tek rAF döngüsü.
import { sfx, vib, unlock, running } from "./sfx.js";

const C = {
  pink: "#FF8FB8", pinkDeep: "#D6336C", blue: "#7EC8FF", blueDeep: "#1C6FB8",
  gold: "#F2B93B", goldHi: "#FFE08A", goldDeep: "#A8740A", cream: "#FFF8EE", ink: "#2B2140",
};
const END = 22;

export function playShow(opts) {
  // opts: { root, getT, result, babyName, S, getTaps, onTap, myPick, correctCount, onEnd, local }
  const { root, getT, result, S } = opts;
  const girl = result === "girl";
  const resColor = girl ? C.pink : C.blue;
  const resDeep = girl ? C.pinkDeep : C.blueDeep;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("rm");

  const wrap = document.createElement("div");
  wrap.className = "show";
  wrap.innerHTML = `<canvas></canvas>
    <div class="show-ui">
      <button class="btn btn-gold show-sound" hidden>${S.show_sound}</button>
      <p class="show-live" aria-live="assertive"></p>
    </div>`;
  root.appendChild(wrap);
  document.body.classList.add("noscroll");
  const cv = wrap.querySelector("canvas"), g = cv.getContext("2d");
  const soundBtn = wrap.querySelector(".show-sound");
  const live = wrap.querySelector(".show-live");
  soundBtn.onclick = (e) => { e.stopPropagation(); unlock(); soundBtn.hidden = true; };

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = wrap.clientWidth; H = wrap.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  // ---- durum
  const fired = new Set();
  const once = (k, t, at, fn) => { if (t >= at && t < at + 0.6 && !fired.has(k)) { fired.add(k); fn(); } else if (t >= at + 0.6) fired.add(k); };
  let myTaps = 0, tapTimes = [], bounce = 0, lastKick = -1, lastSnare = -1, lastHeart = -1;
  const sparks = [], plus = [], shards = [], confetti = [];
  let shown = { total: 0 };

  function onPointer(e) {
    const t = getT() / 1000;
    if (!running()) unlock();
    if (t < 3 || t >= 13) return;
    const now = performance.now();
    tapTimes = tapTimes.filter(x => now - x < 1000);
    if (tapTimes.length >= 15) return;
    tapTimes.push(now);
    myTaps++;
    opts.onTap && opts.onTap(myTaps);
    bounce = 1;
    sfx.pump(); vib(10);
    const x = e.clientX ?? W / 2, y = e.clientY ?? H / 2;
    for (let i = 0; i < 4; i++) sparks.push({ x, y, vx: (Math.random() - .5) * 5, vy: -Math.random() * 5 - 1, life: 1 });
    plus.push({ x, y, life: 1 });
  }
  wrap.addEventListener("pointerdown", onPointer);
  const onKey = (e) => { if (e.code === "Space") { e.preventDefault(); onPointer({ clientX: W / 2, clientY: H / 2 }); } };
  addEventListener("keydown", onKey);

  function burst(n, fromTop) {
    const cols = [resColor, resDeep, C.gold, C.goldHi, C.cream, "#fff"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 10;
      confetti.push(fromTop
        ? { x: Math.random() * W, y: -20 - Math.random() * H * .3, vx: (Math.random() - .5) * 2, vy: 1 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[i % cols.length], w: 6 + Math.random() * 6, h: 10 + Math.random() * 8 }
        : { x: W / 2, y: H * .45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], w: 6 + Math.random() * 6, h: 10 + Math.random() * 8 });
    }
  }

  function balloon(cx, cy, R, wobble) {
    g.save();
    g.translate(cx, cy);
    g.scale(1 - wobble * .06, 1 + wobble * .06);
    // ip
    g.strokeStyle = "rgba(43,33,64,.35)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, R * 1.15);
    g.bezierCurveTo(R * .2, R * 1.45, -R * .2, R * 1.75, R * .05, R * 2.1); g.stroke();
    // düğüm
    g.fillStyle = C.goldDeep;
    g.beginPath(); g.moveTo(-R * .09, R * 1.17); g.lineTo(R * .09, R * 1.17); g.lineTo(0, R * 1.06); g.fill();
    // gövde
    const grd = g.createRadialGradient(-R * .35, -R * .4, R * .1, 0, 0, R * 1.2);
    grd.addColorStop(0, C.goldHi); grd.addColorStop(.55, C.gold); grd.addColorStop(1, C.goldDeep);
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, R * .92, R * 1.1, 0, 0, Math.PI * 2); g.fill();
    // parıltı
    g.fillStyle = "rgba(255,255,255,.55)";
    g.beginPath(); g.ellipse(-R * .38, -R * .5, R * .14, R * .26, -.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.3)";
    g.beginPath(); g.ellipse(-R * .2, -R * .78, R * .05, R * .07, 0, 0, Math.PI * 2); g.fill();
    // soru işareti
    g.fillStyle = "rgba(168,116,10,.35)";
    g.font = `800 ${R * .9}px "Baloo 2", system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("?", 0, R * .05);
    g.restore();
  }

  function text(s, x, y, size, color, weight = 800, alpha = 1, scale = 1) {
    g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(scale, scale);
    g.font = `${weight} ${size}px "Baloo 2", system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    const mw = W * .92 / scale, tw = g.measureText(s).width;
    if (tw > mw) g.font = `${weight} ${size * mw / tw}px "Baloo 2", system-ui`;
    g.fillStyle = color; g.fillText(s, 0, 0); g.restore();
  }
  const easeBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  let raf = 0, ended = false;
  function frame() {
    const t = getT() / 1000;
    const taps = opts.getTaps ? opts.getTaps() : { total: 0, people: 0, top: [] };
    const total = Math.max(taps.total, 0);
    shown.total += (total - shown.total) * .25;
    const target = Math.max(60, (taps.expected || 1) * 25);
    g.clearRect(0, 0, W, H);

    // ---- arka plan
    let bgDark = clamp((t + 6) / .4) * .7;
    if (t >= 13 && t < 17) bgDark = .7 + clamp((t - 13) / 3) * .2;
    g.fillStyle = `rgba(23,18,31,${t < 17 ? bgDark + .1 : 0})`;
    g.fillRect(0, 0, W, H);
    if (t < 17) {
      const sg = g.createRadialGradient(W / 2, H * .45, 10, W / 2, H * .45, Math.max(W, H) * .7);
      sg.addColorStop(0, "rgba(242,185,59,.18)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }

    const cx = W / 2, cy = H * .45;
    const baseR = Math.min(W, H) * .24;

    if (t < 0) {
      // hazırlık
      text(S.show_ready, cx, H * .3, Math.min(34, W * .08), "#fff", 800, 1);
      text(S.show_ready_sub, cx, H * .3 + 40, Math.min(18, W * .045), "rgba(255,255,255,.75)", 600);
      balloon(cx, H * .62, baseR * .35, Math.sin(t * 3) * .3);
      soundBtn.hidden = running() || !(opts.soundWanted ?? true);
    } else soundBtn.hidden = true;

    // ---- geri sayım 0-3
    if (t >= 0 && t < 3) {
      const n = 3 - Math.floor(t), f = t % 1;
      once("c" + n, t, 3 - n, () => { sfx.tick(n === 1); vib(40); live.textContent = String(n); });
      const sc = reduced ? 1 : (f < .35 ? .6 + easeBack(f / .35) * .4 : 1);
      text(String(n), cx, H * .28, Math.min(160, W * .38), "#fff", 800, 1 - clamp((f - .7) / .3), sc);
      balloon(cx, H * (.85 - .4 * clamp(t / 3)), baseR * .4, 0);
    }

    // ---- şişirme 3-13
    let fill = clamp(shown.total / target);
    if (t >= 12) fill = Math.max(fill, clamp(fill + (t - 12)));
    if (t >= 3 && t < 17) {
      once("fan", t, 3, () => { sfx.fanfare(); vib([30, 40, 30]); live.textContent = S.show_tap; });
      if (t < 13) {
        const rate = .5 - (t - 3) / 10 * .33;
        if (t - lastKick > rate) { lastKick = t; sfx.kick(); }
      }
      bounce *= .85;
      let sc = .4 + .6 * (t >= 13 ? 1 : fill);
      let ox = 0, oy = 0;
      if (t >= 13 && t < 16 && !reduced) { const a = 3 + (t - 13) / 3 * 5; ox = (Math.random() - .5) * a * 2; oy = (Math.random() - .5) * a * 2; }
      if (t >= 16) sc *= 1 + .08 * clamp((t - 16) / 1);
      if (!reduced || t < 13) balloon(cx + ox, cy + oy, baseR * sc * (1 + bounce * .03), reduced ? 0 : bounce);
      else balloon(cx, cy, baseR * sc, 0);

      if (t < 13) {
        text(S.show_tap, cx, H * .1, Math.min(30, W * .075), C.goldHi, 800);
        const people = taps.people;
        text(`${Math.round(shown.total)} ${S.show_taps} · ${people} ${S.show_people}`, cx, H * .86, Math.min(22, W * .055), "#fff", 800);
        // ilerleme çubuğu
        const bw = W * .7, bx = (W - bw) / 2, by = H * .9;
        g.fillStyle = "rgba(255,255,255,.15)"; roundRect(bx, by, bw, 12, 6); g.fill();
        g.fillStyle = C.gold; roundRect(bx, by, bw * fill, 12, 6); g.fill();
        if (t >= 8 && taps.top && taps.top.length) {
          text(S.show_fastest + " " + taps.top.slice(0, 3).map(x => `${x[0]} ${x[1]}`).join(" · "), cx, H * .16, Math.min(15, W * .04), "rgba(255,255,255,.8)", 700);
        }
      } else if (t < 16) {
        once("yeter", t, 13, () => { live.textContent = S.show_enough; });
        text(S.show_enough, cx, H * .12, Math.min(30, W * .075), "#fff", 800);
        if (t - lastSnare > .03) { lastSnare = t; sfx.snare(.05 + (t - 13) / 3 * .18); }
        if (t - lastHeart > .6) { lastHeart = t; sfx.heart(); vib([60, 80, 60]); }
        once("sweep", t, 13, () => sfx.sweep());
        const ph = Math.floor((t - 13) / .75) % 2;
        text(ph ? S.show_blue_q : S.show_pink_q, cx, H * .82, Math.min(24, W * .06), ph ? C.blue : C.pink, 800, .9);
        if (!reduced) {
          const v = .3 + .25 * Math.abs(Math.sin((t - 13) * Math.PI / .6));
          const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * .3, cx, cy, Math.max(W, H) * .8);
          vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${v})`);
          g.fillStyle = vg; g.fillRect(0, 0, W, H);
        }
      }
    }

    // ---- patlama 17
    if (t >= 17) {
      once("boom", t, 17, () => {
        sfx.boom(); vib([200, 50, 100]);
        if (!reduced) {
          for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; shards.push({ x: cx, y: cy, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, r: Math.random() * 6, vr: (Math.random() - .5) * .5, s: 10 + Math.random() * 14 }); }
        }
      });
      once("conf1", t, 17.3, () => { burst(reduced ? 20 : 150, false); sfx.celebrate(girl); live.textContent = (girl ? S.girl_big : S.boy_big) + " " + opts.babyName; });
      once("conf2", t, 18.5, () => burst(reduced ? 15 : 100, true));
      const k = clamp((t - 17) / .6);
      const ease = 1 - Math.pow(1 - k, 4);
      // renk yayılması
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, girl ? "#FFB3CF" : "#A6D9FF"); bg.addColorStop(1, resColor);
      g.fillStyle = bg;
      if (reduced) { g.globalAlpha = k; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      else { g.beginPath(); g.arc(cx, cy, ease * Math.hypot(W, H), 0, Math.PI * 2); g.fill(); }
      // flaş
      if (!reduced && t < 17.25) { g.fillStyle = `rgba(255,255,255,${1 - (t - 17) / .25})`; g.fillRect(0, 0, W, H); }
      // ışınlar
      if (!reduced) {
        g.save(); g.translate(cx, H * .36); g.rotate(t * .15);
        g.fillStyle = "rgba(255,255,255,.14)";
        for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, Math.max(W, H)); g.lineTo(40, Math.max(W, H)); g.fill(); }
        g.restore();
      }
      if (t >= 17.3) {
        const k2 = clamp((t - 17.3) / .7);
        const big = girl ? S.girl_big : S.boy_big;
        const size = Math.min(130, W * (big.length > 5 ? .2 : .24));
        const yy = H * .36 - clamp((t - 20) / .6) * H * .06;
        g.save(); g.shadowColor = "rgba(43,33,64,.25)"; g.shadowBlur = 20; g.shadowOffsetY = 8;
        text(big, cx, yy, size, "#fff", 800, clamp(k2 * 3), reduced ? 1 : .3 + easeBack(k2) * .7);
        g.restore();
        const line = (girl ? S.show_girl_line : S.show_boy_line).replace("%s", opts.babyName);
        text(line, cx, yy + size * .7, Math.min(24, W * .058), resDeep, 800, clamp((t - 17.8) / .5));
      }
      if (t >= 20) {
        const a = clamp((t - 20) / .5);
        const cc = Math.round(opts.correctCount() * clamp((t - 20) / .8));
        text(S.show_correct.replace("%d", cc), cx, H * .62, Math.min(26, W * .065), C.ink, 800, a);
        if (opts.myPick) {
          const right = opts.myPick === result;
          once("me", t, 20, () => { if (right) { sfx.ding(); vib(80); } });
          text(right ? S.show_you_right : S.show_you_wrong, cx, H * .69, Math.min(20, W * .05), right ? resDeep : C.ink, 700, a);
        }
      }
    }

    // ---- parçacıklar
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.x += p.vx; p.y += p.vy; p.vy += .25; p.life -= .04;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      g.fillStyle = `rgba(255,224,138,${p.life})`; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill();
    }
    for (let i = plus.length - 1; i >= 0; i--) {
      const p = plus[i]; p.y -= 1.5; p.life -= .03;
      if (p.life <= 0) { plus.splice(i, 1); continue; }
      text("+1", p.x, p.y - 20, 22, `rgba(255,224,138,${p.life})`);
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const p = shards[i]; p.x += p.vx; p.y += p.vy; p.vy += .4; p.r += p.vr;
      if (p.y > H + 40) { shards.splice(i, 1); continue; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = C.gold;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(p.s, p.s * .3); g.lineTo(p.s * .4, p.s); g.fill(); g.restore();
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i]; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.vy = p.vy * .985 + .18; p.r += p.vr;
      if (p.y > H + 30) { confetti.splice(i, 1); continue; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.r * 2));
      g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }

    if (t >= END && !ended) { ended = true; finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  function roundRect(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function finish() {
    wrap.classList.add("out");
    setTimeout(stop, 600);
    opts.onEnd && opts.onEnd();
  }
  function stop() {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize); removeEventListener("keydown", onKey);
    wrap.remove(); document.body.classList.remove("noscroll");
  }
  raf = requestAnimationFrame(frame);
  return { stop };
}
