/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       FIREBASE VERİTABANI YÖNETİMİ                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

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

let userDataRef = null;
let activeBasePath = null;
let _pollId = null;

/* ─────────────────── REST ile Veri Çek ─────────────────── */

async function fetchRest(path) {
  const user = firebase.auth().currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  const res = await fetch(firebaseConfig.databaseURL + "/" + path + ".json", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) return null;
  return res.json();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       VERİ OKUMA                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function initUserDataRef(uid) {
  if (userDataRef) userDataRef.off();
  if (_pollId) {
    clearInterval(_pollId);
    _pollId = null;
  }

  if (!uid) {
    userDataRef = null;
    activeBasePath = null;
    allData = {};
    if (typeof renderAll === "function") renderAll();
    return;
  }

  activeBasePath = "users/" + uid + "/components";
  userDataRef = database.ref(activeBasePath);

  fetchRest(activeBasePath)
    .then((data) => {
      if (data !== null) {
        allData = data || {};
        if (typeof renderAll === "function") renderAll();
      }
    })
    .catch(() => {});

  let rtActive = false;

  userDataRef.on(
    "value",
    (snap) => {
      rtActive = true;
      if (_pollId) {
        clearInterval(_pollId);
        _pollId = null;
      }
      allData = snap.val() || {};
      if (typeof renderAll === "function") renderAll();
    },
    () => {},
  );

  setTimeout(() => {
    if (!rtActive && !_pollId) {
      _pollId = setInterval(() => {
        fetchRest(activeBasePath)
          .then((data) => {
            if (data === null) return;
            const fresh = data || {};
            if (JSON.stringify(fresh) !== JSON.stringify(allData)) {
              allData = fresh;
              if (typeof renderAll === "function") renderAll();
            }
          })
          .catch(() => {});
      }, 15000);
    }
  }, 4000);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              VERİ YAZMA                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

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

// Firebase Storage'a görsel yükle ve URL döndür
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
