// PinkOrBlue uygulama ekranları: oda oluştur, katıl, bekleme salonu, kurucu paneli, şov, sonuç.
import * as fb from "./fb.js";
import { playShow } from "./show.js";
import { playGame } from "./game.js";
import { unlock, setOn, isOn, running, sfx } from "./sfx.js";

const S = window.POB_S;
const LANG = document.documentElement.lang;
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s, ...a) => { let i = 0; return s.replace(/%[sd]/g, () => a[i++]); };
const SHOW_LEAD = 6000, SHOW_LEN = 22000;
const ASSET = new URL("../", import.meta.url).href; // .../assets/

// ---------------------------------------------------------------- yardımcılar
const PALETTE = ["#E9B949", "#7FD1AE", "#FFB38A", "#B9A3E3", "#F08A7E", "#A3B86C", "#7FA7A8", "#D9BF8C"];
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function initials(n) {
  const p = n.trim().split(/\s+/).filter(Boolean);
  const s = (p[0]?.[0] || "?") + (p.length > 1 ? p[p.length - 1][0] : "");
  return s.toLocaleUpperCase(LANG);
}
function toast(msg) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.classList.add("in"), 10);
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 400); }, 2400);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast(S.copied); }
  catch (e) { prompt(S.copy_manual, text); }
}
async function share(text, url) {
  if (navigator.share) { try { await navigator.share({ title: "PinkOrBlue", text, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copy(url);
}
function fmtDate(ms) {
  try { return new Intl.DateTimeFormat(LANG, { dateStyle: "long", timeStyle: "short" }).format(new Date(ms)); }
  catch (e) { return new Date(ms).toLocaleString(LANG); }
}
function countdown(ms) {
  const d = ms - fb.serverNow();
  if (d <= 0) return S.lobby_any_moment;
  const h = Math.floor(d / 3600000), m = Math.floor(d % 3600000 / 60000);
  if (h >= 48) return fmt(S.lobby_in_days, Math.floor(h / 24));
  return fmt(S.lobby_in_hm, h, m);
}
function shortDate(s) {
  if (!s) return "–";
  const d = new Date(s + "T12:00:00");
  if (isNaN(d)) return "–";
  try { return new Intl.DateTimeFormat(LANG, { day: "numeric", month: "short" }).format(d); } catch (e) { return s; }
}
const roomUrl = (id) => location.origin + location.pathname + "#r=" + id;
const roomId = () => (location.hash.match(/r=([a-z0-9]{6,20})/) || [])[1] || null;
function setRemembered(id, name) { try { localStorage.setItem("pob_name_" + id, name); } catch (e) {} }

// ses düğmesi (sağ üst)
const soundBtn = $("#sound");
function paintSound() { soundBtn.textContent = isOn() ? "🔊" : "🔇"; soundBtn.setAttribute("aria-label", isOn() ? S.sound_off : S.sound_on); soundBtn.classList.toggle("needs", isOn() && !running()); }
soundBtn.onclick = () => { setOn(!isOn()); if (isOn()) unlock(); paintSound(); };
// iOS Safari sesi yalnız "dokunma bitti / tıklama" olaylarında açar (pointerdown sayılmaz)
["pointerdown", "touchend", "click", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (isOn() && !running()) { unlock(); setTimeout(paintSound, 150); } }, { passive: true, capture: true }));
paintSound();

// ---------------------------------------------------------------- oluştur
function viewCreate() {
  document.body.dataset.view = "create";
  const def = new Date(Date.now() + 86400000); def.setHours(20, 0, 0, 0);
  const local = new Date(def - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  app.innerHTML = `
  <form class="card form" id="cf" autocomplete="off">
    <label>${S.c_your_name}<input name="host" required maxlength="40" placeholder="${S.c_your_name_ph}"></label>
    <label>${S.c_baby}<input name="baby" required maxlength="40" placeholder="${S.c_baby_ph}"><small>${S.c_baby_hint}</small></label>
    <label>${S.c_date}<input name="date" type="datetime-local" required value="${local}"><small>${S.c_date_hint}</small></label>
    <label>${S.c_invitees} <em>${S.optional}</em><textarea name="inv" rows="5" placeholder="${S.c_invitees_ph}"></textarea><small>${S.c_invitees_hint}</small></label>
    <button class="btn btn-gold btn-big" type="submit">${S.c_submit}</button>
    <p class="muted center">${S.c_note}</p>
  </form>`;
  $("#cf").onsubmit = async (ev) => {
    ev.preventDefault();
    unlock();
    const f = new FormData(ev.target);
    const btn = ev.target.querySelector("button"); btn.disabled = true; btn.textContent = S.wait;
    try {
      const partyAt = new Date(f.get("date")).getTime();
      if (!(partyAt > Date.now() - 3600000)) throw new Error(S.c_err_date);
      const invitees = String(f.get("inv") || "").split(/[\n,]/).map(s => s.trim().slice(0, 40)).filter(Boolean).slice(0, 80);
      const host = String(f.get("host")).trim();
      const id = await fb.createRoom({ babyName: String(f.get("baby")).trim(), partyAt, lang: LANG, invitees: [...new Set(invitees)], hostName: host });
      setRemembered(id, host);
      history.replaceState(null, "", "#r=" + id);
      route(true);
    } catch (e) {
      console.error(e); toast(e.message && !e.code ? e.message : S.err_generic);
      btn.disabled = false; btn.textContent = S.c_submit;
    }
  };
}

// ---------------------------------------------------------------- oda
let room = null; // canlı durum
function cleanupRoom() { if (room) { room.unsubs.forEach(u => u && u()); clearInterval(room.timer); if (room.showCtl) room.showCtl.stop(); if (room.game) room.game.abort(); room = null; } }

async function viewRoom(id, justCreated) {
  document.body.dataset.view = "room";
  app.innerHTML = `<div class="card center"><p>${S.loading}</p></div>`;
  const uid = await fb.ready;
  cleanupRoom();
  const R = room = { id, uid, meta: null, guests: {}, invitees: {}, presence: {}, taps: {}, scores: {}, votes: null, mine: null, sealed: null, unsubs: [], showing: false, shown: false, justCreated, drafts: {} };
  // Önce kişisel ve liste verileri yüklensin; meta (ve dolayısıyla şov) en son. Böylece şov sırasında
  // sayfayı yenileyen misafirin tahmini ve dokunma yetkisi eksik kalmaz.
  const first = (path) => new Promise(res => { let done = false; R.unsubs.push(fb.watch(id, path, v => { R[key(path)] = v || (path.includes("/") ? null : {}); if (!done) { done = true; res(); } else if (room === R) render(); })); });
  const key = (p) => ({ ["votes/" + uid]: "mine", ["sealed/" + uid]: "sealed" }[p] || p);
  await Promise.all(["guests", "invitees", "presence", "scores", "votes/" + uid, "sealed/" + uid].map(first));
  if (room !== R) return;
  R.unsubs.push(fb.watch(id, "taps", v => { R.taps = v || {}; }));
  R.unsubs.push(fb.watch(id, "meta", (m) => {
    if (room !== R) return;
    const prev = R.meta; R.meta = m;
    if (!m) return renderMissing();
    if (m.status === "reveal" && (!prev || prev.status !== "reveal")) onReveal();
    render();
  }));
  R.timer = setInterval(() => { const el = $("#cd"); if (el && R.meta) el.textContent = countdown(R.meta.partyAt); }, 20000);
}

function renderMissing() {
  app.innerHTML = `<div class="card center"><div class="big-emoji">🎈</div><h2>${S.missing_h}</h2><p>${S.missing_p}</p>
  <a class="btn btn-gold" href="${location.pathname}">${S.missing_btn}</a></div>`;
}

const me = () => room.guests[room.uid];
const isHost = () => room.meta && room.meta.hostUid === room.uid;
const isRevealer = () => room.meta && room.meta.revealerUid === room.uid;

let deferred = false;
function render() {
  if (!room || !room.meta) return;
  if (room.showing) return;
  const ae = document.activeElement;
  if (ae && app.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.type !== "button") {
    if (!deferred) { deferred = true; ae.addEventListener("blur", () => { deferred = false; setTimeout(render, 50); }, { once: true }); }
    return;
  }
  const open = [...app.querySelectorAll("details[open]")].map(d => d.className);
  // Kaydedilmemiş form girişlerini koru (başkası katılınca ekran yeniden çizilir)
  app.querySelectorAll("input[name], textarea[id], textarea[name]").forEach(el => {
    const k = el.name || el.id;
    if (el.value !== el.defaultValue) room.drafts[k] = el.value; else delete room.drafts[k];
  });
  const y = scrollY;
  renderInner();
  open.forEach(c => { const d = app.querySelector("details." + c.split(" ")[0]); if (d) d.open = true; });
  Object.entries(room.drafts).forEach(([k, v]) => { const el = app.querySelector(`[name="${k}"],textarea#${k}`); if (el && !el.readOnly) el.value = v; });
  if (Math.abs(scrollY - y) > 2) scrollTo(0, y);
}
function renderInner() {
  const m = room.meta;
  if (m.status === "reveal" && room.shown) return renderResult();
  if (m.status === "reveal") return; // şov başlamak üzere
  if (!me()) return renderJoin();
  renderLobby();
}

function renderJoin() {
  const m = room.meta;
  const taken = new Set(Object.values(room.guests).map(g => g.name.toLocaleLowerCase(LANG)));
  const free = Object.values(room.invitees).filter(n => !taken.has(n.toLocaleLowerCase(LANG)));
  app.innerHTML = `
  <div class="card center join">
    <p class="eyebrow">${S.j_eyebrow}</p>
    <h1 class="room-title">${fmt(S.j_title, esc(m.babyName))}</h1>
    <p class="muted">${esc(fmtDate(m.partyAt))}</p>
    ${free.length ? `<p class="lbl">${S.j_pick}</p><div class="chips pick">${free.map(n => `<button type="button" class="chip" data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div><p class="muted small">${S.j_or}</p>` : ""}
    <form id="jf"><input name="n" maxlength="40" required placeholder="${S.j_name_ph}"><button class="btn btn-gold btn-big" type="submit">${S.j_submit}</button></form>
  </div>`;
  const inp = $("#jf input");
  const mark = () => app.querySelectorAll(".pick .chip").forEach(x => x.classList.toggle("on", x.dataset.n === inp.value));
  if (room.joinDraft) { inp.value = room.joinDraft; mark(); }
  inp.oninput = () => { room.joinDraft = inp.value; mark(); };
  app.querySelectorAll(".pick .chip").forEach(b => b.onclick = () => { inp.value = room.joinDraft = b.dataset.n; mark(); });
  $("#jf").onsubmit = async (ev) => {
    ev.preventDefault(); unlock(); paintSound();
    const n = inp.value.trim(); if (!n) return;
    try { await fb.join(room.id, n); setRemembered(room.id, n); sfx.plop(); document.activeElement?.blur(); render(); }
    catch (e) { console.error(e); toast(S.err_generic); }
  };
}

function people() {
  const online = room.presence;
  return Object.entries(room.guests).map(([uid, g]) => ({ uid, name: g.name, voted: !!g.voted || uid === room.meta.revealerUid, keeper: uid === room.meta.revealerUid, online: !!online[uid], me: uid === room.uid, host: uid === room.meta.hostUid }))
    .sort((a, b) => (b.voted - a.voted) || a.name.localeCompare(b.name, LANG));
}

let presenceStarted = false;
function renderLobby() {
  if (!presenceStarted) { presenceStarted = true; fb.presence(room.id); }
  const m = room.meta, ps = people();
  const voters = ps.filter(p => p.uid !== m.revealerUid); // sırrı tutan oy vermez
  const votedN = voters.filter(p => p.voted).length;
  const joinedNames = new Set(ps.map(p => p.name.toLocaleLowerCase(LANG)));
  const notJoined = Object.values(room.invitees).filter(n => !joinedNames.has(n.toLocaleLowerCase(LANG)));
  const notVoted = voters.filter(p => !p.voted).map(p => p.name);
  const expected = voters.length + notJoined.length;
  const scores = Object.entries(room.scores).map(([u, x]) => ({ name: room.guests[u]?.name || x.name, score: x.score })).sort((a, b) => b.score - a.score).slice(0, 5);
  const myBest = room.scores[room.uid]?.score;
  const url = roomUrl(room.id);

  // Var olan gökyüzünü koru (balonlar her güncellemede baştan zıplamasın)
  app.innerHTML = `
  <header class="room-head">
    <p class="eyebrow">${S.lobby_eyebrow}</p>
    <h1 class="room-title">${fmt(S.lobby_title, esc(m.babyName))}</h1>
    <p class="cd"><span id="cd">${countdown(m.partyAt)}</span> · ${esc(fmtDate(m.partyAt))}</p>
  </header>
  <section class="sky" aria-label="${S.lobby_sky}">${ps.map(balloonHtml).join("") || `<p class="muted">${S.lobby_empty}</p>`}</section>
  <section class="card status">
    <div class="row"><b>${fmt(S.lobby_voted, votedN, expected)}</b><span class="muted">${fmt(S.lobby_online, ps.filter(p => p.online).length)}</span></div>
    <div class="bar"><i style="width:${expected ? Math.round(votedN / expected * 100) : 0}%"></i></div>
    <p class="muted small">${S.lobby_secret}</p>
  </section>
  ${hostPanel(url)}
  ${revealerPanel()}
  ${voteCard()}
  <section class="card game-card">
    <div class="row"><h2>🎈 ${S.game_name}</h2>${myBest != null ? `<span class="muted">${fmt(S.game_best, myBest)}</span>` : ""}</div>
    <p class="muted">${S.game_teaser}</p>
    ${scores.length ? `<ol class="board">${scores.map(s => `<li><span>${esc(s.name)}</span><b>${s.score}</b></li>`).join("")}</ol>` : ""}
    <button class="btn btn-gold" id="play">${S.game_play}</button>
  </section>
  ${(notVoted.length || notJoined.length) ? `<section class="card waiting"><h2>${S.lobby_waiting}</h2>
    <div class="chips">${notVoted.map(n => `<span class="chip ghost">${esc(n)}</span>`).join("")}${notJoined.map(n => `<span class="chip ghost dashed">${esc(n)}</span>`).join("")}</div>
    ${notJoined.length ? `<p class="muted small">${S.lobby_dashed}</p>` : ""}</section>` : ""}
  <section class="card share-card"><h2>${S.share_h}</h2><p class="muted small">${S.share_p}</p>
    <div class="link-row"><input readonly value="${esc(url)}" aria-label="${S.share_h}"><button class="btn" id="cp">${S.copy}</button></div>
    <div class="row gap"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(fmt(S.share_text, m.babyName) + " " + url)}">WhatsApp</a><button class="btn" id="sh">${S.share_more}</button></div>
  </section>`;
  bindLobby(url);
}

function balloonHtml(p) {
  const h = hash(p.name);
  const col = PALETTE[h % PALETTE.length];
  const delay = -(h % 5000) / 1000, dur = 3 + (h % 3000) / 1000;
  return `<button type="button" class="balloon ${p.voted ? "voted" : ""} ${p.online ? "on" : ""} ${p.me ? "me" : ""}" style="--d:${delay}s;--dur:${dur}s" data-tip="${esc(p.name)} · ${p.voted ? S.tip_voted : S.tip_not_voted}${p.online ? " · " + S.tip_here : ""}">
    <span class="bb"><span class="av" style="background:${col}">${esc(initials(p.name))}</span></span><span class="str"></span>
    <span class="nm">${p.keeper ? "🤫 " : ""}${p.me ? S.you : esc(p.name.split(" ")[0])}</span></button>`;
}

function voteCard() {
  if (isRevealer()) return "";
  const v = room.mine;
  return `<section class="card vote" id="vote">
    <h2>${v ? S.v_yours : S.v_h}</h2>
    <div class="vote-btns">
      <button class="vb girl ${v?.pick === "girl" ? "on" : ""}" data-p="girl"><span class="vi">🎀</span>${S.girl}</button>
      <button class="vb boy ${v?.pick === "boy" ? "on" : ""}" data-p="boy"><span class="vi">🎩</span>${S.boy}</button>
    </div>
    <details class="guesses" ${v && !v.birth && !v.weight && !v.letter ? "" : ""}>
      <summary>${S.v_more}</summary>
      <label>${S.v_birth}<input type="date" name="birth" value="${esc(v?.birth || "")}"></label>
      <label>${S.v_weight}<input type="number" name="weight" min="500" max="7000" step="10" inputmode="numeric" placeholder="3250" value="${esc(v?.weight || "")}"></label>
      <label>${S.v_letter}<input name="letter" maxlength="1" value="${esc(v?.letter || "")}"></label>
      <button class="btn" id="saveg">${S.v_save}</button>
    </details>
    <p class="muted small">${S.v_private}</p>
  </section>`;
}

function hostPanel(url) {
  if (!isHost()) return "";
  const m = room.meta, ps = people().filter(p => !p.me);
  const delegated = m.revealerUid !== room.uid;
  const who = delegated ? room.guests[m.revealerUid]?.name : null;
  return `<section class="card host">
    <p class="eyebrow">👑 ${S.h_eyebrow}</p>
    ${room.justCreated ? `<p class="ok">${S.h_created}</p>` : ""}
    <p class="muted small">${S.h_device}</p>
    <h3>${S.h_keeper}</h3>
    <label class="lbl">${S.h_keeper_lbl}
      <select id="keeper"><option value="${room.uid}">${S.h_keeper_me}</option>
      ${ps.map(p => `<option value="${p.uid}" ${p.uid === m.revealerUid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    ${delegated ? `<p class="small">${fmt(S.h_keeper_is, esc(who || "?"))}</p>` : ""}
    <details class="danger-zone"><summary>${S.h_more}</summary>
      <label class="lbl">${S.h_inv_edit}<textarea id="inv" rows="4">${esc(Object.values(room.invitees).join("\n"))}</textarea></label>
      <button class="btn" id="saveinv">${S.h_inv_save}</button>
      <button class="btn btn-danger" id="del">${S.h_delete}</button>
    </details>
  </section>`;
}

function revealerPanel() {
  if (!isRevealer()) return "";
  const s = room.sealed;
  const ps = people(), votedN = ps.filter(p => p.voted).length, onN = ps.filter(p => p.online).length;
  return `<section class="card keeper">
    <p class="eyebrow">🤫 ${S.k_eyebrow}</p>
    <h2>${isHost() ? S.k_h_host : S.k_h_guest}</h2>
    <p class="muted small">${S.k_p}</p>
    <div class="vote-btns seal">
      <button class="vb girl ${s === "girl" ? "on" : ""}" data-s="girl"><span class="vi">🎀</span>${S.girl}</button>
      <button class="vb boy ${s === "boy" ? "on" : ""}" data-s="boy"><span class="vi">🎩</span>${S.boy}</button>
    </div>
    ${s ? `<p class="ok small">${S.k_sealed}</p>` : ""}
    <button class="btn btn-gold btn-big start" id="start" ${s ? "" : "disabled"}>🎉 ${S.k_start}</button>
    <p class="muted small center">${fmt(S.k_status, votedN, onN)}</p>
  </section>`;
}

function bindLobby(url) {
  app.querySelectorAll(".balloon").forEach(b => b.onclick = () => { toast(b.dataset.tip); b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop"); });
  app.querySelectorAll(".vote .vb").forEach(b => b.onclick = async () => {
    const pick = b.dataset.p;
    const next = Object.assign({}, room.mine || {}, { pick });
    try { await fb.vote(room.id, clean(next)); room.mine = next; sfx.plop(); toast(pick === "girl" ? S.v_done_girl : S.v_done_boy); render(); }
    catch (e) { console.error(e); toast(S.err_generic); }
  });
  const sg = $("#saveg");
  if (sg) sg.onclick = async () => {
    const box = sg.closest(".guesses");
    const next = Object.assign({}, room.mine || {});
    if (!next.pick) return toast(S.v_pick_first);
    const b = box.querySelector("[name=birth]").value, w = parseInt(box.querySelector("[name=weight]").value, 10), l = box.querySelector("[name=letter]").value.trim();
    if (b) next.birth = b; else delete next.birth;
    if (w >= 500 && w <= 7000) next.weight = w; else delete next.weight;
    if (l) next.letter = l.toLocaleUpperCase(LANG); else delete next.letter;
    try { await fb.vote(room.id, clean(next)); room.mine = next; toast(S.v_saved); } catch (e) { console.error(e); toast(S.err_generic); }
  };
  app.querySelectorAll(".seal .vb").forEach(b => b.onclick = async () => {
    try { await fb.seal(room.id, b.dataset.s); room.sealed = b.dataset.s; sfx.plop(); render(); } catch (e) { console.error(e); toast(S.err_generic); }
  });
  const st = $("#start");
  if (st) st.onclick = async () => {
    if (!confirm(S.k_confirm)) return;
    unlock(); st.disabled = true;
    // Çevrimdışıyken başlatma: yerel şov açılır ama sunucu reddeder, diğerleri görmez
    if (!fb.isConnected()) { toast(S.k_offline); st.disabled = false; return; }
    const R = room;
    try { await fb.startReveal(R.id, R.sealed, SHOW_LEAD); }
    catch (e) {
      console.error(e); toast(S.err_generic);
      if (R.showCtl) { R.showCtl.stop(); R.showCtl = null; }
      R.showing = false; location.reload();
    }
  };
  const kp = $("#keeper");
  if (kp) kp.onchange = async () => {
    if (kp.value !== room.uid && !confirm(S.h_keeper_confirm)) { kp.value = room.meta.revealerUid; return; }
    try { await fb.delegate(room.id, kp.value); } catch (e) { console.error(e); toast(S.err_generic); }
  };
  const si = $("#saveinv");
  if (si) si.onclick = async () => {
    const names = [...new Set($("#inv").value.split(/[\n,]/).map(s => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 80);
    try { await fb.setInvitees(room.id, names); toast(S.saved); } catch (e) { console.error(e); toast(S.err_generic); }
  };
  const del = $("#del");
  if (del) del.onclick = async () => {
    if (!confirm(S.h_delete_confirm)) return;
    try { await fb.deleteRoom(room.id); cleanupRoom(); location.hash = ""; route(); } catch (e) { console.error(e); toast(S.err_generic); }
  };
  $("#cp").onclick = () => copy(url);
  $("#sh").onclick = () => share(fmt(S.share_text, room.meta.babyName), url);
  $("#play").onclick = () => {
    room.game = playGame({ root: document.body, S, onEnd: async (score) => {
      room.game = null;
      if (score != null && room) { try { await fb.setScore(room.id, me().name, score); } catch (e) {} toast(fmt(S.game_result, score)); }
    } });
  };
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// ---------------------------------------------------------------- açılış
async function onReveal() {
  const m = room.meta;
  if (room.game) room.game.abort();
  const late = fb.serverNow() - m.revealAt;
  // Oylar artık okunabilir
  room.unsubs.push(fb.watch(room.id, "votes", v => { room.votes = v || {}; if (room.shown && !room.showing) render(); }));
  if (late > SHOW_LEN) { room.shown = true; render(); return; }
  runShow(false);
}

function runShow(local) {
  const m = room.meta, R = room;
  room.showing = true;
  const localStart = performance.now();
  const getT = local ? () => performance.now() - localStart - 1500 : () => fb.serverNow() - m.revealAt;
  let lastSent = 0, pending = 0, sendT = null;
  const canTap = () => !local && room === R && !!R.guests[R.uid];
  R.showCtl = playShow({
    root: document.body, getT, result: m.result, babyName: m.babyName, S,
    get myPick() { return R.mine?.pick; },
    soundWanted: isOn(),
    correctCount: () => Object.values(room.votes || {}).filter(v => v.pick === m.result).length,
    getTaps: () => {
      const entries = Object.entries(room.taps).filter(([, n]) => n > 0);
      const mine = pending;
      let total = 0;
      entries.forEach(([uid, n]) => { total += uid === room.uid ? Math.max(n, mine) : n; });
      if (!room.taps[room.uid] && mine) total += mine;
      const top = entries.map(([uid, n]) => [room.guests[uid]?.name?.split(" ")[0] || "?", uid === room.uid ? Math.max(n, mine) : n]).sort((a, b) => b[1] - a[1]);
      return { total, people: entries.length + (!room.taps[room.uid] && mine ? 1 : 0), top, expected: Object.keys(room.presence).length || 1 };
    },
    onTap: (n) => {
      pending = n;
      if (!canTap()) return;
      const now = performance.now();
      const send = () => { lastSent = performance.now(); sendT = null; if (room === R) fb.setTaps(R.id, pending).catch(() => {}); };
      if (now - lastSent > 400) send(); else if (!sendT) sendT = setTimeout(send, 400 - (now - lastSent));
    },
    onEnd: () => { R.showing = false; R.shown = true; R.showCtl = null; if (room === R) render(); },
  });
}

function renderResult() {
  const m = room.meta, girl = m.result === "girl";
  const votes = room.votes || {};
  const list = Object.entries(votes).map(([uid, v]) => ({ uid, name: room.guests[uid]?.name || "?", ...v }));
  const right = list.filter(v => v.pick === m.result), nG = list.filter(v => v.pick === "girl").length, nB = list.filter(v => v.pick === "boy").length;
  const tot = nG + nB, pct = tot ? Math.round(right.length / tot * 100) : 0;
  const R = 46, Cc = 2 * Math.PI * R, gLen = tot ? Cc * nG / tot : 0;
  const scores = Object.entries(room.scores).map(([u, x]) => ({ name: room.guests[u]?.name || x.name, score: x.score })).sort((a, b) => b.score - a.score);
  const taps = Object.entries(room.taps).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const tapTotal = taps.reduce((s, [, n]) => s + n, 0);
  const guesses = list.filter(v => v.birth || v.weight || v.letter);
  const mine = room.mine?.pick;
  app.innerHTML = `
  <article class="result ${girl ? "is-girl" : "is-boy"}" id="rc">
    <header class="r-top"><p class="r-brand">Pink<span>Or</span>Blue</p><h1>${girl ? S.girl_big : S.boy_big}</h1>
      <p>${esc(fmt(girl ? S.show_girl_line : S.show_boy_line, m.babyName))}</p><p class="small">${esc(fmtDate(m.partyAt))}</p></header>
    ${mine ? `<p class="r-me ${mine === m.result ? "yes" : ""}">${mine === m.result ? S.show_you_right : S.show_you_wrong}</p>` : ""}
    <section class="r-pie">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--blue)" stroke-width="18"/>
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--pink)" stroke-width="18" stroke-dasharray="${gLen} ${Cc}" transform="rotate(-90 60 60)" class="pie-g" style="--len:${gLen}"/></svg>
      <div><p class="r-pct">${fmt(S.r_pct, pct)}</p><p>🎀 ${S.girl} <b>${nG}</b> · 🎩 ${S.boy} <b>${nB}</b></p></div>
    </section>
    <section><h2>${fmt(S.r_right, right.length)}</h2>
      <div class="chips">${right.map(v => `<span class="chip res">${esc(v.name)}</span>`).join("") || `<span class="muted">${S.r_nobody}</span>`}</div></section>
    ${guesses.length ? `<section><h2>${S.r_guesses}</h2><table class="gtable"><thead><tr><th>${S.r_name}</th><th>${S.v_birth_s}</th><th>${S.v_weight_s}</th><th>${S.v_letter_s}</th></tr></thead><tbody>
      ${guesses.map(v => `<tr><td>${esc(v.name)}</td><td>${esc(shortDate(v.birth))}</td><td>${v.weight ? v.weight + " g" : "–"}</td><td>${esc(v.letter || "–")}</td></tr>`).join("")}</tbody></table></section>` : ""}
    <section class="r-badges">
      ${scores[0] ? `<span>🏆 ${fmt(S.r_champ, esc(scores[0].name), scores[0].score)}</span>` : ""}
      ${taps[0] ? `<span>👆 ${fmt(S.r_fastest, esc(room.guests[taps[0][0]]?.name || "?"), taps[0][1])}</span>` : ""}
      ${tapTotal ? `<span>🎈 ${fmt(S.r_total_taps, tapTotal)}</span>` : ""}
    </section>
    <footer class="r-maker"><img src="${ASSET}img/anbertech-ink.png" alt="" width="16" height="15">PinkOrBlue · ${S.brand_short}</footer>
  </article>
  <div class="r-actions">
    <button class="btn btn-gold" id="replay">▶ ${S.r_replay}</button>
    <button class="btn" id="rshare">${S.r_share}</button>
    <a class="btn" href="${location.pathname}">${S.r_new}</a>
  </div>
  <p class="muted small center">${S.r_expire}</p>`;
  $("#replay").onclick = () => { unlock(); runShow(true); };
  $("#rshare").onclick = () => share(fmt(girl ? S.r_share_text_girl : S.r_share_text_boy, m.babyName), roomUrl(room.id));
}

// ---------------------------------------------------------------- yönlendirme
function route(justCreated) {
  const id = roomId();
  if (id) viewRoom(id, justCreated === true);
  else { cleanupRoom(); viewCreate(); }
}
addEventListener("hashchange", () => route());
route();
