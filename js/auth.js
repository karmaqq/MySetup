/* ═══════════════════════════════════════════════════════════════════════════ */
/*                  KİMLİK DOĞRULAMA VE OTURUM YÖNETİMİ                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase Auth Başlatma ─────────────────── */

const auth = firebase.auth();

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YARDIMCI FONKSİYONLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yükleme Ekranını Kaldır ─────────────────── */

function hideLoading() {
  const el = document.getElementById("authLoading");
  if (!el) return;
  el.style.opacity = "0";
  el.style.transition = "opacity 0.25s ease";
  setTimeout(() => (el.style.display = "none"), 260);
}

/* ─────────────────── Auth Hata Mesajları ─────────────────── */

function getAuthErrorMessage(code) {
  const messages = {
    "auth/user-not-found": "E-posta veya şifre hatalı.",
    "auth/wrong-password": "E-posta veya şifre hatalı.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/invalid-login-credentials": "E-posta veya şifre hatalı.",
    "auth/email-already-in-use": "Bu e-posta adresi zaten kullanımda.",
    "auth/invalid-email": "Geçersiz e-posta adresi formatı.",
    "auth/weak-password": "Şifre çok zayıf. En az 6 karakter kullanın.",
    "auth/too-many-requests": "Çok fazla başarısız deneme. Lütfen bekleyin.",
    "auth/network-request-failed":
      "Ağ bağlantısı hatası. İnterneti kontrol edin.",
    "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
    "auth/operation-not-allowed": "Bu giriş yöntemi etkinleştirilmemiş.",
  };
  return (
    messages[code] || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin."
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         OTURUM DURUM YÖNETİMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Oturum Durumu Dinleyicisi ─────────────────── */

auth.onAuthStateChanged((user) => {
  hideLoading();
  if (user) {
    onUserLoggedIn(user);
  } else {
    onUserLoggedOut();
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GİRİŞ YAPILDIĞINDA                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function onUserLoggedIn(user) {
  const authOverlay = document.getElementById("authOverlay");
  if (authOverlay) authOverlay.classList.remove("active");

  const mainScroll = document.getElementById("mainScroll");
  const appFooter = document.getElementById("appFooter");
  if (mainScroll) mainScroll.classList.remove("hidden");
  if (appFooter) appFooter.classList.remove("hidden");

  const userInfo = document.getElementById("userInfo");
  const userEmailEl = document.getElementById("userEmail");
  if (userInfo) userInfo.classList.remove("hidden");
  if (userEmailEl) userEmailEl.textContent = user.displayName || "Kullanıcı";

  if (typeof initUserDataRef === "function") {
    initUserDataRef(user.uid);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ÇIKIŞ YAPILDIĞINDA                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function onUserLoggedOut() {
  const mainScroll = document.getElementById("mainScroll");
  const appFooter = document.getElementById("appFooter");
  const userInfo = document.getElementById("userInfo");
  const authOverlay = document.getElementById("authOverlay");

  if (mainScroll) mainScroll.classList.add("hidden");
  if (appFooter) appFooter.classList.add("hidden");
  if (userInfo) userInfo.classList.add("hidden");

  if (loginForm) {
    loginForm.reset();
    const btn = loginForm.querySelector(".auth-submit-btn");
    if (btn) {
      btn.textContent = "Giriş Yap";
      btn.disabled = false;
    }
  }

  if (registerForm) {
    registerForm.reset();
    const btn = registerForm.querySelector(".auth-submit-btn");
    if (btn) {
      btn.textContent = "Kayıt Ol";
      btn.disabled = false;
    }
    document
      .getElementById("regPassword")
      ?.classList.remove("match-success", "match-error");
    document
      .getElementById("regPasswordConfirm")
      ?.classList.remove("match-success", "match-error");
  }

  const loginError = document.getElementById("loginError");
  const regError = document.getElementById("regError");
  if (loginError) loginError.textContent = "";
  if (regError) regError.textContent = "";

  const savedEmail = localStorage.getItem("rememberedEmail");
  if (savedEmail) {
    const loginEmailInput = document.getElementById("loginEmail");
    if (loginEmailInput) loginEmailInput.value = savedEmail;
    const rememberMeCheck = document.getElementById("rememberMe");
    if (rememberMeCheck) rememberMeCheck.checked = true;
  }

  document.querySelectorAll(".password-wrapper input").forEach((input) => {
    input.type = "password";
  });

  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  });

  if (typeof closeSettingsModal === "function") closeSettingsModal();
  if (typeof closeChangePassModal === "function") closeChangePassModal();
  if (typeof closeDeleteModal === "function") closeDeleteModal();
  if (typeof closeEditModal === "function") closeEditModal();

  if (authOverlay) authOverlay.classList.add("active");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FORM YARDIMCILARI                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Şifre Gizle / Göster ─────────────────── */

document.querySelectorAll(".toggle-password").forEach((btn) => {
  const eyeTmpl = document.getElementById("svg-eye");
  if (eyeTmpl && btn.childNodes.length === 0) {
    btn.appendChild(eyeTmpl.content.cloneNode(true));
  }
  btn.addEventListener("click", function () {
    const input = this.previousElementSibling;
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      this.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
      input.type = "password";
      const eyeTmpl = document.getElementById("svg-eye");
      this.innerHTML = "";
      if (eyeTmpl) this.appendChild(eyeTmpl.content.cloneNode(true));
    }
  });
});

/* ─────────────────── Şifre Eşleştirme Kontrolü ─────────────────── */

const regPasswordInput = document.getElementById("regPassword");
const regPasswordConfirm = document.getElementById("regPasswordConfirm");

function validatePasswords() {
  const p1 = regPasswordInput?.value || "";
  const p2 = regPasswordConfirm?.value || "";

  if (!p1 && !p2) {
    regPasswordInput?.classList.remove("match-success", "match-error");
    regPasswordConfirm?.classList.remove("match-success", "match-error");
    return;
  }

  if (p1 === p2 && p1.length >= 6) {
    regPasswordInput?.classList.replace("match-error", "match-success");
    regPasswordConfirm?.classList.replace("match-error", "match-success");
    regPasswordInput?.classList.add("match-success");
    regPasswordConfirm?.classList.add("match-success");
  } else {
    regPasswordInput?.classList.replace("match-success", "match-error");
    regPasswordConfirm?.classList.replace("match-success", "match-error");
    if (p2.length > 0) {
      regPasswordInput?.classList.add("match-error");
      regPasswordConfirm?.classList.add("match-error");
    }
  }
}

regPasswordInput?.addEventListener("input", validatePasswords);
regPasswordConfirm?.addEventListener("input", validatePasswords);

/* ─────────────────── Panel Geçişi ─────────────────── */

document.getElementById("goToRegister")?.addEventListener("click", () => {
  document.getElementById("loginPanel")?.classList.add("hidden");
  document.getElementById("registerPanel")?.classList.remove("hidden");
});

document.getElementById("goToLogin")?.addEventListener("click", () => {
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.remove("hidden");
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                             GİRİŞ FORMU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");
    const btn = loginForm.querySelector(".auth-submit-btn");
    const rememberMeCheck = document.getElementById("rememberMe");

    errEl.textContent = "";
    btn.textContent = "Giriş yapılıyor...";
    btn.disabled = true;

    try {
      await auth.signInWithEmailAndPassword(email, password);
      if (rememberMeCheck?.checked) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
    } catch (err) {
      errEl.textContent = getAuthErrorMessage(err.code);
      btn.textContent = "Giriş Yap";
      btn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                             KAYIT FORMU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kullanıcı Adı Uygunluk Kontrolü ─────────────────── */

let usernameCheckTimer = null;
const regUsernameInput = document.getElementById("regUsername");
const usernameHint = document.getElementById("usernameHint");

function setHint(msg, type) {
  if (!usernameHint) return;
  usernameHint.textContent = msg;
  usernameHint.className = "username-hint" + (type ? " hint-" + type : "");
}

if (regUsernameInput) {
  regUsernameInput.addEventListener("input", () => {
    clearTimeout(usernameCheckTimer);
    const val = regUsernameInput.value;

    if (!val.trim()) return setHint("", "");
    if (/\s/.test(val))
      return setHint("Kullanıcı adında boşluk kullanılamaz", "error");
    if (/[A-Z]/.test(val))
      return setHint(
        "Büyük harf kullanılamaz, sadece küçük harf (a-z)",
        "error",
      );
    if (/[çğıöşüÇĞİÖŞÜ]/.test(val))
      return setHint(
        "Türkçe karakter kullanılamaz (ç, ğ, ı, ö, ş, ü)",
        "error",
      );
    if (/[^a-z0-9._-]/.test(val))
      return setHint(
        "Sadece a-z, 0-9, nokta, tire, alt çizgi kullanılabilir",
        "error",
      );
    if (val.length < 3) return setHint("En az 3 karakter gerekli", "error");
    if (val.length > 32)
      return setHint("En fazla 32 karakter olabilir", "error");

    setHint("Kontrol ediliyor...", "");
    usernameCheckTimer = setTimeout(async () => {
      try {
        const snap = await database
          .ref("usernames/" + val.toLowerCase())
          .once("value");
        setHint(
          snap.exists()
            ? "Bu kullanıcı adı alınmış"
            : "Bu kullanıcı adı kullanılabilir",
          snap.exists() ? "error" : "ok",
        );
      } catch (_) {
        setHint("", "");
      }
    }, 500);
  });
}

/* ─────────────────── Kayıt Formu Submit ─────────────────── */

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const passwordConfirm = document.getElementById("regPasswordConfirm").value;
    const errEl = document.getElementById("regError");
    const btn = registerForm.querySelector(".auth-submit-btn");

    errEl.textContent = "";

    if (!username || username.length < 3) {
      errEl.textContent = "Kullanıcı adı en az 3 karakter olmalıdır.";
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      errEl.textContent =
        "Kullanıcı adı sadece küçük harf (a-z), rakam, nokta, tire, alt çizgi içerebilir.";
      return;
    }
    if (password !== passwordConfirm) {
      errEl.textContent = "Şifreler uyuşmuyor.";
      return;
    }

    btn.textContent = "Kayıt olunuyor...";
    btn.disabled = true;

    try {
      const usernameKey = username.toLowerCase();
      const snap = await database.ref("usernames/" + usernameKey).once("value");
      if (snap.exists()) {
        errEl.textContent = "Bu kullanıcı adı zaten alınmış.";
        btn.textContent = "Kayıt Ol";
        btn.disabled = false;
        return;
      }

      const cred = await auth.createUserWithEmailAndPassword(email, password);

      try {
        await database.ref("usernames/" + usernameKey).set(cred.user.uid);
        await cred.user.updateProfile({ displayName: username });
      } catch (claimErr) {
        try {
          await cred.user.delete();
        } catch (_) {}
        errEl.textContent =
          claimErr.code === "PERMISSION_DENIED" ||
          claimErr.message?.includes("Permission")
            ? "Bu kullanıcı adı zaten alınmış."
            : "Bir hata oluştu.";
        btn.textContent = "Kayıt Ol";
        btn.disabled = false;
      }
    } catch (err) {
      errEl.textContent = getAuthErrorMessage(err.code);
      btn.textContent = "Kayıt Ol";
      btn.disabled = false;
    }
  });
}
