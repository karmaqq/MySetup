/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       FIREBASE VERİTABANI YÖNETİMİ                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase Yapılandırma ─────────────────── */

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

/* ─────────────────── Electron Ortam Tespiti ─────────────────── */

const isElectronRuntime = !!(
  window.electronAPI ||
  (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent))
);

/* ─────────────────── Long Polling Zorlama ─────────────────── */

try {
  if (
    typeof firebase.database === "function" &&
    firebase.database.INTERNAL &&
    typeof firebase.database.INTERNAL.forceLongPolling === "function"
  ) {
    firebase.database.INTERNAL.forceLongPolling();
  }
} catch (_lpError) {}

/* ─────────────────── Veritabanı Bağlantısı ─────────────────── */

const database = firebase.database();

/* ─────────────────── Global Durum Değişkenleri ─────────────────── */

let userDataRef = null;
let currentUid = null;
let activeBasePath = null;
let restPollIntervalId = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           REST API FALLBACK                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── REST ile Veri Çekme ─────────────────── */

async function fetchViaRest(path, timeoutMs) {
  var ms = timeoutMs || 10000;
  var user = firebase.auth && firebase.auth().currentUser;
  if (!user) throw new Error("Kullanıcı oturum açmamış");

  var token = await user.getIdToken();
  var url = firebaseConfig.databaseURL + "/" + path + ".json";
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, ms);

  try {
    var res = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ─────────────────── REST Yoklama Durdurma ─────────────────── */

function stopRestPolling() {
  if (restPollIntervalId) {
    clearInterval(restPollIntervalId);
    restPollIntervalId = null;
  }
}

/* ─────────────────── REST Yoklama Başlatma ─────────────────── */

function startRestPolling(path) {
  stopRestPolling();
  var poll = async function () {
    try {
      var data = await fetchViaRest(path, 10000);
      allData = data || {};
      if (typeof renderAll === "function") renderAll();
    } catch (_e) {}
  };
  restPollIntervalId = setInterval(poll, 30000);
}

/* ─────────────────── Zaman Aşımlı Tek Okuma ─────────────────── */

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           VERİ DİNLEYİCİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function attachDataListener(uid, dataRef, attempt) {
  const retryAttempt = typeof attempt === "number" ? attempt : 0;
  let hasRetriedAfterError = false;
  let hasReceivedFirstSnapshot = false;

  const firstSnapshotWatchdog = setTimeout(async () => {
    if (hasReceivedFirstSnapshot) return;

    if (activeBasePath) {
      try {
        var restData = await fetchViaRest(activeBasePath, 10000);
        if (!hasReceivedFirstSnapshot) {
          allData = restData || {};
          if (typeof renderAll === "function") renderAll();
          updateSystemStatus("Bağlandı (REST)", "ok");
          hasReceivedFirstSnapshot = true;
          startRestPolling(activeBasePath);
          return;
        }
      } catch (_restError) {}
    }

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
      stopRestPolling();
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

/* ─────────────────── Sistem Durumu Güncelleme ─────────────────── */

function updateSystemStatus(text, state) {
  if (statusText) statusText.textContent = text;
  if (statusPanel) {
    statusPanel.className = "status-panel" + (state ? ` status-${state}` : "");
  }
}

updateSystemStatus("Bağlanıyor...", "warn");

/* ─────────────────── Bağlantı Durumu İzleyici ─────────────────── */

database.ref(".info/connected").on("value", (snapshot) => {
  const isConnected = snapshot.val() === true;
  updateSystemStatus(
    isConnected ? "Bağlandı" : "Bağlantı Kesildi",
    isConnected ? "ok" : "error",
  );
});

/* ─────────────────── Erişilebilir Ref Çözümleme ─────────────────── */

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

  for (const candidate of candidates) {
    try {
      await fetchViaRest(candidate.path, 8000);
      return candidate;
    } catch (_error) {}
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       KULLANICI VERİ BAŞLATMA                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

function initUserDataRef(uid) {
  if (userDataRef) userDataRef.off();
  stopRestPolling();

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

  const setupRef = async () => {
    try {
      const user = firebase.auth?.().currentUser;
      if (user) {
        await user.getIdToken(true);
      }
    } catch (_tokenError) {}

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

/* ─────────────────── Veri Referansı Hazır Kontrolü ─────────────────── */

function ensureDataRefReady() {
  if (!userDataRef || !activeBasePath) {
    return Promise.reject(new Error("Kullanıcı verisi hazır değil"));
  }
  return null;
}

/* ─────────────────── Yeni Bileşen Ekleme ─────────────────── */

function addComponentToFirebase(itemData) {
  const err = ensureDataRefReady();
  if (err) return err;
  return userDataRef.push(itemData);
}

/* ─────────────────── Tüm Veriyi Değiştirme ─────────────────── */

function replaceUserDataInFirebase(itemsMap) {
  const err = ensureDataRefReady();
  if (err) return err;
  return userDataRef.set(itemsMap || {});
}

/* ─────────────────── Bileşen Güncelleme ─────────────────── */

function updateComponentInFirebase(id, itemData) {
  const err = ensureDataRefReady();
  if (err) return err;
  return database.ref(activeBasePath + "/" + id).update(itemData);
}

/* ─────────────────── Durum Güncelleme ─────────────────── */

function updateComponentStatusInFirebase(id, newStatus) {
  const err = ensureDataRefReady();
  if (err) return err;
  return database.ref(activeBasePath + "/" + id).update({ status: newStatus });
}

/* ─────────────────── Bileşen Silme ─────────────────── */

function deleteComponentFromFirebase(id) {
  const err = ensureDataRefReady();
  if (err) return err;
  return database.ref(activeBasePath + "/" + id).remove();
}
