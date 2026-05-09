/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      RENDERER GİRİŞ NOKTASI                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* Tüm modülleri import ederek esbuild bundle'ına dahil eder */

/* Altyapı (0 bağımlılık) */
import "./firebase-init";

/* Yardımcılar (firebase-config hariç her şeye bağımlı) */
import "./utils";

/* Firebase işlemleri (firebase-init + utils) */
import "./firebase-core";
import "./firebase-inv";
import "./firebase-user";
import "./firebase-post";

/* UI işlemleri */
import "./io";
import "./table";
import "./editmodal";
import "./auth";
import "./userset";
import "./updater-ui";

/* Post sistemi */
import "./post-comment";
import "./posts-create";
import "./posts-render";
import "./posts-actions";
import "./profile";
import "./post-view";

console.log("[MySetup] Renderer bundle loaded successfully");
