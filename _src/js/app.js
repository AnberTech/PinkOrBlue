// PinkOrBlue uygulama ekranları: oda oluştur, katıl, bekleme salonu, kurucu akışı, şov, sonuç.
import * as fb from "./fb.js";
import { playShow, roundStart, showEnd } from "./show.js";
import { playGame } from "./game.js";
import { unlock, setOn, isOn, running, sfx, level, audioState, revealReady } from "./sfx.js";
window.__pob = { level, audioState, revealReady };   // teşhis/test için (ses gerçekten üretiliyor mu)

const S = window.POB_S;
const LANG = document.documentElement.lang;
const INVITE = new URL(window.POB_INVITE || "./", location.href).pathname;   // davet sayfası (önizlemesi davete özel)
const CREATE = new URL(window.POB_CREATE || "./", location.href).pathname;   // oda kurma sayfası
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s, ...a) => { let i = 0; return String(s).replace(/%[sd]/g, () => a[i++]); };
const SHOW_LEAD = 6000;
const PER_PERSON = 33;                                    // kişi başı ortalama dokunuş hedefi
const ASSET = new URL("../", import.meta.url).href;
const lower = (s) => String(s).trim().toLocaleLowerCase(LANG);
// "ayşe nur", "MEHMET" → "Ayşe Nur", "Mehmet" (Türkçe i/İ doğru)
const capWord = (w) => w ? w[0].toLocaleUpperCase(LANG) + w.slice(1).toLocaleLowerCase(LANG) : w;
const titleCase = (s) => String(s).trim().replace(/\s+/g, " ").split(" ").map(w => w.split("-").map(capWord).join("-")).join(" ");
// Kısa adlar olduğu gibi; uzun adlarda ilk kelime ("Tante Anna" → "Tante Anna", "Ayşe Nur Yılmaz Kaya" → "Ayşe")
const shortName = (n) => { n = String(n || "").trim(); return n.length <= 14 ? n : n.split(" ")[0]; };

// ---------------------------------------------------------------- yardımcılar
const PALETTE = ["#E9B949", "#7FD1AE", "#FFB38A", "#B9A3E3", "#F08A7E", "#A3B86C", "#7FA7A8", "#D9BF8C"];
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function initials(n) {
  const p = n.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toLocaleUpperCase(LANG);
}
function toast(msg) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
  el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
  document.body.appendChild(el); setTimeout(() => el.classList.add("in"), 10);
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 400); }, 2600);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast(S.copied); return; } catch (e) {}
  try {   // Instagram/Facebook içi tarayıcılar ve eski WebView'lar
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy"); ta.remove();
    if (ok) { toast(S.copied); return; }
  } catch (e) {}
  prompt(S.copy_manual, (text.match(/https?:\/\/\S+/) || [text])[0]);
}
async function share(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copy(text);
}
const KU_M = ["Rêbendan", "Reşemî", "Adar", "Nîsan", "Gulan", "Pûşper", "Tîrmeh", "Gelawêj", "Rezber", "Kewçêr", "Sermawez", "Berfanbar"];
const KU_D = ["Yekşem", "Duşem", "Sêşem", "Çarşem", "Pêncşem", "În", "Şemî"];
// Tarayıcılarda Kurmancî tarih verisi yok (cihaz diline düşüyor): ay/gün adlarını kendimiz yazarız
function kuFormatter(o) {
  return { format(d) {
    const p = [];
    if (o.dateStyle || o.weekday) { if (o.weekday) p.push((o.weekday === "narrow" ? KU_D[d.getDay()][0] : o.weekday === "short" ? KU_D[d.getDay()].slice(0, 3) : KU_D[d.getDay()]) + ","); }
    if (o.dateStyle || o.day) p.push(d.getDate());
    if (o.dateStyle || o.month) p.push(o.month === "short" ? KU_M[d.getMonth()].slice(0, 3) : KU_M[d.getMonth()]);
    if (o.dateStyle || o.year) p.push(d.getFullYear());
    if (o.timeStyle || o.hour) p.push(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"));
    if (o.month === "long" && !o.day && !o.weekday) return KU_M[d.getMonth()] + " " + d.getFullYear();
    return p.join(" ");
  } };
}
const dtf = (o) => { if (LANG === "ku") return kuFormatter(o); try { return new Intl.DateTimeFormat(LANG, o); } catch (e) { return null; } };
const DF_LONG = dtf({ dateStyle: "long", timeStyle: "short" }), DF_DAY = dtf({ day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const DF_PICK = dtf({ weekday: "short", day: "numeric", month: "short", year: "numeric" }), DF_SHORT = dtf({ day: "numeric", month: "short" });
const DF_MONTH = dtf({ month: "long", year: "numeric" }), DF_WD = dtf({ weekday: "narrow" });
const pctFmt = (n) => { try { return new Intl.NumberFormat(LANG, { style: "percent" }).format(n / 100); } catch (e) { return n + "%"; } };
const fmtDate = (ms) => DF_LONG ? DF_LONG.format(new Date(ms)) : new Date(ms).toLocaleString(LANG);
function countdown(ms) {
  const d = ms - fb.serverNow();
  if (d <= 0) return S.lobby_any_moment;
  const h = Math.floor(d / 3600000), m = Math.floor(d % 3600000 / 60000);
  if (h >= 48) return fmt(S.lobby_in_days, Math.floor(h / 24));
  return fmt(S.lobby_in_hm, h, m);
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;   // 31 Şubat gibi tarihleri reddet
}
function shortDate(s) { const d = parseYmd(s); return d ? (DF_SHORT ? DF_SHORT.format(d) : s) : "–"; }
const roomUrl = (id) => location.origin + INVITE + "#r=" + id;
function roomId() {
  const m = (location.hash + "&" + location.search).match(/[#?&]r=([A-Za-z0-9]+)/);
  if (!m) return null;
  return m[1].toLowerCase();
}
const babyOf = (m) => m.babyName || S.default_baby;
// GoatCounter olay sayımı: dil koduyla ("pob/de/oda-acildi"); isim, oda kodu, oy asla gönderilmez
function track(ev) { try { window.goatcounter?.count?.({ path: "pob/" + LANG.toLowerCase() + "/" + ev, title: ev, event: true }); } catch (e) {} }
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const hostLink = (id, key) => location.origin + INVITE + "#r=" + id + "&k=" + key;
function shareText(m) {
  const when = DF_DAY ? DF_DAY.format(new Date(m.partyAt)) : fmtDate(m.partyAt);
  return (m.parents ? fmt(S.share_text, m.parents, when) : fmt(S.share_text_np, when)) + roomUrl(room.id);
}

// Dil bağlantıları aynı odayı korusun
function keepHashInLangLinks() {
  document.querySelectorAll(".lang-menu a").forEach(a => { a.href = a.href.split("#")[0] + (roomId() ? "#r=" + roomId() : ""); });
}

// ---------------------------------------------------------------- ses düğmesi
const soundBtn = $("#sound");
function paintSound() { soundBtn.textContent = isOn() ? "🔊" : "🔇"; soundBtn.setAttribute("aria-label", isOn() ? S.sound_off : S.sound_on); soundBtn.classList.toggle("needs", isOn() && !running()); }
soundBtn.onclick = () => {
  const on = !(isOn() && running());
  setOn(on); if (on) { unlock(); setTimeout(() => sfx.test(), 60); toast(S.sound_test); }
  setTimeout(paintSound, 120);
};
// iOS Safari sesi yalnız "dokunma bitti / tıklama" anında açar (pointerdown sayılmaz)
["pointerdown", "touchend", "click", "keydown"].forEach(ev => document.addEventListener(ev, (e) => {
  if (e.target?.closest?.("#sound")) return;            // ses düğmesi kendi işini yapsın (yoksa ilk dokunuş sesi kapatır)
  if (isOn() && !running()) { unlock(); setTimeout(paintSound, 150); }
}, { passive: true, capture: true }));
paintSound();

// Fare basılıyken ekranı yeniden çizme (yoksa basılan düğme değişir ve tıklama kaybolur)
let pointerDown = false, pendingRender = false;
document.addEventListener("pointerdown", () => { pointerDown = true; }, true);
const release = () => { if (!pointerDown) return; pointerDown = false; if (pendingRender) { pendingRender = false; setTimeout(render, 150); } };
document.addEventListener("pointerup", release, true);
document.addEventListener("pointercancel", release, true);

// ---------------------------------------------------------------- tarih seçici (kendi takvimimiz)
function dateField(name, value, { min, max, ph }) {
  return `<span class="dp-wrap"><input type="hidden" name="${name}" value="${esc(value || "")}">
    <button type="button" class="dp-btn" data-for="${name}" data-min="${min || ""}" data-max="${max || ""}" data-ph="${esc(ph || "")}" aria-haspopup="dialog" aria-expanded="false"></button></span>`;
}
function paintDates(root) {
  root.querySelectorAll(".dp-btn").forEach(b => {
    const v = parseYmd(b.previousElementSibling.value);
    b.textContent = v ? (DF_PICK ? DF_PICK.format(v) : ymd(v)) : (b.dataset.ph || S.pick_date);
    b.classList.toggle("empty", !v);
  });
}
let openCal = null;
function closeCal(refocus) {
  if (!openCal) return;
  const btn = openCal.parentElement?.querySelector(".dp-btn");
  openCal.remove(); openCal = null;
  document.removeEventListener("pointerdown", outsideCal, true); document.removeEventListener("keydown", escCal, true);
  if (btn) { btn.setAttribute("aria-expanded", "false"); if (refocus) btn.focus(); }
}
function outsideCal(e) { if (openCal && !openCal.contains(e.target) && !e.target.closest(".dp-btn")) closeCal(); }
function escCal(e) { if (e.key === "Escape") { e.preventDefault(); closeCal(true); } }
function bindDates(root) {
  paintDates(root);
  root.querySelectorAll(".dp-btn").forEach(b => b.onclick = () => {
    if (openCal && openCal.dataset.for === b.dataset.for) return closeCal();
    closeCal();
    const inp = b.previousElementSibling;
    const min = parseYmd(b.dataset.min), max = parseYmd(b.dataset.max);
    let view = parseYmd(inp.value) || min || new Date();
    view = new Date(view.getFullYear(), view.getMonth(), 1, 12);
    const cal = document.createElement("div");
    cal.className = "cal"; cal.dataset.for = b.dataset.for; cal.setAttribute("role", "dialog");
    cal.setAttribute("aria-label", b.dataset.ph || S.pick_date);
    const DF_FULL = dtf({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const paint = (focusSel) => {
      const y = view.getFullYear(), mo = view.getMonth();
      const first = (new Date(y, mo, 1).getDay() + 6) % 7;   // Pazartesi başlangıç
      const days = new Date(y, mo + 1, 0).getDate();
      const sel = inp.value, today = ymd(new Date());
      let cells = "";
      for (let i = 0; i < 7; i++) cells += `<span class="wd">${DF_WD ? DF_WD.format(new Date(2024, 0, 1 + i)) : ""}</span>`;
      for (let i = 0; i < first; i++) cells += "<span></span>";
      for (let d = 1; d <= days; d++) {
        const dt = new Date(y, mo, d, 12), v = ymd(dt);
        const off = (min && dt < new Date(min.getFullYear(), min.getMonth(), min.getDate())) || (max && dt > max);
        cells += `<button type="button" data-v="${v}" class="${v === sel ? "on" : ""} ${v === today ? "today" : ""}" ${off ? "disabled" : ""} aria-label="${esc(DF_FULL ? DF_FULL.format(dt) : v)}" aria-pressed="${v === sel}">${d}</button>`;
      }
      cal.innerHTML = `<div class="cal-h"><button type="button" class="prev" aria-label="‹">‹</button><b>${DF_MONTH ? DF_MONTH.format(view) : y + "-" + (mo + 1)}</b><button type="button" class="next" aria-label="›">›</button></div><div class="cal-g">${cells}</div>`;
      cal.querySelector(".prev").setAttribute("aria-label", S.cal_prev); cal.querySelector(".next").setAttribute("aria-label", S.cal_next);
      cal.querySelector(".prev").onclick = () => { view = new Date(y, mo - 1, 1, 12); paint(".prev"); };
      cal.querySelector(".next").onclick = () => { view = new Date(y, mo + 1, 1, 12); paint(".next"); };
      cal.querySelectorAll(".cal-g button").forEach(x => x.onclick = () => { inp.value = x.dataset.v; inp.dataset.dirty = "1"; paintDates(root); closeCal(true); inp.dispatchEvent(new Event("change", { bubbles: true })); });
      if (focusSel) cal.querySelector(focusSel)?.focus();
    };
    paint();
    b.parentElement.appendChild(cal); openCal = cal; b.setAttribute("aria-expanded", "true");
    (cal.querySelector(".cal-g button.on") || cal.querySelector(".cal-g button.today:not(:disabled)") || cal.querySelector(".cal-g button:not(:disabled)"))?.focus();
    setTimeout(() => { document.addEventListener("pointerdown", outsideCal, true); document.addEventListener("keydown", escCal, true); }, 0);
  });
}

// ---------------------------------------------------------------- oluştur
function viewCreate() {
  document.body.dataset.view = "create";
  closeCal();
  const def = new Date(Date.now() + 86400000);
  const today = ymd(new Date()), maxD = ymd(new Date(Date.now() + 400 * 86400000));
  const hours = Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === 20 ? "selected" : ""}>${String(h).padStart(2, "0")}</option>`).join("");
  const mins = [0, 15, 30, 45].map(m => `<option value="${m}">${String(m).padStart(2, "0")}</option>`).join("");
  app.innerHTML = `
  <form class="card form" id="cf" autocomplete="off" novalidate>
    <div class="two">
      <label>${S.c_mom}<input name="mom" maxlength="40" autocapitalize="words" placeholder="${S.c_mom_ph}"></label>
      <label>${S.c_dad}<input name="dad" maxlength="40" autocapitalize="words" placeholder="${S.c_dad_ph}"></label>
    </div>
    <div class="lbl">${S.c_who}
      <div class="seg" role="radiogroup">
        <label><input type="radio" name="who" value="mom"><span>${S.c_who_mom}</span></label>
        <label><input type="radio" name="who" value="dad"><span>${S.c_who_dad}</span></label>
        <label><input type="radio" name="who" value="other" checked><span>${S.c_who_other}</span></label>
      </div>
      <input name="other" maxlength="40" autocapitalize="words" placeholder="${S.c_other_ph}">
    </div>
    <label>${S.c_baby} <em>${S.optional}</em><input name="baby" maxlength="40" autocapitalize="words" placeholder="${S.c_baby_ph}"></label>
    <div class="lbl">${S.c_date}
      <div class="dt">${dateField("date", ymd(def), { min: today, max: maxD })}
        <span class="tm"><select name="hh" aria-label="${S.c_hour}">${hours}</select><b>:</b><select name="mm" aria-label="${S.c_minute}">${mins}</select></span></div>
      <small>${S.c_date_hint}</small></div>
    <details class="inv-box pw-box"><summary>🔒 ${S.c_pw} <em>${S.optional}</em></summary>
      <input name="pw" maxlength="40" autocomplete="off" placeholder="${S.c_pw_ph}"><small>${S.c_pw_hint}</small></details>
    <button class="btn btn-gold btn-big" type="submit">${S.c_submit}</button>
    <p class="muted center small">${S.c_note}</p>
  </form>`;
  const f = $("#cf");
  bindDates(f);
  ["mom", "dad", "baby", "other"].forEach(n => f[n].addEventListener("blur", () => { f[n].value = titleCase(f[n].value); }));
  const other = f.querySelector("[name=other]");
  f.querySelectorAll("[name=who]").forEach(r => r.onchange = () => { other.hidden = f.who.value !== "other"; if (!other.hidden) other.focus(); });
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    unlock();
    const mom = titleCase(f.mom.value), dad = titleCase(f.dad.value);
    const parents = [mom, dad].filter(Boolean).join(" & ");
    const who = f.who.value;
    const host = (who === "mom" ? mom : who === "dad" ? dad : titleCase(other.value)).slice(0, 40);
    const err = !mom && !dad ? S.c_err_parent : !host ? (who === "other" ? S.c_err_other : S.c_err_who) : null;
    if (err) return toast(err);
    const pw = f.pw.value.trim();
    if (pw && pw.length < 4) return toast(S.c_err_pw);
    const d = parseYmd(f.date.value);
    if (!d) return toast(S.c_err_date);
    const partyAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +f.hh.value, +f.mm.value).getTime();
    if (!(partyAt > Date.now() - 3600000)) return toast(S.c_err_date);
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = S.wait;
    try {
      const { id, hostKey } = await fb.createRoom({ babyName: titleCase(f.baby.value) || S.default_baby, parents, partyAt, lang: LANG, invitees: [], hostName: host, password: pw || null });
      ls.set("pob_hk_" + id, hostKey); if (pw) ls.set("pob_pw_" + id, pw);
      track(pw ? "oda-acildi-sifreli" : "oda-acildi");
      history.replaceState(null, "", INVITE + "#r=" + id);
      route(true);
    } catch (e) {
      console.error(e); toast(S.err_generic);
      btn.disabled = false; btn.textContent = S.c_submit;
    }
  };
}

// ---------------------------------------------------------------- oda
let room = null, routeGen = 0;
function cleanupRoom() {
  if (!room) return;
  room.unsubs.forEach(u => u && u()); clearInterval(room.timer); clearInterval(room.resTimer);
  if (room.showCtl) room.showCtl.stop(); if (room.game) room.game.abort();
  fb.presenceStop(room.id);
  room = null;
}

async function viewRoom(id, justCreated) {
  const gen = routeGen;
  document.body.dataset.view = "room";
  app.innerHTML = `<div class="card center"><p>${S.loading}</p></div>`;
  const uid = await fb.ready;
  if (gen !== routeGen) return;            // bu sırada başka sayfaya geçildi
  cleanupRoom();
  // Kurucu linki (#r=..&k=..): bu cihazı kurucu yap, anahtarı sakla, adresten sil
  const km = (location.hash + "&" + location.search).match(/[#?&]k=([a-z0-9]{16,40})/);
  if (km) {
    history.replaceState(null, "", INVITE + "#r=" + id);
    try { await fb.claimHost(id, km[1], S.default_host); ls.set("pob_hk_" + id, km[1]); toast(S.h_claimed); }
    catch (e) { console.error(e); toast(S.h_claim_fail); }
    if (gen !== routeGen) return;
  }
  // Şifreli oda: üye değilse şifre iste
  if (await fb.isLocked(id) && !(await fb.isMember(id))) {
    if (gen !== routeGen) return;
    return renderPassword(id, justCreated);
  }
  if (gen !== routeGen) return;
  const R = room = { id, uid, meta: null, guests: {}, invitees: {}, presence: {}, taps: {}, scores: {}, show: {}, votes: null, mine: null, sealed: null, result: null, unsubs: [], showing: false, shown: false, justCreated, drafts: {}, decided: {}, presenceOn: false };
  const key = (p) => ({ ["votes/" + uid]: "mine", ["sealed/" + uid]: "sealed" }[p] || p);
  const first = (path) => new Promise(res => {
    let done = false;
    R.unsubs.push(fb.watch(id, path, v => {
      R[key(path)] = v || (path.includes("/") ? null : {});
      if (!done) { done = true; res(); } else if (room === R) render();
    }));
  });
  // Önce liste ve kişisel veriler; meta (ve şov) en son
  await Promise.all(["guests", "invitees", "presence", "scores", "show", "votes/" + uid, "sealed/" + uid].map(first));
  if (room !== R) return;
  R.unsubs.push(fb.watch(id, "taps", v => { R.taps = v || {}; }));
  R.unsubs.push(fb.watch(id, "meta", (m) => {
    if (room !== R) return;
    const prev = R.meta; R.meta = m;
    if (!m) return renderMissing();
    if (m.status === "reveal" && (!prev || prev.status !== "reveal") && !R.starting) onReveal();
    render();
  }));
  R.timer = setInterval(() => { const el = $("#cd"); if (el && R.meta) el.textContent = countdown(R.meta.partyAt); }, 20000);
}

function renderPassword(id, justCreated) {
  document.body.dataset.view = "room";
  app.innerHTML = `<div class="card center join"><div class="big-emoji">🔒</div><h2>${S.pw_h}</h2><p class="muted">${S.pw_p}</p>
    <form id="pwf" novalidate><input name="pw" maxlength="40" autocomplete="off" placeholder="${S.c_pw_ph}"><button class="btn btn-gold btn-big" type="submit">${S.pw_go}</button></form></div>`;
  const f = $("#pwf");
  f.onsubmit = async (ev) => {
    ev.preventDefault(); unlock();
    const pw = f.pw.value.trim(); if (!pw) return;
    const btn = f.querySelector("button"); btn.disabled = true;
    if (await fb.enterPassword(id, pw) && await fb.isMember(id)) { ls.set("pob_pw_" + id, pw); viewRoom(id, justCreated); }
    else { btn.disabled = false; toast(S.pw_wrong); f.pw.select(); }
  };
}

function renderMissing() {
  closeCal();
  app.innerHTML = `<div class="card center"><div class="big-emoji">🎈</div><h2>${S.missing_h}</h2><p>${S.missing_p}</p>
  <a class="btn btn-gold" href="${CREATE}">${S.missing_btn}</a></div>`;
}

const me = () => room.guests[room.uid];
const isHost = () => room.meta && room.meta.hostUid === room.uid;
const isRevealer = () => room.meta && room.meta.revealerUid === room.uid;
const onlineUids = () => Object.keys(room.presence || {}).filter(u => room.guests[u] && room.presence[u] && Object.keys(room.presence[u]).length);

let deferred = false;
function render() {
  if (!room || !room.meta) return;
  if (room.showing) return;
  if (pointerDown) { pendingRender = true; return; }
  if (openCal) { pendingRender = true; return; }
  const ae = document.activeElement;
  if (ae && app.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.type !== "button") {
    if (!deferred) { deferred = true; ae.addEventListener("blur", () => { deferred = false; setTimeout(render, 200); }, { once: true }); }
    return;
  }
  const open = [...app.querySelectorAll("details[open]")].map(d => d.className.split(" ")[0]);
  app.querySelectorAll("input[name], textarea[name], select[name]").forEach(el => {
    if (el.type === "radio") return;
    const k = el.name;
    const changed = el.type === "hidden" ? el.dataset.dirty === "1" : el.value !== (el.tagName === "SELECT" ? el.dataset.init : el.defaultValue);
    if (changed) room.drafts[k] = el.value; else delete room.drafts[k];
  });
  const oldSky = app.querySelector(".sky"), y = scrollY;
  renderInner();
  // Gökyüzü değişmediyse eski balonları koru (animasyonlar baştan başlamasın)
  const newSky = app.querySelector(".sky");
  if (oldSky && newSky && oldSky.dataset.sig === newSky.dataset.sig) newSky.replaceWith(oldSky);
  open.forEach(c => { const d = app.querySelector("details." + c); if (d) d.open = true; });
  Object.entries(room.drafts).forEach(([k, v]) => { const el = app.querySelector(`[name="${k}"]`); if (el && !el.readOnly) { el.value = v; if (el.type === "hidden") el.dataset.dirty = "1"; } });
  paintDates(app);
  if (Math.abs(scrollY - y) > 2) scrollTo(0, y);
}
function renderInner() {
  closeCal();
  const m = room.meta;
  if (m.status === "reveal" && room.shown) return renderResult();
  if (m.status === "reveal") {
    app.innerHTML = `<div class="card center"><div class="big-emoji">🎈</div><h2>${S.show_ready}</h2><p class="muted">${S.show_ready_sub}</p></div>`;
    return;
  }
  if (!me()) return renderJoin();
  renderLobby();
}

function headHtml(m, eyebrow) {
  return `<header class="room-head">
    ${m.parents ? `<p class="parents">${esc(m.parents)}</p>` : `<p class="eyebrow">${eyebrow}</p>`}
    <h1 class="room-title">${esc(fmt(S.lobby_title, babyOf(m)))}</h1>
    <p class="cd"><span id="cd">${countdown(m.partyAt)}</span> · ${esc(fmtDate(m.partyAt))}</p>
  </header>`;
}

function renderJoin() {
  const m = room.meta;
  app.innerHTML = `
  ${headHtml(m, S.j_eyebrow)}
  <div class="card center join">
    <p class="eyebrow">${S.j_eyebrow}</p>
    <p class="muted">${S.j_type}</p>
    <form id="jf" novalidate><input name="n" maxlength="40" autocapitalize="words" placeholder="${S.j_name_ph}" autocomplete="name"><button class="btn btn-gold btn-big" type="submit">${S.j_submit}</button></form>
  </div>`;
  const inp = $("#jf input");
  inp.addEventListener("blur", () => { inp.value = titleCase(inp.value); });
  $("#jf").onsubmit = async (ev) => {
    ev.preventDefault(); unlock(); paintSound();
    const R = room, n = titleCase(inp.value).slice(0, 40);
    if (!n) { toast(S.j_err_empty); inp.focus(); return; }
    const same = Object.entries(R.guests).filter(([u, g]) => u !== R.uid && lower(g.name) === lower(n));
    if (same.length) {
      const online = new Set(onlineUids());
      if (same.some(([u]) => online.has(u))) { toast(S.j_err_taken); inp.focus(); return; }
      if (!confirm(fmt(S.j_rejoin, n))) return;
    }
    try { await fb.join(R.id, n); if (room !== R) return; delete R.drafts.n; sfx.plop(); track("katildi"); document.activeElement?.blur(); render(); }
    catch (e) { console.error(e); toast(S.err_generic); }
  };
}

function people() {
  const on = new Set(onlineUids()), m = room.meta;
  const all = Object.entries(room.guests).map(([uid, g]) => ({ uid, name: g.name, voted: !!g.voted, keeper: uid === m.revealerUid, online: on.has(uid), me: uid === room.uid, host: uid === m.hostUid }));
  // Aynı kişi (cihaz değiştirip / geçmişi silip yeniden katılan) tek balon olsun: ben > kurucu/sır tutucu > çevrimiçi > oy vermiş
  const score = (p) => p.me * 8 + (p.host || p.keeper) * 4 + p.online * 2 + p.voted;
  const best = new Map();
  for (const p of all) { const k = lower(p.name), cur = best.get(k); if (!cur || score(p) > score(cur)) best.set(k, { ...p, voted: p.voted || (cur && cur.voted) }); else if (p.voted) cur.voted = true; }
  return [...best.values()].sort((a, b) => (b.voted - a.voted) || a.name.localeCompare(b.name, LANG));
}

function renderLobby() {
  if (!room.presenceOn) { room.presenceOn = true; fb.presence(room.id); }
  const m = room.meta, ps = people();
  const voters = ps.filter(p => !p.keeper);
  const votedN = voters.filter(p => p.voted).length;

  const expected = voters.length;
  const onN = ps.filter(p => p.online).length;
  const sig = ps.map(p => `${p.uid}${+p.voted}${+p.online}${+p.keeper}`).join("|");
  app.innerHTML = `
  ${headHtml(m, S.lobby_eyebrow)}
  <section class="sky" data-n="${ps.length > 30 ? "l" : ps.length > 16 ? "m" : "s"}" data-sig="${esc(sig)}" aria-label="${S.lobby_sky}">${ps.map(balloonHtml).join("")}</section>
  <p class="sky-stat"><b>${fmt(S.lobby_voted, votedN, expected)}</b> · ${fmt(S.lobby_online, onN)}</p>
  ${isHost() ? hostFlow(votedN, expected, onN) : isRevealer() ? keeperCard(votedN, expected, onN) : ""}
  ${voteCard(isRevealer())}
  ${gameCard()}
  ${!isHost() ? `<section class="card share-mini"><div class="row"><div><b>${S.share_h}</b><p class="muted small">${S.share_p_guest}</p></div>
    <div class="row gap"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText(m))}">WhatsApp</a><button class="btn" data-act="share">${S.share_more}</button></div></div></section>` : ""}

  <p class="muted small center secret-note">${S.lobby_secret}</p>`;
  bindLobby();
}

function balloonHtml(p) {
  const h = hash(p.name);
  const col = PALETTE[h % PALETTE.length];
  const delay = -(h % 5000) / 1000, dur = 3 + (h % 3000) / 1000;
  const tip = `${p.name} · ${p.keeper ? S.tip_keeper : p.voted ? S.tip_voted : S.tip_not_voted}${p.online ? " · " + S.tip_here : ""}`;
  return `<button type="button" class="balloon ${p.voted || p.keeper ? "voted" : ""} ${p.online ? "on" : ""} ${p.me ? "me" : ""}" style="--d:${delay}s;--dur:${dur}s" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
    <span class="bb" aria-hidden="true"><span class="av" style="background:${col}">${esc(initials(p.name))}</span></span><span class="str" aria-hidden="true"></span>
    <span class="nm" aria-hidden="true">${p.keeper ? "🤫 " : ""}${p.me ? S.you : esc(p.name.split(" ")[0])}</span></button>`;
}

function pickBtns(cls, sel, attr) {
  return `<div class="vote-btns ${cls}">
    <button class="vb girl ${sel === "girl" ? "on" : ""}" data-${attr}="girl" aria-pressed="${sel === "girl"}"><span class="vi" aria-hidden="true">🎀</span>${S.girl}</button>
    <button class="vb boy ${sel === "boy" ? "on" : ""}" data-${attr}="boy" aria-pressed="${sel === "boy"}"><span class="vi" aria-hidden="true">🎩</span>${S.boy}</button></div>`;
}

function voteCard(guessOnly) {
  const v = room.mine;
  const maxB = ymd(new Date(Date.now() + 320 * 86400000));
  const extras = v && (v.birth || v.weight || v.letter || v.nm);
  if (guessOnly) return `<section class="card vote has parents-guess">
    <h2>👑 ${S.pg_h}</h2><p class="muted small">${S.pg_p}</p>
    <details class="guesses" ${extras ? "" : "open"}><summary>${extras ? S.v_more_saved : S.pg_open}</summary>
      <label class="lbl">${S.v_birth}${dateField("birth", v?.birth, { min: ymd(new Date()), max: maxB, ph: S.v_birth_ph })}</label>
      <label class="lbl">${S.v_weight}<input type="number" name="weight" min="500" max="7000" step="10" inputmode="numeric" placeholder="3250" value="${esc(v?.weight || "")}"></label>
      <label class="lbl">${S.v_letter}<input name="letter" maxlength="1" value="${esc(v?.letter || "")}" autocapitalize="characters"></label>
      <button class="btn" data-act="saveg">${S.v_save}</button>
    </details></section>`;
  return `<section class="card vote ${v?.pick ? "has" : ""}">
    <h2>${v?.pick ? fmt(S.v_yours_is, v.pick === "girl" ? "🎀 " + S.girl : "🎩 " + S.boy) : S.v_h}</h2>
    ${v?.pick ? `<p class="muted small">${S.v_change}</p>` : `<p class="muted small">${S.v_private}</p>`}
    ${pickBtns("cast", v?.pick, "p")}
    <details class="guesses"><summary>${extras ? S.v_more_saved : S.v_more}</summary>
      <label class="lbl">${S.v_birth}${dateField("birth", v?.birth, { min: ymd(new Date()), max: maxB, ph: S.v_birth_ph })}</label>
      <label class="lbl">${S.v_weight}<input type="number" name="weight" min="500" max="7000" step="10" inputmode="numeric" placeholder="3250" value="${esc(v?.weight || "")}"></label>
      <label class="lbl">${S.v_letter}<input name="letter" maxlength="1" value="${esc(v?.letter || "")}" autocapitalize="characters"></label>
      <button class="btn" data-act="saveg">${S.v_save}</button>
    </details>
  </section>`;
}

function stepStart(votedN, expected, onN) {
  const s = room.sealed;
  return `<li class="${s ? "" : "locked"}"><b>${S.f_step3}</b>
    <button class="btn btn-gold btn-big start" data-act="start" ${s ? "" : "disabled"}>🎉 ${S.k_start}</button>
    <p class="muted small center">${fmt(S.k_status, votedN, expected, onN)}${s ? "" : " · " + S.f_need_seal}</p></li>`;
}
function stepSeal() {
  const s = room.sealed;
  return `<li class="${s ? "done" : ""}"><b>${S.f_step1}</b><p class="muted small">${S.k_p}</p>${pickBtns("seal", s, "s")}${s ? `<p class="ok small">${S.k_sealed}</p>` : ""}</li>`;
}
function hostFlow(votedN, expected, onN) {
  const m = room.meta, others = people().filter(p => !p.me);
  const delegated = m.revealerUid !== room.uid;
  const who = delegated ? room.guests[m.revealerUid]?.name : null;
  const url = roomUrl(room.id);
  return `<section class="card flow">
    <p class="eyebrow">👑 ${S.h_eyebrow}</p>
    ${room.justCreated ? `<p class="ok">${S.h_created}</p>` : ""}
    <ol class="flow-steps">
      ${delegated ? `<li class="done"><b>${S.f_step1}</b><p>${fmt(S.h_keeper_is, esc(who || "?"))}</p></li>` : stepSeal()}
      <li><b>${S.f_step2}</b>
        <div class="row gap"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText(m))}">WhatsApp</a>
        <button class="btn" data-act="share">${S.share_more}</button><button class="btn" data-act="copy">${S.copy}</button></div>
        <p class="muted small link-text">${esc(url)}</p></li>
      ${delegated ? `<li><b>${S.f_step3}</b><p class="muted">${fmt(S.f_keeper_starts, esc(who || "?"))}</p></li>` : stepStart(votedN, expected, onN)}
    </ol>
    ${hostKeyBox()}
    <details class="settings"><summary>⚙️ ${S.h_more}</summary>
      <label class="lbl">${S.h_keeper}<small class="muted">${S.h_keeper_lbl}</small>
        <select name="keeper" data-init="${m.revealerUid}"><option value="${room.uid}">${S.h_keeper_me}</option>
        ${others.map(p => `<option value="${p.uid}" ${p.uid === m.revealerUid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <p class="muted small">${S.h_device}</p>
      <button class="btn btn-danger" data-act="del">${S.h_delete}</button>
    </details>
  </section>`;
}
function hostKeyBox() {
  const key = ls.get("pob_hk_" + room.id), pw = ls.get("pob_pw_" + room.id);
  if (!key && !pw) return "";
  const link = key ? hostLink(room.id, key) : "";
  return `<div class="keybox">
    ${key ? `<p><b>🔑 ${S.hk_h}</b></p><p class="muted small">${S.hk_p}</p>
    <div class="row gap"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(S.hk_msg + "\n" + link)}">${S.hk_wa}</a><button class="btn" data-act="copykey">${S.copy}</button></div>` : ""}
    ${pw ? `<p class="small pw-show">🔒 ${fmt(S.pw_is, `<b>${esc(pw)}</b>`)}</p>` : ""}
  </div>`;
}
function keeperCard(votedN, expected, onN) {
  return `<section class="card flow keeper"><p class="eyebrow">🤫 ${S.k_eyebrow}</p><h2>${S.k_h_guest}</h2>
    <ol class="flow-steps">${stepSeal()}${stepStart(votedN, expected, onN)}</ol></section>`;
}
function gameCard() {
  const scores = Object.entries(room.scores).map(([u, x]) => ({ name: room.guests[u]?.name || x.name, score: x.score, me: u === room.uid })).sort((a, b) => b.score - a.score).slice(0, 3);
  return `<section class="card game-card"><div class="row"><div><h2>🎈 ${S.game_name}</h2><p class="muted small">${S.game_teaser}</p></div>
    <button class="btn btn-gold" data-act="play">${S.game_play}</button></div>
    ${scores.length ? `<ol class="board">${scores.map(s => `<li class="${s.me ? "me" : ""}"><span>${esc(s.name)}</span><b>${s.score}</b></li>`).join("")}</ol>` : ""}</section>`;
}

function bindLobby() {
  const R = room;
  bindDates(app);
  app.querySelectorAll(".balloon").forEach(b => b.onclick = () => { toast(b.dataset.tip); b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop"); });
  app.querySelectorAll(".cast .vb").forEach(b => b.onclick = async () => {
    const next = Object.assign({}, R.mine || {}, { pick: b.dataset.p });
    try { const first = !R.mine?.pick; await fb.vote(R.id, clean(next)); if (room !== R) return; R.mine = next; sfx.plop(); if (first) track("oy"); toast(next.pick === "girl" ? S.v_done_girl : S.v_done_boy); render(); }
    catch (e) { console.error(e); toast(S.err_generic); }
  });
  app.querySelectorAll(".seal .vb").forEach(b => b.onclick = async () => {
    try { await fb.seal(R.id, b.dataset.s); if (room !== R) return; R.sealed = b.dataset.s; sfx.plop(); render(); } catch (e) { console.error(e); toast(S.err_generic); }
  });
  const act = (name, fn) => app.querySelectorAll(`[data-act="${name}"]`).forEach(el => el.onclick = fn);
  act("saveg", async () => {
    const box = app.querySelector(".guesses");
    const next = Object.assign({}, R.mine || {});
    if (!next.pick && !isRevealer()) return toast(S.v_pick_first);
    const bv = box.querySelector("[name=birth]").value, wRaw = box.querySelector("[name=weight]").value.trim(), l = box.querySelector("[name=letter]").value.trim();
    delete next.nm;
    const w = parseInt(wRaw, 10);
    if (wRaw && !(w >= 500 && w <= 7000)) return toast(S.v_err_weight);
    if (bv && !parseYmd(bv)) return toast(S.v_err_birth);
    if (isRevealer()) delete next.pick;
    if (bv) next.birth = bv; else delete next.birth;
    if (wRaw) next.weight = w; else delete next.weight;
    if (l) next.letter = l.toLocaleUpperCase(LANG); else delete next.letter;
    if (!next.pick && !next.birth && !next.weight && !next.letter && !next.nm) return toast(S.pg_empty);
    try { await fb.vote(R.id, clean(next)); if (room !== R) return; R.mine = next; ["birth", "weight", "letter", "nm"].forEach(k => delete R.drafts[k]); document.activeElement?.blur(); toast(S.v_saved); render(); }
    catch (e) { console.error(e); toast(S.err_generic); }
  });
  act("start", async (ev) => {
    const st = ev.currentTarget;
    if (!confirm(S.k_confirm)) return;
    unlock();
    if (!fb.isConnected()) return toast(S.k_offline);
    st.disabled = true;
    R.starting = true;   // yerel "reveal" olayı sunucu onayı gelmeden şovu başlatmasın
    try {
      await fb.startReveal(R.id, R.sealed, SHOW_LEAD, onlineUids().length || 1);
      track("acilis");
      R.starting = false;
      if (room === R && R.meta?.status === "reveal") onReveal();
    } catch (e) {
      console.error(e); R.starting = false;
      if (room !== R) return;
      toast(S.err_generic); st.disabled = false; render();
    }
  });
  const kp = app.querySelector("[name=keeper]");
  if (kp) kp.onchange = async () => {
    if (kp.value !== R.uid && !confirm(S.h_keeper_confirm)) { kp.value = R.meta.revealerUid; return; }
    try { await fb.delegate(R.id, kp.value); delete R.drafts.keeper; } catch (e) { console.error(e); toast(S.err_generic); }
  };
  act("del", async () => {
    if (!confirm(S.h_delete_confirm)) return;
    try { await fb.deleteRoom(R.id); cleanupRoom(); location.href = CREATE; } catch (e) { console.error(e); toast(S.err_generic); }
  });
  act("copy", () => copy(roomUrl(R.id)));
  act("copykey", () => copy(hostLink(R.id, ls.get("pob_hk_" + R.id))));
  act("share", () => { track("davet-paylas"); share(shareText(R.meta)); });
  app.querySelectorAll(".btn-wa").forEach(a => a.addEventListener("click", () => track("davet-whatsapp")));
  act("play", () => {
    track("oyun");
    const names = [...new Set([...Object.values(R.guests).map(g => g.name), ...Object.values(R.invitees)].map(n => n.trim().split(/\s+/)[0]).filter(Boolean))];
    R.game = playGame({ root: document.body, S, names, baby: babyOf(R.meta), onEnd: async (score) => {
      R.game = null;
      if (score != null && room === R && me()) { try { await fb.setScore(R.id, me().name, score); } catch (e) {} toast(fmt(S.game_result, score)); }
    } });
  });
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// ---------------------------------------------------------------- açılış
// İlk iki tur heyecan için her zaman başarısız (sayı gösterilmez); 3. turda gerçek hedef, 4. turda %60, 5. turda kesin patlar
const SCRIPTED_FAILS = 2;
const needFor = (R, k) => k >= 4 ? 1 : Math.ceil((R.show?.n || 1) * PER_PERSON * (k >= 3 ? .6 : 1));
const sumTaps = (R) => Object.values(R.taps || {}).reduce((s, n) => s + (+n || 0), 0);

function onReveal() {
  const R = room, m = R.meta;
  if (R.game) R.game.abort();
  closeCal();
  R.unsubs.push(fb.watch(R.id, "votes", v => { R.votes = v || {}; if (room === R && R.shown && !R.showing) render(); }));
  R.unsubs.push(fb.watch(R.id, "wall", v => { R.wall = v || {}; if (room === R && R.shown && !R.showing) paintWall(); }));
  const t = (fb.serverNow() - m.revealAt) / 1000;
  const pop = R.show?.pop;
  // Eski sürümde açılmış oda (sonuç meta'da, tur bilgisi yok): şov oynatılamaz, doğrudan sonuç
  if (m.result && !R.show?.n) { R.result = m.result; R.legacy = true; R.shown = true; render(); return; }
  // Uzun süre önce başlamış ama hiç tur sonucu yazılmamış (herkes ayrılmış): şov yerine sonuç/bekleme
  if (pop != null && t > showEnd(pop)) { R.shown = true; fetchResult(R, () => render()); render(); return; }
  if (pop == null && t > 3 + 15 * 10) {
    // Şov yarıda kalmış (herkes ayrılmış): ilk boş turu "patladı" olarak kapat, sonuç açılsın
    R.shown = true;
    let k = 0; while (R.show?.r?.[k] && k < 9) k++;
    if (R.guests[R.uid] && !R.show?.r?.[k]) fb.setRound(R.id, k, "pop", sumTaps(R)).then(() => fetchResult(R, () => render()));
    render(); return;
  }
  runShow(false);
}

function fetchResult(R, done) {
  if (R.result) return done && done();
  if (R.fetching) return; R.fetching = true;
  clearInterval(R.resTimer);
  let tries = 0;
  const tryGet = async () => {
    if (room !== R) return clearInterval(R.resTimer);
    const v = await fb.getResult(R.id);
    if (v && room === R) { R.result = v; R.fetching = false; clearInterval(R.resTimer); done && done(); return; }
    if (++tries > 60) { clearInterval(R.resTimer); R.fetching = false; R.resFailed = true; if (room === R && !R.showing) render(); }
  };
  tryGet(); R.resTimer = setInterval(tryGet, 300);
}

function runShow(local) {
  const R = room, m = R.meta;
  R.showing = true;
  R.lastTaps = { ...(R.taps || {}) };
  const base = fb.serverNow() - performance.now();               // saati bir kez sabitle (sıçramasın)
  const t0 = performance.now();
  const getT = local ? () => performance.now() - t0 - 1500 : () => base + performance.now() - m.revealAt;
  const canTap = () => !local && room === R && !!R.guests[R.uid];
  let unsent = 0, sendT = null;
  const flush = () => { sendT = null; const d = unsent; unsent = 0; if (d && room === R) fb.addTaps(R.id, d).catch(() => { unsent += d; }); };
  // patlama yaklaşınca sonucu iste (kural ancak o an açar)
  if (!local) R.resWatch = setInterval(() => {
    if (room !== R || !R.showing) return clearInterval(R.resWatch);
    const pop = R.show?.pop;
    if (pop != null && !R.result && getT() / 1000 >= roundStart(pop) + 14.05) { clearInterval(R.resWatch); fetchResult(R); }
  }, 200);
  R.showCtl = playShow({
    root: document.body, getT, S, babyName: babyOf(m), parents: m.parents,
    getShow: () => R.show,
    getResult: () => R.result,
    need: (k) => needFor(R, k),
    myName: shortName(R.guests[R.uid]?.name),
    takeRemote: () => {
      if (local) return [];
      const ev = [], last = R.lastTaps || {};
      for (const [u, n] of Object.entries(R.taps || {})) {
        if (u === R.uid) continue;
        const d = (+n || 0) - (+last[u] || 0);
        if (d > 0) ev.push({ name: shortName(R.guests[u]?.name), n: d });
      }
      R.lastTaps = { ...R.taps };
      return ev;
    },
    hideCount: (k) => k < SCRIPTED_FAILS,
    // 3. turdan itibaren sır tutucu "bu turda patlat" diyebilir
    canForce: (k) => !local && k >= 2 && room === R && R.meta?.revealerUid === R.uid && R.forceFrom == null,
    onForce: (k) => { R.forceFrom = (R.show?.r?.[k]?.o === "fail") ? k + 1 : k; },
    get myPick() { return R.mine?.pick; },
    soundWanted: isOn(),
    correctCount: () => Object.entries(R.votes || {}).filter(([u, v]) => u !== m.revealerUid && v.pick === R.result).length,
    getTaps: (k) => {
      const r = R.show?.r || {}, baseK = k ? (r[k - 1]?.t || 0) : 0;
      if (local) {
        const tl = getT() / 1000 - roundStart(k), endT = r[k]?.t ?? baseK;
        return { round: Math.max(0, (endT - baseK) * Math.max(0, Math.min(1, tl / 10))), people: 0, top: [] };
      }
      const mineDb = +(R.taps[R.uid] || 0), mine = mineDb + (canTap() ? unsent : 0);
      const total = sumTaps(R) - mineDb + mine;
      const entries = Object.entries(R.taps).map(([u, n]) => [u, u === R.uid ? mine : +n]);
      if (!R.taps[R.uid] && mine) entries.push([R.uid, mine]);
      const top = entries.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([u, n]) => [shortName(R.guests[u]?.name) || "?", n]);
      return { round: Math.max(0, total - baseK), people: top.length, top };
    },
    decide: (k) => {
      if (local || R.decided[k] || room !== R || !R.guests[R.uid] || R.show?.r?.[k]) return;
      const tl = getT() / 1000 - roundStart(k);
      if (!isRevealer() && tl < 11.3) return;                     // önce sır tutucu yazsın, gecikirse herkes
      R.decided[k] = true;
      const r = R.show?.r || {}, baseK = k ? (r[k - 1]?.t || 0) : 0, total = sumTaps(R);
      const o = k < SCRIPTED_FAILS ? "fail" : (k >= 4 || (R.forceFrom != null && k >= R.forceFrom) || total - baseK >= needFor(R, k)) ? "pop" : "fail";
      fb.setRound(R.id, k, o, total).then(ok => { if (!ok) R.decided[k] = false; });
    },
    onTap: () => {
      if (!canTap()) return;
      unsent++;
      if (!sendT) sendT = setTimeout(flush, 350);
    },
    onEnd: () => { flush(); R.showing = false; R.shown = true; R.showCtl = null; clearInterval(R.resWatch); if (room === R) render(); },
  });
}

function renderResult() {
  const R = room, m = R.meta;
  if (!R.result) {
    if (R.resFailed || R.show?.pop == null) {
      app.innerHTML = `<div class="card center"><div class="big-emoji">🎈</div><h2>${S.r_wait_h}</h2><p class="muted">${S.r_wait_p}</p><button class="btn btn-gold" onclick="location.reload()">${S.r_reload}</button></div>`;
      return;
    }
    app.innerHTML = `<div class="card center"><p>${S.loading}</p></div>`; return fetchResult(R, () => render());
  }
  const girl = R.result === "girl";
  const list = Object.entries(R.votes || {}).filter(([u]) => u !== m.revealerUid).map(([uid, v]) => ({ uid, name: R.guests[uid]?.name || "?", ...v }));
  const right = list.filter(v => v.pick === R.result), nG = list.filter(v => v.pick === "girl").length, nB = list.filter(v => v.pick === "boy").length;
  const tot = nG + nB, pct = tot ? Math.round(right.length / tot * 100) : 0, gPct = tot ? Math.round(nG / tot * 100) : 50;
  const scores = Object.entries(R.scores).map(([u, x]) => ({ name: R.guests[u]?.name || x.name, score: x.score })).sort((a, b) => b.score - a.score);
  const taps = Object.entries(R.taps).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const tapTotal = taps.reduce((s, [, n]) => s + n, 0);
  const rounds = Object.keys(R.show?.r || {}).length || 1;
  const pv = R.votes?.[m.revealerUid];   // sır tutucunun (anne-baba) ek tahmini
  const keeperName = R.guests[m.revealerUid]?.name || m.parents || S.default_host;
  const keeperIsParent = !!m.parents && m.parents.split(" & ").some(n => lower(n) === lower(keeperName) || lower(m.parents) === lower(keeperName));
  const parentsRow = pv && (pv.birth || pv.weight || pv.letter) ? [{ uid: m.revealerUid, name: keeperName, parent: true, tag: keeperIsParent ? S.r_parents_tag : S.r_keeper_tag, ...pv }] : [];
  const guesses = [...parentsRow, ...list.filter(v => v.birth || v.weight || v.letter).map(v => ({ ...v, parent: v.uid === m.hostUid }))];
  const mine = m.revealerUid === R.uid ? null : R.mine?.pick;
  const names = [...list.filter(v => v.nm).map(v => ({ nm: v.nm, name: v.name })),
    ...Object.values(R.wall || {}).filter(w => w.nm).map(w => ({ nm: w.nm, name: w.name, after: true }))];
  const conf = Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i * 0.37) % 6}s;--t:${5 + (i % 5)}s;--c:${["#fff", "#F2B93B", girl ? "#D6336C" : "#1C6FB8", "#FFE08A"][i % 4]};--r:${(i * 47) % 360}deg"></i>`).join("");
  const av = (n) => { const h = hash(n); return `<span class="av" style="background:${PALETTE[h % PALETTE.length]}">${esc(initials(n))}</span>`; };
  app.innerHTML = `
  <article class="res ${girl ? "is-girl" : "is-boy"}" id="rc">
    <section class="res-hero">
      <div class="res-rays" aria-hidden="true"></div><div class="res-conf" aria-hidden="true">${conf}</div>
      <img class="res-stork" src="${ASSET}img/stork.png" alt="" width="560" height="560">
      <p class="res-parents">🎉 ${esc(m.parents ? fmt(S.r_congrats, m.parents) : S.r_congrats_np)}</p>
      <h1 class="res-big" style="--n:${[...(girl ? S.girl_big : S.boy_big)].length}">${girl ? S.girl_big : S.boy_big}</h1>
      <p class="res-line">${esc(fmt(girl ? S.show_girl_line : S.show_boy_line, babyOf(m)))}</p>
      <p class="res-date">${esc(dtf({ day: "numeric", month: "long", year: "numeric" })?.format(new Date(m.partyAt)) || fmtDate(m.partyAt))}</p>
      ${mine ? `<p class="res-me ${mine === R.result ? "yes" : ""}">${mine === R.result ? S.show_you_right : S.show_you_wrong}</p>` : ""}
    </section>
    <section class="res-stats">
      <div><b>${esc(pctFmt(pct))}</b><span>${fmt(S.r_right_short, right.length, tot)}</span></div>
      <div><b>${new Set(Object.values(R.guests).map(g => lower(g.name))).size}</b><span>${S.r_joined}</span></div>
      <div><b>${scores[0] ? scores[0].score : "–"}</b><span>${scores[0] ? "🏆 " + esc(scores[0].name.split(" ")[0]) : S.game_name}</span></div>
    </section>
    <section class="res-card">
      <h2>${S.r_teams}</h2>
      <div class="teambar"><i style="width:${Math.max(tot ? 8 : 50, Math.min(tot ? 92 : 50, gPct))}%">🎀 ${nG}</i><b>${nB} 🎩</b></div>
      <div class="teamlbl"><span>${S.r_team_pink}</span><span>${S.r_team_blue}</span></div>
    </section>
    <section class="res-card">
      <h2>${fmt(S.r_right, right.length)}</h2>
      ${right.length ? `<div class="res-people">${right.map(v => `<span class="rp">${av(v.name)}<b>${esc(v.name)}</b></span>`).join("")}</div>` : `<p class="muted">${S.r_nobody}</p>`}
    </section>
    <section class="res-card wall-compose">
      <h2>💌 ${S.w_h}</h2><p class="muted small">${S.w_p}</p>
      ${me() ? "" : `<input name="wname" maxlength="40" autocapitalize="words" placeholder="${S.j_name_ph}">`}
      <textarea name="wmsg" rows="3" maxlength="280" placeholder="${fmt(S.w_msg_ph, babyOf(m))}"></textarea>
      <label class="lbl wnm-lbl">💡 ${S.w_nm_label}<input name="wnm" maxlength="24" autocapitalize="words" placeholder="${girl ? S.w_nm_ph_girl : S.w_nm_ph_boy}"></label>
      <button class="btn btn-gold btn-big" data-act="wsend">${S.w_send}</button>
    </section>
    <div id="wall-names"></div>
    <section class="res-card wall-card" id="wall"></section>
    ${guesses.length ? `<section class="res-card"><h2>${S.r_guesses}</h2><div class="res-guess">
      ${guesses.map(v => `<div class="rg ${v.parent ? "parent" : ""}">${v.parent ? `<span class="av crown">👑</span>` : av(v.name)}<div><b>${esc(v.name)}${v.parent ? ` <em>${v.tag || S.r_parents_tag}</em>` : ""}</b><span>${[v.birth ? "📅 " + esc(shortDate(v.birth)) : "", v.weight ? "⚖️ " + v.weight + " g" : "", v.letter ? "🔤 " + esc(v.letter) : ""].filter(Boolean).join(" · ")}</span></div>${v.pick ? `<i class="${v.pick}">${v.pick === "girl" ? "🎀" : "🎩"}</i>` : ""}</div>`).join("")}</div>
      <button class="btn pdf-btn" data-act="pdf">📄 ${S.r_pdf}</button></section>` : ""}
  </article>
  <button class="btn story-btn ${girl ? "g" : "b"}" data-act="story">📸 ${S.r_story}</button>
  <div class="r-actions">
    <button class="btn btn-gold" data-act="replay">▶ ${S.r_replay}</button>
    <button class="btn" data-act="rshare">${S.r_share}</button>
    <a class="btn" href="${CREATE}">${S.r_new}</a>
  </div>
  <p class="muted small center">${S.r_expire}</p>`;
  paintWall();
  app.querySelector('[data-act="wsend"]').onclick = async (ev) => {
    const b = ev.currentTarget, box = app.querySelector(".wall-compose");
    const msg = box.querySelector("[name=wmsg]").value.trim().slice(0, 280), nm = titleCase(box.querySelector("[name=wnm]").value).slice(0, 24);
    const wn = box.querySelector("[name=wname]"), name = (me()?.name || (wn ? titleCase(wn.value) : "")).slice(0, 40);
    if (!name) { toast(S.j_err_empty); wn?.focus(); return; }
    if (!msg && !nm) { toast(S.w_empty); return; }
    b.disabled = true;
    try {
      await fb.postWall(R.id, { name, ...(msg ? { msg } : {}), ...(nm ? { nm } : {}) });
      track(nm ? "mesaj-isim" : "mesaj");
      ["wmsg", "wnm"].forEach(k => { box.querySelector(`[name=${k}]`).value = ""; delete R.drafts[k]; });
      sfx.plop(); toast(S.w_sent);
    } catch (e) { console.error(e); toast(S.err_generic); }
    b.disabled = false;
  };
  const pdfBtn = app.querySelector('[data-act="pdf"]');
  if (pdfBtn) pdfBtn.onclick = () => { track("pdf"); printGuesses(R, guesses, girl); };
  app.querySelector('[data-act="replay"]').onclick = () => { unlock(); runShow(true); };
  app.querySelector('[data-act="story"]').onclick = (ev) => { track("hikaye"); shareStory(R, girl, ev.currentTarget); };
  app.querySelector('[data-act="rshare"]').onclick = () => share(fmt(girl ? S.r_share_text_girl : S.r_share_text_boy, babyOf(m)) + "\n" + roomUrl(R.id));
}

// Mesaj duvarı ve isim önerileri: yalnız bu bölümler canlı güncellenir (sayfanın geri kalanı yerinde kalır)
const WALL_COLS = ["#FFE3EE", "#E2F2FF", "#FFF1CC", "#E8F7EE", "#F1E8FF"];
function paintWall() {
  const R = room, m = R?.meta, el = document.getElementById("wall"), ne = document.getElementById("wall-names");
  if (!R || !el) return;
  const all = Object.entries(R.wall || {}).map(([k, w]) => ({ k, ...w })).sort((a, b) => (b.at || 0) - (a.at || 0));
  const msgs = all.filter(w => w.msg);
  const list = Object.entries(R.votes || {}).filter(([u]) => u !== m.revealerUid).map(([u, v]) => ({ nm: v.nm, name: R.guests[u]?.name || "?" })).filter(v => v.nm);
  const names = [...list, ...all.filter(w => w.nm).map(w => ({ nm: w.nm, name: w.name }))];
  const canDel = (w) => w.uid === R.uid || m.hostUid === R.uid;
  if (ne) ne.innerHTML = names.length ? `<section class="res-card"><h2>💡 ${S.r_names}</h2><div class="res-names">${names.map(v => `<span class="nmchip"><b>${esc(v.nm)}</b><small>${esc(shortName(v.name))}</small></span>`).join("")}</div></section>` : "";
  el.hidden = !msgs.length;
  el.innerHTML = msgs.length ? `<h2>💌 ${S.w_title} <small class="muted">(${msgs.length})</small></h2><div class="wall-grid">${msgs.map((w, i) => {
    const h = hash(w.k), rot = ((h % 7) - 3) * .6;
    return `<figure class="note" style="--bg:${WALL_COLS[h % WALL_COLS.length]};--rot:${rot}deg;--d:${Math.min(i, 8) * 60}ms">
      <blockquote>${esc(w.msg)}</blockquote>
      <figcaption><span class="av" style="background:${PALETTE[hash(w.name) % PALETTE.length]}">${esc(initials(w.name))}</span>${esc(w.name)}</figcaption>
      ${canDel(w) ? `<button class="note-del" data-k="${w.k}" aria-label="${S.w_del}">✕</button>` : ""}</figure>`;
  }).join("")}</div>` : "";
  el.querySelectorAll(".note-del").forEach(b => b.onclick = async () => { if (!confirm(S.w_del_confirm)) return; try { await fb.deleteWall(R.id, b.dataset.k); } catch (e) { toast(S.err_generic); } });
}

// Türkçe ilgi hâli eki: Ali → Ali'nin, Mehmet → Mehmet'in, Burak → Burak'ın, Can → Can'ın
function genitiveTr(name) {
  const w = name.trim(), low = w.toLocaleLowerCase("tr");
  const vs = [...low].filter(c => "aeıioöuü".includes(c)), last = vs[vs.length - 1] || "e";
  const v = { a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" }[last];
  return w + "'" + ("aeıioöuü".includes(low[low.length - 1]) ? "n" : "") + v + "n";
}
const loadImg = (src) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// Instagram hikâyesi boyutunda (1080×1920) sonuç kartı
async function storyCanvas(R, girl) {
  const m = R.meta, W = 1080, H = 1920;
  try { await Promise.all([document.fonts.load('800 100px "Baloo 2"'), document.fonts.load('800 40px Nunito')]); } catch (e) {}
  const [stork, bal, icon, ab] = await Promise.all([loadImg(ASSET + "img/stork.png"), loadImg(ASSET + "img/balloon-" + (girl ? "pink" : "blue") + ".png"), loadImg(ASSET + "img/balloon-icon-180.png"), loadImg(ASSET + "img/anbertech.png")]);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  const c1 = girl ? "#FFD3E3" : "#D4EDFF", c2 = girl ? "#FF8FB8" : "#6DB9F5", c3 = girl ? "#D94C84" : "#2E7FCF", deep = girl ? "#B0175A" : "#0F4C91";
  const bg = g.createRadialGradient(W / 2, H * .42, 40, W / 2, H * .45, H * .8);
  bg.addColorStop(0, c1); bg.addColorStop(.5, c2); bg.addColorStop(1, c3);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // ışık hüzmeleri
  g.save(); g.translate(W / 2, H * .44);
  for (let i = 0; i < 20; i++) { g.rotate(Math.PI / 10); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(-60, H); g.lineTo(60, H); g.fill(); }
  g.restore();
  const glow = g.createRadialGradient(W / 2, H * .44, 0, W / 2, H * .44, 520); glow.addColorStop(0, "rgba(255,255,255,.55)"); glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // konfeti (sabit tohumlu, her seferinde aynı güzel dağılım)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cols = ["#fff", "#F2B93B", "#FFE08A", deep, "#fff"];
  for (let i = 0; i < 140; i++) { g.save(); g.translate(rnd() * W, rnd() * H); g.rotate(rnd() * 6.3); g.globalAlpha = .55 + rnd() * .45; g.fillStyle = cols[i % cols.length]; g.fillRect(-9, -15, 18, 30); g.restore(); }
  // balonlar
  if (bal) [[70, 1180, 230], [880, 1060, 200], [760, 1450, 260], [-10, 1500, 240], [900, 1650, 180]].forEach(([x, y, sz]) => { g.globalAlpha = .95; g.drawImage(bal, x - sz / 2 + sz / 2, y, sz, sz); });
  g.globalAlpha = 1;
  if (stork) g.drawImage(stork, W / 2 - 300, 170, 600, 600);
  const T = (txt, y, size, color, weight = 800, font = '"Baloo 2"', shadow = null) => {
    const ff = `${font}, "Baloo Bhaijaan 2", system-ui`;
    g.font = `${weight} ${size}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle";
    let sz = size; while (g.measureText(txt).width > W * .88 && sz > 20) { sz -= 4; g.font = `${weight} ${sz}px ${ff}`; }
    if (shadow) { g.fillStyle = shadow; g.fillText(txt, W / 2, y + sz * .07); }
    g.fillStyle = color; g.fillText(txt, W / 2, y);
  };
  const tr = LANG === "tr";
  // Türkçe: ünlü uyumlu ek (Ali'nin); İngilizce: 's; diğer diller: çeviri kalıbı ismi eksiz kullanır
  const who = !m.parents ? "" : tr ? (m.parents.includes(" & ") ? m.parents.split(" & ")[0] + " & " : "") + genitiveTr(m.parents.split(" & ").pop()) : LANG === "en" ? m.parents + "'s" : m.parents;
  g.shadowColor = "rgba(0,0,0,.18)"; g.shadowBlur = 24;
  T(who ? fmt(S.st_baby_of, who) : S.st_its, 860, 64, "#fff", 800, 'Nunito');
  g.shadowBlur = 40; g.shadowOffsetY = 18;
  T(girl ? S.girl_big : S.boy_big, 1040, 300, "#fff", 800, '"Baloo 2"', deep);
  g.shadowBlur = 20; g.shadowOffsetY = 6;
  T(fmt(girl ? S.st_coming_girl : S.st_coming_boy, babyOf(m)), 1250, 70, "#fff");
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  const today = dtf({ day: "numeric", month: "long", year: "numeric" }).format(new Date());
  // tarih rozeti
  g.font = '800 46px Nunito, system-ui'; const dw = g.measureText(today).width + 80;
  g.fillStyle = "rgba(255,255,255,.92)"; roundRectPath(g, W / 2 - dw / 2, 1335, dw, 84, 42); g.fill();
  g.fillStyle = deep; g.textAlign = "center"; g.fillText(today, W / 2, 1379);
  // alt marka şeridi (her dilde soldan sağa)
  g.direction = "ltr";
  g.fillStyle = "rgba(255,255,255,.94)"; roundRectPath(g, 150, 1690, W - 300, 150, 75); g.fill();
  if (icon) g.drawImage(icon, 205, 1712, 106, 106);
  g.textAlign = "left"; g.textBaseline = "middle";
  g.font = '800 66px "Baloo 2", system-ui';
  let x = 330; [["Pink", "#D6336C"], ["Or", "#2B2140"], ["Blue", "#1C6FB8"]].forEach(([t, c]) => { g.fillStyle = c; g.fillText(t, x, 1752); x += g.measureText(t).width; });
  g.font = '800 34px Nunito, system-ui'; g.fillStyle = "#6E6380"; g.fillText("by", 332, 1806);
  if (ab) g.drawImage(ab, 380, 1788, 38, 35);
  g.fillStyle = "#2B2140"; g.fillText("Anber", 426, 1806); const aw = g.measureText("Anber").width; g.fillStyle = "#B8962E"; g.fillText("Tech", 426 + aw, 1806);
  return cv;
}
function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

let storyBusy = false;
async function shareStory(R, girl, btn) {
  if (storyBusy) return; storyBusy = true;
  btn.disabled = true; const old = btn.textContent; btn.textContent = S.wait;
  try {
    const cv = await storyCanvas(R, girl);
    const blob = await new Promise(res => cv.toBlob(res, "image/png"));
    const file = new File([blob], "pinkorblue-" + (girl ? "kiz" : "erkek") + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Yalnız dosya: metin eklenince WhatsApp görseli iki kez ekleyebiliyor
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(S.st_saved);
  } catch (e) { console.error(e); toast(S.err_generic); }
  finally { btn.disabled = false; btn.textContent = old; storyBusy = false; }
}
window.__pobStory = async () => { const R = room; return (await storyCanvas(R, R.result === "girl")).toDataURL("image/png"); };   // test için

// Tahmin listesini yazdırılabilir sayfa olarak aç → "PDF olarak kaydet"
function printGuesses(R, guesses, girl) {
  const m = R.meta;
  const all = [...guesses];
  Object.entries(R.votes || {}).forEach(([u, v]) => { if (u !== m.revealerUid && !all.some(x => x.uid === u)) all.push({ uid: u, name: R.guests[u]?.name || "?", ...v }); });
  const rows = all.map(v => `<tr class="${v.parent ? "p" : ""}"><td>${v.parent ? "👑 " : ""}${esc(v.name)}</td><td>${v.pick ? (v.pick === "girl" ? "🎀 " + S.girl : "🎩 " + S.boy) : "–"}</td><td>${v.birth ? esc(shortDate(v.birth)) : "–"}</td><td>${v.weight ? v.weight + " g" : "–"}</td><td>${esc(v.letter || "–")}</td></tr>`).join("");
  const title = (m.parents ? m.parents + " · " : "") + fmt(S.lobby_title, babyOf(m));
  const html = `<!doctype html><html lang="${LANG}" dir="${document.documentElement.dir || "ltr"}"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@600;800&display=swap&subset=latin-ext" rel="stylesheet">
  <style>body{font-family:Nunito,system-ui,sans-serif;color:#2B2140;margin:32px}h1{font:800 30px/1.1 "Baloo 2",system-ui;margin:0}
  .r{display:inline-block;margin:10px 0 18px;padding:6px 14px;border-radius:999px;background:${girl ? "#FFE3EE" : "#E2F2FF"};color:${girl ? "#C2185B" : "#1565C0"};font-weight:800}
  table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:start;font-size:12px;text-transform:uppercase;color:#6E6380;border-bottom:2px solid #EADFD0;padding:8px 6px}
  td{padding:9px 6px;border-bottom:1px solid #F1E8DA}tr.p td{background:#FFF7DD;font-weight:800}.f{margin-top:22px;font-size:12px;color:#6E6380}
  @media print{body{margin:14mm}button{display:none}}</style></head><body>
  <h1>${esc(title)}</h1><div class="r">${girl ? S.girl_big : S.boy_big} · ${esc(fmtDate(m.partyAt))}</div>
  <table><thead><tr><th>${S.pdf_name}</th><th>${S.pdf_pick}</th><th>${S.v_birth}</th><th>${S.v_weight}</th><th>${S.v_letter}</th></tr></thead><tbody>${rows}</tbody></table>
  ${Object.values(R.wall || {}).filter(w => w.msg).length ? `<h2 style="font:800 22px 'Baloo 2',system-ui;margin:26px 0 8px">💌 ${S.w_title}</h2>` + Object.values(R.wall).filter(w => w.msg).sort((a, b) => a.at - b.at).map(w => `<p style="margin:0 0 10px;padding:10px 14px;border-radius:12px;background:#FFF8EE"><b>${esc(w.name)}</b><br>${esc(w.msg)}</p>`).join("") : ""}
  ${Object.values(R.wall || {}).filter(w => w.nm).length ? `<h2 style="font:800 22px 'Baloo 2',system-ui;margin:26px 0 8px">💡 ${S.r_names}</h2><p>` + Object.values(R.wall).filter(w => w.nm).map(w => `<b>${esc(w.nm)}</b> (${esc(w.name)})`).join(" · ") + `</p>` : ""}
  <p class="f">PinkOrBlue · anbertech.github.io/PinkOrBlue</p>
  <button onclick="print()" style="margin-top:16px;padding:12px 18px;border-radius:12px;border:0;background:#F2B93B;font-weight:800">📄 ${S.r_pdf}</button>
  <script>window.onload=function(){setTimeout(function(){print()},400)}<\/script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast(S.pdf_blocked); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ---------------------------------------------------------------- yönlendirme
function route(justCreated) {
  routeGen++;
  keepHashInLangLinks();
  const hasR = /[#?&]r=/.test(location.hash + "&" + location.search);
  const id = roomId();
  if (id && /^[a-z0-9]{6,20}$/.test(id)) viewRoom(id, justCreated === true);
  else if (hasR) { cleanupRoom(); document.body.dataset.view = "room"; renderMissing(); }
  else if (window.POB_IS_INVITE) location.replace(CREATE);
  else { cleanupRoom(); viewCreate(); }
}
addEventListener("hashchange", () => route());
route();
