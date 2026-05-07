/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FIREBASE ANA YAPISI                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase Config ─────────────────── */

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

/* ─────────────────── Enrich Item ─────────────────── */

function enrichItem(item) {
  var searchRaw = (
    (item.component || "") + " " +
    (item.brand || "") + " " +
    (item.specs || "") + " " +
    (item.vendor || "")
  ).toLowerCase();
  return Object.assign({}, item, {
    _searchTag: normalizeTr(searchRaw),
    _statusNorm: normalizeTr(item.status || ""),
  });
}

/* ─────────────────── Init User Data ─────────────────── */

function initUserDataRef(userId) {
  var sessionToken = Date.now() + "_" + Math.random();
  initUserDataRef._activeToken = sessionToken;

  if (userDataRef) {
    userDataRef.off();
    userDataRef = null;
  }

  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  if (!userId) {
    activeBasePath = null;
    allData = {};
    if (typeof renderAll === "function") renderAll();
    return;
  }

  activeBasePath = "users/" + userId + "/components";
  userDataRef = database.ref(activeBasePath);

  userDataRef.once("value").then(function (snapshot) {
    if (initUserDataRef._activeToken !== sessionToken) return;
    var rawData = snapshot.val() || {};
    allData = {};
    Object.keys(rawData).forEach(function (id) {
      var item = enrichItem(rawData[id]);
      item.id = id;
      allData[id] = item;
    });
    if (typeof rebuildStatsCache === "function") rebuildStatsCache();
    if (typeof renderAll === "function") renderAll();

    // Listener'ları burada kur
    userDataRef.on(
      "child_added",
      function (snapshot) {
        if (initUserDataRef._activeToken !== sessionToken) return;
        var id = snapshot.key;
        var item = enrichItem(snapshot.val());
        item.id = id;
        var oldItem = allData[id];
        allData[id] = item;
        updateStatsCacheOnChange(item, oldItem, false);
        if (typeof addOrUpdateTableRow === "function")
          addOrUpdateTableRow(id, item);
      },
      function (err) {
        if (initUserDataRef._activeToken !== sessionToken) return;
        if (!userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
        console.error("child_added error:", err);
      },
    );

    userDataRef.on(
      "child_changed",
      function (snapshot) {
        if (initUserDataRef._activeToken !== sessionToken) return;
        var id = snapshot.key;
        var item = enrichItem(snapshot.val());
        item.id = id;
        var oldItem = allData[id];
        allData[id] = item;
        updateStatsCacheOnChange(item, oldItem, false);
        if (typeof addOrUpdateTableRow === "function")
          addOrUpdateTableRow(id, item);
      },
      function (err) {
        if (initUserDataRef._activeToken !== sessionToken) return;
        if (!userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
        console.error("child_changed error:", err);
      },
    );

    userDataRef.on(
      "child_removed",
      function (snapshot) {
        if (initUserDataRef._activeToken !== sessionToken) return;
        var id = snapshot.key;
        var oldItem = allData[id];
        delete allData[id];
        if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
        if (typeof removeTableRow === "function") removeTableRow(id);
      },
      function (err) {
        if (initUserDataRef._activeToken !== sessionToken) return;
        if (!userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
        console.error("child_removed error:", err);
      },
    );
  });
}

initUserDataRef._activeToken = null;
