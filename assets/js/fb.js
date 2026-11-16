// PinkOrBlue veri katmanı: Firebase Realtime Database + anonim giriş.
// Config build.py tarafından window.POB_FB olarak sayfaya gömülür.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase, connectDatabaseEmulator, ref, set, update, get, remove, onValue, onDisconnect,
  serverTimestamp
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

export async function createRoom({ babyName, partyAt, lang, invitees, hostName }) {
  const uid = await ready;
  const id = newId();
  const expiresAt = partyAt + WEEK;
  const up = {};
  up["expiry/" + id] = expiresAt;
  up["rooms/" + id + "/meta"] = {
    babyName, partyAt, expiresAt, lang, hostUid: uid, revealerUid: uid,
    status: "open", createdAt: serverTimestamp()
  };
  await update(ref(db), up);
  const rest = {};
  if (invitees && invitees.length) {
    const inv = {};
    invitees.forEach((n, i) => { inv["i" + i] = n; });
    rest["rooms/" + id + "/invitees"] = inv;
  }
  rest["rooms/" + id + "/guests/" + uid] = { name: hostName, joinedAt: serverTimestamp() };
  await update(ref(db), rest);
  return id;
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
  await update(r(id), { ["votes/" + uid]: data, ["guests/" + uid + "/voted"]: true });
}

let connected = false;
onValue(ref(db, ".info/connected"), s => { connected = s.val() === true; });
export const isConnected = () => connected;

export async function myVote(id) {
  const uid = await ready;
  return (await get(r(id, "votes/" + uid))).val();
}

export async function presence(id) {
  const uid = await ready;
  const p = r(id, "presence/" + uid);
  onValue(ref(db, ".info/connected"), async s => {
    if (s.val() === true) {
      await onDisconnect(p).remove();
      await set(p, serverTimestamp());
    }
  });
}

export async function setInvitees(id, names) {
  const inv = {};
  names.forEach((n, i) => { inv["i" + i] = n; });
  await set(r(id, "invitees"), inv);
}

export const delegate = (id, uid) => set(r(id, "meta/revealerUid"), uid);

export async function seal(id, pick) {
  const uid = await ready;
  await set(r(id, "sealed/" + uid), pick);
}

export async function mySeal(id) {
  const uid = await ready;
  return (await get(r(id, "sealed/" + uid))).val();
}

export async function startReveal(id, pick, delayMs) {
  const up = {};
  up["meta/status"] = "reveal";
  up["meta/result"] = pick;
  up["meta/revealAt"] = Math.round(serverNow() + delayMs);
  await update(r(id), up);
}

export async function setTaps(id, n) {
  const uid = await ready;
  await set(r(id, "taps/" + uid), Math.min(2000, n));
}

export async function setScore(id, name, score) {
  const uid = await ready;
  const cur = (await get(r(id, "scores/" + uid))).val();
  if (!cur || score > cur.score) await set(r(id, "scores/" + uid), { name, score });
}

export async function deleteRoom(id) {
  await remove(r(id));
  await remove(ref(db, "expiry/" + id)).catch(() => {});
}
