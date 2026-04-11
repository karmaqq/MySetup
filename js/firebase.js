/* ─── FIREBASE AYARLARI ───────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyDINeXkzy4JCwt9cSjII5Icm-x_NpmtmK4",
  databaseURL: "https://mysetup-8dcd5-default-rtdb.firebaseio.com",
  projectId: "mysetup-8dcd5",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dataRef = database.ref("components");

/* ─── BAĞLANTI DURUMU ────────────────────────────────────────────────────────── */
function updateSystemStatus(text, state) {
  statusText.textContent = text;
  statusPanel.className = "status-panel" + (state ? ` status-${state}` : "");
}

updateSystemStatus("Bağlanıyor...", "warn");

database.ref(".info/connected").on("value", (snapshot) => {
  updateSystemStatus(
    snapshot.val() ? "Bağlandı" : "Bağlantı Kesildi",
    snapshot.val() ? "ok" : "error",
  );
});

/* ─── VERİ DİNLEYİCİ ─────────────────────────────────────────────────────────── */
// renderAll() → table.js'de tanımlı; Firebase callback async olduğundan
// tüm script'ler yüklenmiş olacak ve fonksiyon erişilebilir olacak.
dataRef.on(
  "value",
  (snapshot) => {
    allData = snapshot.val() || {};
    renderAll();
  },
  () => updateSystemStatus("Veri alınamadı", "error"),
);
