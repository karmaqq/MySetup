/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ENVANTER FIREBASE İŞLEMLERİ                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { get, ref, push, set, update, remove, ThenableReference } from "firebase/database";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { db } from "../core/firebase-init";
import { extractPathFromUrl } from "../core/global-ut";

/* ─────────────────── Bileşen CRUD ─────────────────── */

export function addComponentToFirebase(itemData: any): ThenableReference {
  return push(db.userDataRef!, itemData) as ThenableReference;
}

/* ── Toplu Veri İşlemleri ── */

export function replaceUserDataInFirebase(itemsMap: Record<string, any>): Promise<void> {
  return set(db.userDataRef!, itemsMap || {});
}

/* ── Bileşen Güncelleme ── */

export function updateComponentInFirebase(id: string, itemData: any): Promise<void> {
  return update(ref(db.database, db.activeBasePath + "/" + id), itemData);
}

/* ── Durum Güncelleme ── */

export function updateComponentStatusInFirebase(id: string, newStatus: string): Promise<void> {
  return update(ref(db.database, db.activeBasePath + "/" + id), { status: newStatus });
}

/* ── Bileşen Silme ── */

export async function deleteComponentFromFirebase(id: string): Promise<void> {
  const itemRef = ref(db.database, db.activeBasePath + "/" + id);
  const snap = await get(itemRef);
  const item = snap.val() as any;
  if (item && item.imageUrl) {
    try {
      await deleteObject(storageRef(getStorage(), item.imagePath || extractPathFromUrl(item.imageUrl) || item.imageUrl));
    } catch (_) {}
  }
  await remove(itemRef);
}
