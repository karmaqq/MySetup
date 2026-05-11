/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ENVANTER FIREBASE İŞLEMLERİ                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "./firebase-init";

/* ─────────────────── Bileşen CRUD ─────────────────── */

export function addComponentToFirebase(itemData: any): firebase.database.ThenableReference {
  return db.userDataRef!.push(itemData);
}

export function replaceUserDataInFirebase(itemsMap: Record<string, any>): Promise<void> {
  return db.userDataRef!.set(itemsMap || {});
}

export function updateComponentInFirebase(id: string, itemData: any): Promise<void> {
  return db.database!.ref(db.activeBasePath + "/" + id).update(itemData);
}

export function updateComponentStatusInFirebase(id: string, newStatus: string): Promise<void> {
  return db.database!.ref(db.activeBasePath + "/" + id).update({ status: newStatus });
}

export async function deleteComponentFromFirebase(id: string): Promise<void> {
  const itemRef = db.database!.ref(db.activeBasePath + "/" + id);
  const snap = await itemRef.once("value");
  const item = snap.val() as any;
  if (item && item.imageUrl) {
    try {
      await firebase.storage().refFromURL(item.imageUrl).delete();
    } catch (_) {}
  }
  await itemRef.remove();
}




