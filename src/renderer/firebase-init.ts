/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        FIREBASE BAŞLATMA / ORTAK REFERANSLAR                */
/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Bu dosya: Firebase'i başlatır ve tüm modüllerin paylaştığı referansları  */
/*  (database, userDataRef, postsRef vb.) tek bir yerde tutar.              */
/*  Hiçbir renderer modülüne bağımlı değildir.                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase Config Çözümleme ─────────────────── */

function _resolveFirebaseConfig(): Record<string, string> | null {
  if (window.__FB_CONFIG__?.apiKey) return window.__FB_CONFIG__;
  return null;
}

/* ─────────────────── Paylaşılan Referanslar ─────────────────── */
/*  Tüm modüller bu objeyi import eder. Mutasyonlar (örn. initUserDataRef)  */
/*  bu objenin property'leri üzerinden yapılır.                              */

export const db = {
  database: null as firebase.database.Database | null,
  userDataRef: null as firebase.database.Reference | null,
  activeBasePath: null as string | null,
  postsRef: null as firebase.database.Reference | null,
  userPostsRef: null as firebase.database.Reference | null,
  userLikesRef: null as firebase.database.Reference | null,
};

/* ─────────────────── Firebase Başlatma ─────────────────── */

const firebaseConfig = _resolveFirebaseConfig();

if (firebaseConfig) {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  db.database = firebase.database();
  db.postsRef = db.database.ref("posts");
  db.userPostsRef = db.database.ref("userPosts");
  db.userLikesRef = db.database.ref("userLikes");
}
