/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          NAVİGASYON VE OTURUM YÖNETİMİ                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { User } from "firebase/auth";
import { showPage, mainScroll } from "../core/app-state";
import { refreshAllAvatars } from "../core/global-fn";
import { initUserDataRef } from "../data/firebase-core";
import { initPosts, _teardownPosts } from "../social/post-listener";
import { closeAllModals } from "./settings";

/* ─────────────────── Navigasyon ve Sayfa Başlatma ─────────────────── */

function initNavigation(): void {
  const navBtns = document.querySelectorAll(".sidebar-nav-btn");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = (btn as HTMLElement).dataset.page;
      if (page) showPage(page);
    });
  });
}

initNavigation();

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         OTURUM DURUMU YÖNETİMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Giriş Yapıldığında ─────────────────── */

export function onUserLoggedIn(user: User): void {
  const authOverlay = document.getElementById("authOverlay");
  if (authOverlay) authOverlay.classList.remove("active");

  const sidebar = document.getElementById("sidebar");
  const mainScrollEl = document.getElementById("mainScroll");
  const appFooter = document.getElementById("appFooter");
  if (sidebar) sidebar.classList.remove("hidden");
  if (mainScrollEl) mainScrollEl.classList.remove("hidden");
  if (appFooter) appFooter.classList.remove("hidden");

  const userInfo = document.getElementById("userInfo");
  const userEmailEl = document.getElementById("userEmail");
  const profileUsername = document.getElementById("profileUsername");
  const profileEmail = document.getElementById("profileEmail");
  if (userInfo) userInfo.classList.remove("hidden");
  if (userEmailEl) userEmailEl.textContent = user.displayName || "Kullanıcı";
  if (profileUsername) profileUsername.textContent = user.displayName || "Kullanıcı";
  if (profileEmail) profileEmail.textContent = user.email || "E-posta yok";

  refreshAllAvatars(user.displayName || "");

  initUserDataRef(user.uid);
  initPosts();

  const lastPage = sessionStorage.getItem("_lastPage");
  if (lastPage && lastPage !== "home" && lastPage !== "postView") {
    showPage(lastPage);
  }

  if (lastPage === "postView") {
    const viewingPostId = sessionStorage.getItem("_viewingPostId");
    if (viewingPostId) {
      const _attemptRestorePostView = function (): void {
        const postData =
          (window as any).allPosts && (window as any).allPosts[viewingPostId];

        if (postData) {
          const pvPrevPage = sessionStorage.getItem("_pvPreviousPage") || "home";
          const pvScrollTop = parseInt(
            sessionStorage.getItem("_pvScrollTop") || "0",
            10,
          );

          if (typeof (window as any)._restorePostViewState === "function") {
            (window as any)._restorePostViewState(pvPrevPage, pvScrollTop);
          }

          if (typeof (window as any).openPostView === "function") {
            (window as any).openPostView(viewingPostId);
          }
        } else {
          sessionStorage.removeItem("_viewingPostId");
          sessionStorage.removeItem("_pvPreviousPage");
          sessionStorage.removeItem("_pvScrollTop");
          sessionStorage.setItem("_lastPage", "home");
          showPage("home");
        }
      };

      if ((window as any)._postsReadyFired) {
        _attemptRestorePostView();
      } else {
        document.addEventListener("postsReady", function _onPostsReady() {
          document.removeEventListener("postsReady", _onPostsReady);
          _attemptRestorePostView();
        });
      }
    }
  }
}

/* ─────────────────── Çıkış Yapıldığında ─────────────────── */

export function onUserLoggedOut(): void {
  const sidebar = document.getElementById("sidebar");
  const appFooter = document.getElementById("appFooter");
  const userInfo = document.getElementById("userInfo");
  const authOverlay = document.getElementById("authOverlay");

  if (sidebar) sidebar.classList.add("hidden");
  if (mainScroll) mainScroll.classList.add("hidden");
  if (appFooter) appFooter.classList.add("hidden");
  if (userInfo) userInfo.classList.add("hidden");

  showPage("home");
  sessionStorage.removeItem("_lastPage");

  const loginFormEl = document.getElementById("loginForm") as HTMLFormElement | null;
  const registerFormEl = document.getElementById("registerForm") as HTMLFormElement | null;

  if (loginFormEl) {
    loginFormEl.reset();
    const btn = loginFormEl.querySelector(".auth-submit-btn") as HTMLElement | null;
    if (btn) { btn.textContent = "Giriş Yap"; (btn as HTMLButtonElement).disabled = false; }
  }

  if (registerFormEl) {
    registerFormEl.reset();
    const btn = registerFormEl.querySelector(".auth-submit-btn") as HTMLElement | null;
    if (btn) { btn.textContent = "Kayıt Ol"; (btn as HTMLButtonElement).disabled = false; }
    document.getElementById("regPassword")?.classList.remove("match-success", "match-error");
    document.getElementById("regPasswordConfirm")?.classList.remove("match-success", "match-error");
    document.getElementById("regUsername")?.classList.remove("match-success", "match-error");
    const _usernameHint = document.getElementById("usernameHint");
    if (_usernameHint) { _usernameHint.textContent = ""; _usernameHint.className = "username-hint"; }
    const _passwordHint = document.getElementById("passwordHint");
    if (_passwordHint) { _passwordHint.textContent = ""; _passwordHint.className = "username-hint"; }
    const _passwordConfirmHint = document.getElementById("passwordConfirmHint");
    if (_passwordConfirmHint) { _passwordConfirmHint.textContent = ""; _passwordConfirmHint.className = "username-hint"; }
  }

  const loginError = document.getElementById("loginError");
  const regError = document.getElementById("regError");
  if (loginError) loginError.textContent = "";
  if (regError) regError.textContent = "";

  document.querySelectorAll(".password-wrapper input").forEach((input) => {
    (input as HTMLInputElement).type = "password";
  });

  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.innerHTML = "";
    const eyeTmpl = document.getElementById("svg-eye") as HTMLTemplateElement | null;
    if (eyeTmpl) btn.appendChild(eyeTmpl.content.cloneNode(true));
  });

  var _remembered = localStorage.getItem("_rememberedEmail");
  var _loginEmailEl = document.getElementById("loginEmail") as HTMLInputElement | null;
  if (_loginEmailEl && _remembered) {
    _loginEmailEl.value = _remembered;
  }

  _teardownPosts();
  closeAllModals();

  sessionStorage.removeItem("_viewingPostId");
  sessionStorage.removeItem("_pvPreviousPage");
  sessionStorage.removeItem("_pvScrollTop");
  (window as any)._viewingPostId = null;

  if (authOverlay) authOverlay.classList.add("active");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         YARDIMCI FONKSİYONLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yükleniyor Gizleme ─────────────────── */

export function hideLoading(): void {
  const el = document.getElementById("authLoading");
  if (!el) return;
  el.style.opacity = "0";
  el.style.transition = "opacity 0.25s ease";
  setTimeout(() => { el.style.display = "none"; }, 260);
}

/* ─────────────────── Hata Mesajı ─────────────────── */

export function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "auth/user-not-found": "E-posta veya şifre hatalı.",
    "auth/wrong-password": "E-posta veya şifre hatalı.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/invalid-login-credentials": "E-posta veya şifre hatalı.",
    "auth/email-already-in-use": "Bu e-posta adresi zaten kullanımda.",
    "auth/invalid-email": "Geçersiz e-posta adresi formatı.",
    "auth/weak-password": "Şifre çok zayıf. En az 6 karakter kullanın.",
    "auth/too-many-requests": "Çok fazla başarısız deneme. Lütfen bekleyin.",
    "auth/network-request-failed": "Ağ bağlantısı hatası. İnterneti kontrol edin.",
    "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
    "auth/operation-not-allowed": "Bu giriş yöntemi etkinleştirilmemiş.",
  };
  return messages[code] || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.";
}
