/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        FIREBASE BAŞLATMA / ORTAK REFERANSLAR               */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, Database, DatabaseReference } from "firebase/database";

/* ─────────────────── Firebase Config Çözümleme ─────────────────── */

function _resolveFirebaseConfig(): Record<string, string> | null {
  if (window.__FB_CONFIG__?.apiKey) return window.__FB_CONFIG__;
  return null;
}

/* ─────────────────── Paylaşılan Referanslar ─────────────────── */

export const db = {
  database: null as unknown as Database,
  userDataRef: null as DatabaseReference | null,
  activeBasePath: null as string | null,
  postsRef: null as unknown as DatabaseReference,
  userPostsRef: null as unknown as DatabaseReference,
  userLikesRef: null as unknown as DatabaseReference,
};

/* ─────────────────── Firebase Başlatma ─────────────────── */

const firebaseConfig = _resolveFirebaseConfig();

if (firebaseConfig) {
  if (!getApps().length) initializeApp(firebaseConfig);
  db.database = getDatabase();
  db.postsRef = ref(db.database, "posts");
  db.userPostsRef = ref(db.database, "userPosts");
  db.userLikesRef = ref(db.database, "userLikes");
}

/* ─────────────────── Web Modu CSS Sınıfı ─────────────────── */

if (typeof __IS_WEB__ !== "undefined" && __IS_WEB__) {
  document.documentElement.classList.add("web");
}
