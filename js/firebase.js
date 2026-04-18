const firebaseConfig = {
  apiKey: "AIzaSyDINeXkzy4JCwt9cSjII5Icm-x_NpmtmK4",
  authDomain: "mysetup-8dcd5.firebaseapp.com",
  databaseURL: "https://mysetup-8dcd5-default-rtdb.firebaseio.com",
  projectId: "mysetup-8dcd5",
  storageBucket: "mysetup-8dcd5.firebasestorage.app",
  messagingSenderId: "888468129237",
  appId: "1:888468129237:web:9374ae62de891d7013295c",
  measurementId: "G-4RLPXBKYHR",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const isElectronRuntime =
  typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent);

/* ─── KRİTİK DÜZELTME 1: Long polling, database instance OLUŞTURULMADAN önce ayarlanmalı ─── */
/* Electron'da WebSocket bağlantısı sessizce başarısız olabilir.                              */
/* firebase.database() çağrılmadan ÖNCE forceLongPolling çağrılmazsa etkisizdir.             */
if (isElectronRuntime) {
  try {
    if (
      typeof firebase.database === "function" &&
      firebase.database.INTERNAL &&
      typeof firebase.database.INTERNAL.forceLongPolling === "function"
    ) {
      firebase.database.INTERNAL.forceLongPolling();

      /* Bazı ortamlarda WebSocket fallback'i listener'ı kilitleyebilir. */
      if (typeof firebase.database.INTERNAL.forceWebSockets === "function") {
        firebase.database.INTERNAL.forceWebSockets(false);
      }
    }
  } catch (_lpError) {
    /* sessizce devam et */
  }
}

const database = firebase.database();

/* database instance alındıktan sonra da settings() ile deneyelim (bazı compat sürümleri destekler) */
if (isElectronRuntime) {
  try {
    database.settings({ experimentalForceLongPolling: true });
  } catch (_settingsError) {
    /* bu API bazı compat sürümlerinde mevcut değil, sessizce geç */
  }
}

let userDataRef = null;
let currentUid = null;
let activeBasePath = null;

/* ─── KRİTİK DÜZELTME 2: .once() çağrısı için timeout wrapper ─────────────────────────── */
/* Electron'da WebSocket çalışmıyorsa .once("value") SONSUZA KADAR bekleyebilir.            */
/* Bu yüzden resolveAccessibleRef hiç resolve etmez, userDataRef null kalır,                */
/* ama addComponentToFirebase HTTP üzerinden yazabildiği için Firebase'e veri gider.        */
/* Kullanıcı veri ekleyebilir ama liste hep boş görünür. Bu asıl bug!                      */
function onceWithTimeout(ref, timeoutMs) {
  var ms = timeoutMs || 8000;
  return Promise.race([
    ref.once("value"),
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("Firebase .once() zaman aşımı (" + ms + "ms)"));
      }, ms);
    }),
  ]);
}

/* attach data listener fonksiyon basligi */

function attachDataListener(uid, dataRef, attempt) {
  const retryAttempt = typeof attempt === "number" ? attempt : 0;
  let hasRetriedAfterError = false;
  let hasReceivedFirstSnapshot = false;

  const firstSnapshotWatchdog = setTimeout(async () => {
    if (hasReceivedFirstSnapshot) return;
    if (retryAttempt >= 1) {
      updateSystemStatus("Veri dinleyici başlatılamadı", "error");
      if (typeof showToast === "function") {
        showToast(
          "Liste verisi alınamıyor. Bağlantı tekrar denenemedi.",
          "error",
          5200,
        );
      }
      return;
    }

    try {
      const user = firebase.auth?.().currentUser;
      if (user) {
        await user.getIdToken(true);
      }
    } catch (_refreshError) {}

    dataRef.off();
    attachDataListener(uid, dataRef, retryAttempt + 1);
  }, 12000);

  dataRef.on(
    "value",
    (snapshot) => {
      hasReceivedFirstSnapshot = true;
      clearTimeout(firstSnapshotWatchdog);
      allData = snapshot.val() || {};
      if (typeof renderAll === "function") {
        renderAll();
      }
      updateSystemStatus("Bağlandı", "ok");
    },
    async () => {
      if (!hasRetriedAfterError) {
        hasRetriedAfterError = true;
        try {
          const user = firebase.auth?.().currentUser;
          if (user) {
            await user.getIdToken(true);
            clearTimeout(firstSnapshotWatchdog);
            dataRef.off();
            attachDataListener(uid, dataRef, retryAttempt + 1);
            return;
          }
        } catch (_retryError) {}
      }

      clearTimeout(firstSnapshotWatchdog);
      updateSystemStatus("Veri alınamadı", "error");
      if (typeof showToast === "function") {
        showToast("Firebase bağlantı/izin hatası", "error", 5200);
      }
    },
  );
}

/* update system status fonksiyon basligi */

function updateSystemStatus(text, state) {
  if (statusText) statusText.textContent = text;
  if (statusPanel) {
    statusPanel.className = "status-panel" + (state ? ` status-${state}` : "");
  }
}

updateSystemStatus("Bağlanıyor...", "warn");

database.ref(".info/connected").on("value", (snapshot) => {
  const isConnected = snapshot.val() === true;
  updateSystemStatus(
    isConnected ? "Bağlandı" : "Bağlantı Kesildi",
    isConnected ? "ok" : "error",
  );
});

/* resolve accessible ref fonksiyon basligi */

async function resolveAccessibleRef(uid) {
  const candidates = [];

  if (uid) {
    candidates.push({
      path: `users/${uid}/components`,
      ref: database.ref("users/" + uid + "/components"),
    });
  }

  candidates.push({
    path: "components",
    ref: database.ref("components"),
  });

  for (const candidate of candidates) {
    try {
      await onceWithTimeout(candidate.ref, 8000);
      return candidate;
    } catch (_error) {}
  }

  return null;
}

/* init user data ref fonksiyon basligi */

function initUserDataRef(uid) {
  if (userDataRef) userDataRef.off();

  if (!uid) {
    currentUid = null;
    userDataRef = null;
    activeBasePath = null;
    allData = {};
    if (typeof renderAll === "function") renderAll();
    updateSystemStatus("Kullanıcı doğrulanamadı", "error");
    return null;
  }

  currentUid = uid;

  /* ─── KRİTİK DÜZELTME 3: ref resolve edilmeden ÖNCE token yenileme ──────────────────── */
  /* Firebase token'ı süresi dolmuşsa (>1 saat) .once() izin hatası verir.                */
  /* Electron'da browser otomatik yenileyemez, elle force refresh şart.                   */
  const setupRef = async () => {
    try {
      const user = firebase.auth?.().currentUser;
      if (user) {
        await user.getIdToken(
          true,
        ); /* force refresh - süresi dolmuş token'ı yenile */
      }
    } catch (_tokenError) {
      /* token yenileme başarısız olsa bile devam et */
    }

    let resolved = null;
    try {
      resolved = await resolveAccessibleRef(uid);
    } catch (_resolveError) {}

    if (!resolved) {
      updateSystemStatus("Veri yolu izni yok", "error");
      if (typeof showToast === "function") {
        showToast(
          "Firebase izni bulunamadı. Rules ayarını kontrol edin.",
          "error",
          5200,
        );
      }
      return;
    }

    activeBasePath = resolved.path;
    userDataRef = resolved.ref;

    attachDataListener(uid, userDataRef, 0);
  };

  setupRef();
  return null;
}

/* ensure data ref ready fonksiyon basligi */

function ensureDataRefReady() {
  if (!userDataRef || !activeBasePath) {
    return Promise.reject(new Error("Kullanıcı verisi hazır değil"));
  }
  return null;
}

/* add component to firebase fonksiyon basligi */

function addComponentToFirebase(itemData) {
  const err = ensureDataRefReady();
  if (err) return err;
  return userDataRef.push(itemData);
}

/* replace user data in firebase fonksiyon basligi */

function replaceUserDataInFirebase(itemsMap) {
  const err = ensureDataRefReady();
  if (err) return err;
  return userDataRef.set(itemsMap || {});
}

/* update component in firebase fonksiyon basligi */

function updateComponentInFirebase(id, itemData) {
  const err = ensureDataRefReady();
  if (err) return err;
  return database.ref(activeBasePath + "/" + id).update(itemData);
}

/* update component status in firebase fonksiyon basligi */

function updateComponentStatusInFirebase(id, newStatus) {
  const err = ensureDataRefReady();
  if (err) return err;
  return database.ref(activeBasePath + "/" + id).update({ status: newStatus });
}

/* delete component from firebase fonksiyon basligi */

function deleteComponentFromFirebase(id) {
  const err = ensureDataRefReady();
  if (err) return err;
  return database.ref(activeBasePath + "/" + id).remove();
}
