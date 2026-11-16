// Süresi dolan odaları siler (parti tarihi + 7 gün). Günde iki kez çalışır.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

initializeApp();

export const sweepExpiredRooms = onSchedule({ schedule: "every 12 hours", region: "europe-west1", timeZone: "Europe/Istanbul" }, async () => {
  const db = getDatabase();
  let total = 0;
  for (;;) {
    const snap = await db.ref("expiry").orderByValue().endAt(Date.now()).limitToFirst(200).get();
    if (!snap.exists()) break;
    const up = {};
    snap.forEach(c => { up["rooms/" + c.key] = null; up["expiry/" + c.key] = null; });
    await db.ref().update(up);
    total += snap.numChildren();
    if (snap.numChildren() < 200) break;
  }
  console.log("silinen oda:", total);
});
