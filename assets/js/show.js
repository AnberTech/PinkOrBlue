// Açılış şovu, turlu: herkes dokunarak balonu şişirir. Kişi başı ortalama hedefe (33 dokunuş) ulaşılmazsa
// balonun havası söner, uçup gider ve yeni tur başlar; ulaşılınca gerilim → PAT → sonuç.
// Zaman: t = ms (revealAt'ten itibaren, sunucu saatine sabitlenmiş). Tur k: S(k) = 3 + 15k sn.
//   S..S+10 şişirme · S+10..S+11.5 "yetti mi?" · başarısız: S+11.5..S+15 sönme → S(k+1)
//   başarılı: S+11.5..S+14.5 gerilim · S+14.5..S+15.5 sessizlik · S+15.5 PAT · S+20.5 bitiş
import { sfx, vib, unlock, running } from "./sfx.js?v=202611161755";

const C = {
  pink: "#FF8FB8", pinkDeep: "#D6336C", blue: "#7EC8FF", blueDeep: "#1C6FB8",
  gold: "#F2B93B", goldHi: "#FFE08A", goldDeep: "#A8740A", cream: "#FFF8EE", ink: "#2B2140",
};
export const roundStart = (k) => 3 + 15 * k;          // sn
export const popTime = (k) => roundStart(k) + 15.5;   // sn
export const showEnd = (k) => popTime(k) + 5;         // sn

export function playShow(opts) {
  // opts: { root, getT, S, babyName, parents, getShow, getTaps(k), need(k), getResult, decide(k), onTap, myPick, correctCount, onEnd, soundWanted }
  const { root, getT, S } = opts;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wrap = document.createElement("div");
  wrap.className = "show";
  wrap.innerHTML = `<canvas></canvas>
    <div class="show-ui"><button class="btn btn-gold show-sound" hidden>${S.show_sound}</button></div>
    <p class="show-live" aria-live="assertive"></p>`;
  root.appendChild(wrap);
  document.body.classList.add("noscroll");
  const cv = wrap.querySelector("canvas"), g = cv.getContext("2d");
  const soundBtn = wrap.querySelector(".show-sound");
  const live = wrap.querySelector(".show-live");
  soundBtn.onclick = (e) => { e.stopPropagation(); unlock(true); soundBtn.hidden = true; };

  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = wrap.clientWidth; H = wrap.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  const fired = new Set();
  // Bir olayı tam zamanında ya da en fazla 0,6 sn gecikmeyle bir kez tetikle (geç gelen, geçmiş olayları duymasın)
  const once = (key, t, at, fn) => { if (fired.has(key)) return; if (t >= at && t < at + 0.6) { fired.add(key); fn(); } else if (t >= at + 0.6) fired.add(key); };
  let tapTimes = [], bounce = 0, lastKick = -1, lastSnare = -1, lastHeart = -1;
  const sparks = [], plus = [], shards = [], confetti = [];
  let shown = 0, popAnchor = null;
  const failAnchor = {}, flyFrom = {};

  const state = () => {
    const t = getT() / 1000, sh = opts.getShow() || {}, r = sh.r || {};
    let k = 0;
    while (r[k] && r[k].o === "fail" && t >= roundStart(k + 1) && k < 9) k++;
    return { t, k, tl: t - roundStart(k), out: r[k] || null, r };
  };

  function onPointer(e) {
    if (!running()) unlock();
    const { t, tl } = state();
    if (t < 3 || tl < 0 || tl >= 10) return;
    const now = performance.now();
    tapTimes = tapTimes.filter(x => now - x < 1000);
    if (tapTimes.length >= 15) return;
    tapTimes.push(now);
    opts.onTap && opts.onTap();
    bounce = 1;
    sfx.pump(); vib(10);
    const x = e.clientX ?? W / 2, y = e.clientY ?? H / 2;
    for (let i = 0; i < 4; i++) sparks.push({ x, y, vx: (Math.random() - .5) * 5, vy: -Math.random() * 5 - 1, life: 1 });
    plus.push({ x, y, life: 1 });
  }
  wrap.addEventListener("pointerdown", onPointer);
  const onKey = (e) => { if (e.code === "Space") { e.preventDefault(); onPointer({ clientX: W / 2, clientY: H / 2 }); } };
  addEventListener("keydown", onKey);

  function burst(n, fromTop, col, deep) {
    const cols = [col, deep, C.gold, C.goldHi, C.cream, "#fff"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 10;
      confetti.push(fromTop
        ? { x: Math.random() * W, y: -20 - Math.random() * H * .3, vx: (Math.random() - .5) * 2, vy: 1 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[i % cols.length], w: 6 + Math.random() * 6, h: 10 + Math.random() * 8 }
        : { x: W / 2, y: H * .45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], w: 6 + Math.random() * 6, h: 10 + Math.random() * 8 });
    }
  }

  function balloon(cx, cy, R, wobble, rot = 0, wrinkle = 0) {
    g.save();
    g.translate(cx, cy); g.rotate(rot);
    g.scale(1 - wobble * .06, 1 + wobble * .06);
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, R * 1.15);
    g.bezierCurveTo(R * .2, R * 1.45, -R * .2, R * 1.75, R * .05, R * 2.1); g.stroke();
    g.fillStyle = C.goldDeep;
    g.beginPath(); g.moveTo(-R * .09, R * 1.17); g.lineTo(R * .09, R * 1.17); g.lineTo(0, R * 1.06); g.fill();
    const grd = g.createRadialGradient(-R * .35, -R * .4, R * .1, 0, 0, R * 1.2);
    grd.addColorStop(0, C.goldHi); grd.addColorStop(.55, C.gold); grd.addColorStop(1, C.goldDeep);
    g.fillStyle = grd;
    g.beginPath();
    if (wrinkle > 0) {
      // sönen balon: kenarı buruşuk
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * Math.PI * 2, n = 1 - wrinkle * .12 * (1 + Math.sin(a * 7 + wrinkle * 9));
        const x = Math.cos(a) * R * .92 * n, y = Math.sin(a) * R * 1.1 * n;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
    } else g.ellipse(0, 0, R * .92, R * 1.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    g.beginPath(); g.ellipse(-R * .38, -R * .5, R * .14, R * .26, -.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(168,116,10,.35)";
    g.font = `800 ${R * .9}px "Baloo 2", system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("?", 0, R * .05);
    g.restore();
  }

  function text(s, x, y, size, color, weight = 800, alpha = 1, scale = 1) {
    if (!(alpha > 0)) return;
    g.save(); g.globalAlpha = Math.min(1, alpha); g.translate(x, y); g.scale(scale, scale);
    g.font = `${weight} ${size}px "Baloo 2", system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    const mw = W * .92 / scale, tw = g.measureText(s).width;
    if (tw > mw) g.font = `${weight} ${size * mw / tw}px "Baloo 2", system-ui`;
    g.fillStyle = color; g.fillText(s, 0, 0); g.restore();
  }
  function bar(fill, y, col = C.gold) {
    const bw = W * .7, bx = (W - bw) / 2;
    g.fillStyle = "rgba(255,255,255,.15)"; roundRect(bx, y, bw, 12, 6); g.fill();
    g.fillStyle = col; roundRect(bx, y, Math.max(12, bw * Math.max(0, Math.min(1, fill))), 12, 6); g.fill();
    g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(bx + bw - 2, y - 4, 2, 20);
  }
  const easeBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  let raf = 0, ended = false;
  function frame() {
    const st = state();
    const { t, k, tl, out } = st;
    const need = Math.max(1, opts.need(k));
    const tp = opts.getTaps(k);           // {round, people, top}
    shown += (tp.round - shown) * .25;
    const fill = clamp(shown / need);
    const cx = W / 2, cy = H * .45, baseR = Math.min(W, H) * .24;
    g.clearRect(0, 0, W, H);

    const result = opts.getResult();
    const isPop = !!out && out.o === "pop";
    // Patlama: kural sonucu patlamadan ~1,5 sn önce açar; sonuç geç gelirse sessizlik biraz uzar
    if (isPop && popAnchor == null && t >= popTime(k) && result) popAnchor = Math.max(popTime(k), t);
    const tp0 = popAnchor;
    const girl = result === "girl";
    const resColor = girl ? C.pink : C.blue, resDeep = girl ? C.pinkDeep : C.blueDeep;

    if (tp0 == null || t < tp0) {
      let dark = clamp((t + 6) / .4) * .8;
      if (isPop && tl >= 11.5) dark = .8 + clamp((tl - 11.5) / 3) * .15;
      g.fillStyle = `rgba(23,18,31,${dark})`; g.fillRect(0, 0, W, H);
      const sg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * .7);
      sg.addColorStop(0, "rgba(242,185,59,.18)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }

    soundBtn.hidden = running() || !(opts.soundWanted ?? true) || (tp0 != null);

    if (t < 0) {
      text(S.show_ready, cx, H * .3, Math.min(34, W * .08), "#fff");
      text(S.show_ready_sub, cx, H * .3 + 40, Math.min(18, W * .045), "rgba(255,255,255,.75)", 600);
      if (opts.parents) text(opts.parents, cx, H * .2, Math.min(18, W * .045), C.goldHi, 700);
      balloon(cx, H * .62, baseR * .35, Math.sin(t * 3) * .3);
    } else if (t < 3) {
      const n = 3 - Math.floor(t), f = t % 1;
      once("c" + n, t, 3 - n, () => { sfx.tick(n === 1); vib(40); live.textContent = String(n); });
      const sc = reduced ? 1 : (f < .35 ? .6 + easeBack(f / .35) * .4 : 1);
      text(String(n), cx, H * .28, Math.min(160, W * .38), "#fff", 800, 1 - clamp((f - .7) / .3), sc);
      balloon(cx, H * (.85 - .4 * clamp(t / 3)), baseR * .4, 0);
    } else if (tl < 10) {
      // ---- şişirme
      once("fan" + k, t, roundStart(k), () => { sfx.fanfare(); vib([30, 40, 30]); live.textContent = S.show_tap; });
      const rate = .5 - tl / 10 * .33;
      if (t - lastKick > rate) { lastKick = t; sfx.kick(); }
      bounce *= .85;
      balloon(cx, cy, baseR * (.4 + .6 * fill) * (1 + bounce * .03), reduced ? 0 : bounce);
      text(k ? fmt(S.show_round, k + 1) : S.show_tap, cx, H * .09, Math.min(30, W * .075), C.goldHi);
      text(fmt(S.show_need, Math.round(shown), need), cx, H * .835, Math.min(22, W * .055), "#fff");
      text(tp.people ? fmt(S.show_people_tapping, tp.people, Math.max(0, Math.ceil(10 - tl))) : fmt(S.show_secs, Math.max(0, Math.ceil(10 - tl))), cx, H * .872, Math.min(15, W * .04), "rgba(255,255,255,.7)", 700);
      bar(fill, H * .9);
      if (tl >= 4 && tp.top && tp.top.length) text(S.show_fastest + " " + tp.top.slice(0, 3).map(x => `${x[0]} ${x[1]}`).join(" · "), cx, H * .145, Math.min(15, W * .04), "rgba(255,255,255,.8)", 700);
    } else if (!out || tl < 11.5) {
      // ---- yetti mi?
      if (tl >= 10.6) opts.decide(k);
      once("yetti" + k, t, roundStart(k) + 10, () => { sfx.snare(.2); live.textContent = S.show_check; });
      balloon(cx, cy, baseR * (.4 + .6 * fill), reduced ? 0 : Math.sin(t * 20) * .25);
      text(S.show_check, cx, H * .12, Math.min(30, W * .075), "#fff");
      text(fmt(S.show_need, Math.round(shown), need), cx, H * .835, Math.min(22, W * .055), "#fff");
      bar(fill, H * .9);
    } else if (out.o === "fail") {
      // ---- havası söndü, uçup gidiyor
      if (failAnchor[k] == null) {
        failAnchor[k] = Math.max(roundStart(k) + 11.5, t);
        flyFrom[k] = .4 + .6 * clamp((out.t - (k ? (st.r[k - 1]?.t || 0) : 0)) / need);
      }
      const ft = t - failAnchor[k];
      once("fail" + k, t, failAnchor[k], () => { sfx.deflate(); vib([80, 40, 80]); live.textContent = S.show_fail; });
      const p = clamp(ft / 2.2);
      const sc = flyFrom[k] * (1 - .65 * p);
      const zx = reduced ? 0 : Math.sin(ft * 14) * W * .18 * p;
      const zy = -p * p * H * .75;
      balloon(cx + zx, cy + zy, baseR * sc, 0, reduced ? 0 : Math.sin(ft * 18) * .6 * p, p);
      if (!reduced && ft < 2.2) sparks.push({ x: cx + zx, y: cy + zy + baseR * sc * 1.1, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 2, life: .6, puff: 1 });
      text(S.show_fail, cx, H * .3, Math.min(40, W * .1), "#fff", 800, ft * 3);
      text(fmt(S.show_fail_sub, Math.round(shown), need), cx, H * .3 + 44, Math.min(18, W * .045), "rgba(255,255,255,.8)", 700, ft * 3 - .5);
      const left = roundStart(k + 1) - t;
      if (left < 1.6) text(fmt(S.show_again, Math.max(1, Math.ceil(left))), cx, H * .62, Math.min(34, W * .085), C.goldHi, 800, 1);
    } else if (tp0 == null || t < tp0) {
      // ---- başarılı: gerilim → sessizlik (sonuç bekleniyor)
      once("ok" + k, t, roundStart(k) + 11.5, () => { live.textContent = S.show_enough; sfx.fanfare(); });
      const tt = tl - 11.5;
      if (tt < 3) {
        if (t - lastSnare > .03) { lastSnare = t; sfx.snare(.05 + tt / 3 * .18); }
        if (t - lastHeart > .6) { lastHeart = t; sfx.heart(); vib([60, 80, 60]); }
        once("sweep" + k, t, roundStart(k) + 11.5, () => sfx.sweep());
      }
      let ox = 0, oy = 0;
      if (!reduced && tt < 3) { const a = 3 + tt / 3 * 5; ox = (Math.random() - .5) * a * 2; oy = (Math.random() - .5) * a * 2; }
      balloon(cx + ox, cy + oy, baseR * (1 + .08 * clamp(tt - 3)), 0);
      if (tt < 3) {
        text(S.show_enough, cx, H * .12, Math.min(30, W * .075), "#fff");
        const ph = Math.floor(tt / .75) % 2;
        text(ph ? S.show_blue_q : S.show_pink_q, cx, H * .82, Math.min(24, W * .06), ph ? C.blue : C.pink, 800, .9);
        if (!reduced) {
          const v = .3 + .25 * Math.abs(Math.sin(tt * Math.PI / .6));
          const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * .3, cx, cy, Math.max(W, H) * .8);
          vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${v})`);
          g.fillStyle = vg; g.fillRect(0, 0, W, H);
        }
      }
    } else {
      // ---- PAT ve sonuç
      const pt = t - tp0;
      once("boom", t, tp0, () => {
        sfx.boom(); vib([200, 50, 100]);
        if (!reduced) for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; shards.push({ x: cx, y: cy, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, r: Math.random() * 6, vr: (Math.random() - .5) * .5, s: 10 + Math.random() * 14 }); }
      });
      once("conf1", t, tp0 + .3, () => { burst(reduced ? 20 : 150, false, resColor, resDeep); sfx.celebrate(girl); live.textContent = (girl ? S.girl_big : S.boy_big) + " " + opts.babyName; });
      once("conf2", t, tp0 + 1.5, () => burst(reduced ? 15 : 100, true, resColor, resDeep));
      const k2 = clamp(pt / .6), ease = 1 - Math.pow(1 - k2, 4);
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, girl ? "#FFB3CF" : "#A6D9FF"); bg.addColorStop(1, resColor);
      g.fillStyle = bg;
      if (reduced) { g.globalAlpha = k2; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      else { g.beginPath(); g.arc(cx, cy, ease * Math.hypot(W, H), 0, Math.PI * 2); g.fill(); }
      if (!reduced && pt < .25) { g.fillStyle = `rgba(255,255,255,${1 - pt / .25})`; g.fillRect(0, 0, W, H); }
      if (!reduced) {
        g.save(); g.translate(cx, H * .36); g.rotate(t * .15);
        g.fillStyle = "rgba(255,255,255,.14)";
        for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, Math.max(W, H)); g.lineTo(40, Math.max(W, H)); g.fill(); }
        g.restore();
      }
      if (pt >= .3) {
        const k3 = clamp((pt - .3) / .7);
        const big = girl ? S.girl_big : S.boy_big;
        const size = Math.min(130, W * (big.length > 5 ? .2 : .24));
        const yy = H * .36 - clamp((pt - 3) / .6) * H * .06;
        g.save(); g.shadowColor = "rgba(43,33,64,.25)"; g.shadowBlur = 20; g.shadowOffsetY = 8;
        text(big, cx, yy, size, "#fff", 800, k3 * 3, reduced ? 1 : .3 + easeBack(k3) * .7);
        g.restore();
        text(fmt(girl ? S.show_girl_line : S.show_boy_line, opts.babyName), cx, yy + size * .7, Math.min(24, W * .058), resDeep, 800, (pt - .8) / .5);
        if (opts.parents) text(fmt(S.show_congrats, opts.parents), cx, yy + size * .7 + 34, Math.min(18, W * .045), C.ink, 700, (pt - 1.2) / .5);
      }
      if (pt >= 3) {
        const a = clamp((pt - 3) / .5);
        text(fmt(S.show_correct, Math.round(opts.correctCount() * clamp((pt - 3) / .8))), cx, H * .64, Math.min(26, W * .065), C.ink, 800, a);
        const mp = opts.myPick;
        if (mp) {
          const right = mp === result;
          once("me", t, tp0 + 3, () => { if (right) { sfx.ding(); vib(80); } });
          text(right ? S.show_you_right : S.show_you_wrong, cx, H * .71, Math.min(20, W * .05), right ? resDeep : C.ink, 700, a);
        }
      }
      if (pt >= 5 && !ended) { ended = true; draw(); finish(); return; }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  function draw() {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.x += p.vx; p.y += p.vy; p.vy += p.puff ? -.05 : .25; p.life -= .04;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      g.fillStyle = p.puff ? `rgba(255,255,255,${p.life * .5})` : `rgba(255,224,138,${p.life})`;
      g.beginPath(); g.arc(p.x, p.y, p.puff ? 6 : 3, 0, 7); g.fill();
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
  }
  function roundRect(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  const fmt = (s, ...a) => { let i = 0; return String(s).replace(/%[sd]/g, () => a[i++]); };
  function finish() {
    wrap.classList.add("out");
    setTimeout(stop, 600);
    opts.onEnd && opts.onEnd();
  }
  let stopped = false;
  function stop() {
    if (stopped) return; stopped = true;
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize); removeEventListener("keydown", onKey);
    wrap.remove(); document.body.classList.remove("noscroll");
  }
  raf = requestAnimationFrame(frame);
  return { stop };
}
