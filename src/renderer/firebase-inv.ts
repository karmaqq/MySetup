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

/* ─────────────────── Storage İşlemleri ─────────────────── */

export function uploadImageToFirebase(file: File, itemId: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    const user = firebase.auth().currentUser;
    if (!user) return reject("Kullanıcı yok");
    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child(
      "users/" + user.uid + "/components/" + itemId + "/image",
    );
    const uploadTask = imageRef.put(file);
    uploadTask.on(
      "state_changed",
      undefined,
      function (error: any) {
        reject(error);
      },
      function () {
        uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
      },
    );
  });
}

export async function deleteAllInFolder(ref: firebase.storage.StorageReference): Promise<void> {
  const list = await ref.listAll();
  const BATCH = 10;
  for (let i = 0; i < list.items.length; i += BATCH) {
    await Promise.all(
      list.items.slice(i, i + BATCH).map(function (item) {
        return item.delete();
      }),
    );
  }
  for (let i = 0; i < list.prefixes.length; i += BATCH) {
    await Promise.all(
      list.prefixes.slice(i, i + BATCH).map(deleteAllInFolder),
    );
  }
}
