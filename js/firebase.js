/* ═══════════════════════════════════════════════════════════════════════════════════ */
/*                       FIREBASE VERİTABANI YÖNETİMİ                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İtem Zenginleştirme ─────────────────── */

function enrichItem(item) {
  const searchRaw = `${item.component} ${item.brand} ${item.specs} ${item.vendor}`;
  return {
    ...item,
    _searchTag: normalizeTr(searchRaw),
    _statusNorm: normalizeTr(item.status),
  };
}

/* ─────────────────── Firebase Yapılandırma ─────────────────── */

const firebaseConfig = {
  apiKey: "AIzaSyDINeXkzy4JCwt9cSjII5Icm-x_NpmtmK4",
  authDomain: "mysetup-8dcd5.firebaseapp.com",
  databaseURL: "https://mysetup-8dcd5-default-rtdb.firebaseio.com",
  projectId: "mysetup-8dcd5",
  storageBucket: "mysetup-8dcd5.firebasestorage.app",
  messagingSenderId: "888468129237",
  appId: "1:888468129237:web:9374ae62de891d7013295c",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/* ─────────────────── Bağlantı Durumu Değişkenleri ─────────────────── */

let userDataRef = null;
let activeBasePath = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          VERİ OKUMA                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kullanıcı Verisi Dinleyici Başlat ─────────────────── */

function initUserDataRef(uid) {
  if (userDataRef) {
    userDataRef.off();
    userDataRef = null;
  }

  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  if (!uid) {
    activeBasePath = null;
    allData = {};
    if (typeof renderAll === "function") renderAll();
    return;
  }

  activeBasePath = "users/" + uid + "/components";
  userDataRef = database.ref(activeBasePath);
  let firstLoad = true;
  userDataRef.once("value").then((snap) => {
    const rawData = snap.val() || {};
    allData = Object.keys(rawData).reduce((acc, id) => {
      acc[id] = enrichItem(rawData[id]);
      return acc;
    }, {});
    rebuildStatsCache();
    if (typeof renderAll === "function") renderAll();
    firstLoad = false;
  });

  userDataRef.on(
    "child_added",
    (snap) => {
      if (firstLoad) return;
      const id = snap.key;
      const item = enrichItem(snap.val());
      const oldItem = allData[id];
      allData[id] = item;
      updateStatsCacheOnChange(item, oldItem, false);
      if (typeof addOrUpdateTableRow === "function")
        addOrUpdateTableRow(id, allData[id]);
      if (typeof updateResultCount === "function") {
        const filteredList = getFilteredSortedList();
        updateResultCount(filteredList.length);
      }
    },
    (err) => console.error("child_added hata:", err),
  );
  userDataRef.on(
    "child_changed",
    (snap) => {
      const id = snap.key;
      const item = enrichItem(snap.val());
      const oldItem = allData[id];
      allData[id] = item;
      updateStatsCacheOnChange(item, oldItem, false);
      if (typeof addOrUpdateTableRow === "function")
        addOrUpdateTableRow(id, allData[id]);
      if (typeof updateResultCount === "function") {
        const filteredList = getFilteredSortedList();
        updateResultCount(filteredList.length);
      }
    },
    (err) => console.error("child_changed hata:", err),
  );
  userDataRef.on(
    "child_removed",
    (snap) => {
      const id = snap.key;
      const oldItem = allData[id];
      delete allData[id];
      if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
      if (typeof removeTableRow === "function") removeTableRow(id);
      if (typeof updateResultCount === "function") {
        const filteredList = getFilteredSortedList();
        updateResultCount(filteredList.length);
      }
    },
    (err) => console.error("child_removed hata:", err),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          VERİ YAZMA                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kayıt Ekle ─────────────────── */

function addComponentToFirebase(itemData) {
  return userDataRef.push(itemData);
}

/* ─────────────────── Tüm Veriyi Değiştir ─────────────────── */

function replaceUserDataInFirebase(itemsMap) {
  return userDataRef.set(itemsMap || {});
}

/* ─────────────────── Kayıt Güncelle ─────────────────── */

function updateComponentInFirebase(id, itemData) {
  return database.ref(activeBasePath + "/" + id).update(itemData);
}

/* ─────────────────── Kayıt Durumu Güncelle ─────────────────── */

function updateComponentStatusInFirebase(id, newStatus) {
  return database.ref(activeBasePath + "/" + id).update({ status: newStatus });
}

/* ─────────────────── Kayıt Sil ─────────────────── */

function deleteComponentFromFirebase(id) {
  return database.ref(activeBasePath + "/" + id).remove();
}

/* ─────────────────── Görsel Yükle ─────────────────── */

function uploadImageToFirebase(file, itemId) {
  return new Promise((resolve, reject) => {
    const user = firebase.auth().currentUser;
    if (!user) return reject("Kullanıcı yok");
    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child(
      `users/${user.uid}/components/${itemId}/image`,
    );
    const uploadTask = imageRef.put(file);
    uploadTask.on(
      "state_changed",
      null,
      (error) => reject(error),
      () => {
        uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
      },
    );
  });
}
