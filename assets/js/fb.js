// PinkOrBlue veri katmanı: Firebase Realtime Database + anonim giriş.
// Config build.py tarafından window.POB_FB olarak sayfaya gömülür.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase, connectDatabaseEmulator, ref, set, update, get, remove, onValue, onDisconnect,
  serverTimestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const app = initializeApp(window.POB_FB);
const auth = getAuth(app);
const db = getDatabase(app);
// Yerel test: http://127.0.0.1:8765/...?emu  -> emülatörlere bağlan
if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname) && /[?&]emu\b/.test(location.search)) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}
const WEEK = 7 * 24 * 3600 * 1000;

let offset = 0;
onValue(ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
export const serverNow = () => Date.now() + offset;

export const ready = new Promise((res, rej) => {
  onAuthStateChanged(auth, u => { if (u) res(u.uid); });
  signInAnonymously(auth).catch(rej);
});

const ID_ABC = "abcdefghjkmnpqrstuvwxyz23456789";
function newId(n = 10) {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(a, b => ID_ABC[b % ID_ABC.length]).join("");
}

export async function createRoom({ babyName, parents, partyAt, lang, invitees, hostName, password }) {
  const uid = await ready;
  const id = newId();
  const hostKey = newId(20);            // kurucu linki için gizli anahtar (veritabanında okunamaz)
  const expiresAt = partyAt + WEEK;
  const R = "rooms/" + id + "/";
  const up = {};
  up["expiry/" + id] = expiresAt;
  up[R + "meta"] = {
    babyName, partyAt, expiresAt, lang, hostUid: uid, revealerUid: uid, ...(parents ? { parents } : {}),
    status: "open", createdAt: serverTimestamp()
  };
  up[R + "hostkeys/" + hostKey] = true;
  if (password) { up[R + "lock/pw"] = password; up[R + "locked"] = true; }
  await update(ref(db), up);
  if (password) await set(ref(db, R + "members/" + uid), password);
  const rest = {};
  if (invitees && invitees.length) {
    const inv = {};
    invitees.forEach((n, i) => { inv["i" + i] = n; });
    rest[R + "invitees"] = inv;
  }
  rest[R + "guests/" + uid] = { name: hostName, joinedAt: serverTimestamp() };
  await update(ref(db), rest);
  return { id, hostKey };
}

// Şifreli mi? (meta okunamazsa bu bayrak yine okunur)
export async function isLocked(id) {
  try { return (await get(ref(db, "rooms/" + id + "/locked"))).val() === true; } catch (e) { return false; }
}
export async function isMember(id) {
  const uid = await ready;
  try { await get(ref(db, "rooms/" + id + "/meta/status")); return true; } catch (e) { return false; }
}
export async function enterPassword(id, pw) {
  const uid = await ready;
  try { await set(ref(db, "rooms/" + id + "/members/" + uid), pw); return true; } catch (e) { return false; }
}
// Kurucu linkiyle (anahtar) odayı bu cihaza al: geçmiş silinse, telefon değişse de çalışır
export async function claimHost(id, key, name) {
  const uid = await ready;
  const R = "rooms/" + id + "/";
  await set(ref(db, R + "claims/" + uid), key);
  try { await set(ref(db, R + "members/" + uid), key); } catch (e) { /* şifresiz odada üyelik gerekmez / zaten üye */ }
  const meta = (await get(ref(db, R + "meta"))).val();
  if (!meta) throw new Error("no-room");
  const oldName = (await get(ref(db, R + "guests/" + meta.hostUid + "/name"))).val();
  if (meta.hostUid === uid) return meta;
  if (meta.status === "open") {
    const g = (await get(ref(db, R + "guests/" + uid))).val();
    if (!g) await set(ref(db, R + "guests/" + uid), { name: (oldName || meta.parents || name).slice(0, 40), joinedAt: serverTimestamp() });
  }
  const wasRevealer = meta.revealerUid === meta.hostUid;
  await set(ref(db, R + "meta/hostUid"), uid);
  if (wasRevealer && meta.status === "open") await set(ref(db, R + "meta/revealerUid"), uid);
  return meta;
}

export const r = (id, path = "") => ref(db, "rooms/" + id + (path ? "/" + path : ""));

export function watch(id, path, cb) {
  return onValue(r(id, path), s => cb(s.val()), () => cb(null));
}

export async function join(id, name) {
  const uid = await ready;
  await set(r(id, "guests/" + uid), { name, joinedAt: serverTimestamp() });
}

export async function vote(id, data) {
  const uid = await ready;
  const up = { ["votes/" + uid]: data };
  if (data.pick) up["guests/" + uid + "/voted"] = true;
  await update(r(id), up);
}

let connected = false;
onValue(ref(db, ".info/connected"), s => { connected = s.val() === true; });
export const isConnected = () => connected;


// Her sekme/bağlantı kendi kaydını tutar (iki sekmeden biri kapanınca kişi çevrimdışı görünmesin)
const CONN = newId(8);
let presenceOff = null;
export async function presence(id) {
  const uid = await ready;
  if (presenceOff) presenceOff();
  const p = r(id, "presence/" + uid + "/" + CONN);
  presenceOff = onValue(ref(db, ".info/connected"), async s => {
    if (s.val() === true) {
      try { await onDisconnect(p).remove(); await set(p, serverTimestamp()); } catch (e) {}
    }
  });
}
export function presenceStop(id) {
  if (presenceOff) { presenceOff(); presenceOff = null; }
  ready.then(uid => remove(r(id, "presence/" + uid + "/" + CONN)).catch(() => {}));
}

export async function setInvitees(id, names) {
  const inv = {};
  names.forEach((n, i) => { inv["i" + i] = n; });
  await set(r(id, "invitees"), inv);
}

// Kurucu "son şarkıyı" başlatır: herkeste aynı saniyeden çalar
export const startFinalSong = (id) => set(r(id, "meta/musicAt"), serverTimestamp());
export const delegate = (id, uid) => set(r(id, "meta/revealerUid"), uid);

export async function seal(id, pick) {
  const uid = await ready;
  await set(r(id, "sealed/" + uid), pick);
}


export async function startReveal(id, pick, delayMs, players) {
  const up = {};
  up["meta/status"] = "reveal";
  up["res"] = pick;
  up["meta/revealAt"] = Math.round(serverNow() + delayMs);
  up["show/n"] = Math.max(1, Math.min(500, players | 0));
  await update(r(id), up);
}

// Şişirme turu sonucu: ilk yazan kazanır, herkes aynı sonucu görür
export async function setRound(id, k, o, t) {
  const up = { ["show/r/" + k]: { o, t: Math.max(0, Math.min(1e6, t | 0)) } };
  if (o === "pop") up["show/pop"] = k;
  try { await update(r(id), up); return true; } catch (e) { return false; }
}
// Sonuç yalnız patlama anına yakın okunabilir (kural zamanla açar); açılana kadar tekrar dene
export async function getResult(id) {
  try { return (await get(r(id, "res"))).val(); } catch (e) { return null; }
}

// Atomik artış: iki sekme ya da yenileme sayacı geri düşürmez
export async function addTaps(id, delta) {
  const uid = await ready;
  if (delta > 0) await set(r(id, "taps/" + uid), increment(delta));
}

export async function setScore(id, name, score) {
  const uid = await ready;
  await runTransaction(r(id, "scores/" + uid), cur => (!cur || score > cur.score) ? { name, score } : undefined);
}

// Açılış sonrası mesaj duvarı
export async function postWall(id, data) {
  const uid = await ready;
  const key = Date.now().toString(36) + newId(4);
  await set(r(id, "wall/" + key), { uid, ...data, at: serverTimestamp() });
}
export const deleteWall = (id, key) => remove(r(id, "wall/" + key));

export async function deleteRoom(id) {
  await update(ref(db), { ["rooms/" + id]: null, ["expiry/" + id]: null });
}
