/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ENVANTER FIREBASE İŞLEMLERİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Component CRUD ─────────────────── */

function addComponentToFirebase(itemData) {
  return userDataRef.push(itemData);
}

function replaceUserDataInFirebase(itemsMap) {
  return userDataRef.set(itemsMap || {});
}

function updateComponentInFirebase(id, itemData) {
  return database.ref(activeBasePath + "/" + id).update(itemData);
}

function updateComponentStatusInFirebase(id, newStatus) {
  return database.ref(activeBasePath + "/" + id).update({ status: newStatus });
}

function deleteComponentFromFirebase(id) {
  return database.ref(activeBasePath + "/" + id).remove();
}

/* ─────────────────── Storage İşlemleri ─────────────────── */

function uploadImageToFirebase(file, itemId) {
  return new Promise(function (resolve, reject) {
    var user = firebase.auth().currentUser;
    if (!user) return reject("Kullanıcı yok");
    var storageRef = firebase.storage().ref();
    var imageRef = storageRef.child(
      "users/" + user.uid + "/components/" + itemId + "/image",
    );
    var uploadTask = imageRef.put(file);
    uploadTask.on(
      "state_changed",
      null,
      function (error) {
        reject(error);
      },
      function () {
        uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
      },
    );
  });
}

async function deleteAllInFolder(ref) {
  var list = await ref.listAll();
  await Promise.all(
    list.items.map(function (item) {
      return item.delete();
    }),
  );
  await Promise.all(list.prefixes.map(deleteAllInFolder));
}
