const auth = firebase.auth();

/* ─── YÜKLEME EKRANINI KALDIR ─────────────────────────────────────────────── */
function hideLoading() {
  const el = document.getElementById("authLoading");
  if (!el) return;
  el.style.opacity = "0";
  el.style.transition = "opacity 0.25s ease";
  setTimeout(() => el.remove(), 260);
}

/* ─── OTURUM DURUMU DİNLEYİCİSİ ──────────────────────────────────────────── */
auth.onAuthStateChanged((user) => {
  hideLoading();
  if (user) {
    onUserLoggedIn(user);
  } else {
    onUserLoggedOut();
  }
});

/* ─── GİRİŞ YAPILDIĞINDA ──────────────────────────────────────────────────── */
async function onUserLoggedIn(user) {
  const authOverlay = document.getElementById("authOverlay");
  if (authOverlay) authOverlay.classList.remove("active");

  const pageWrapper = document.getElementById("pageWrapper");
  const appFooter = document.getElementById("appFooter");
  if (pageWrapper) pageWrapper.classList.remove("hidden");
  if (appFooter) appFooter.classList.remove("hidden");

  const displayName = user.displayName || "Kullanıcı";

  const userInfo = document.getElementById("userInfo");
  const userEmailEl = document.getElementById("userEmail");

  if (userInfo) userInfo.classList.remove("hidden");
  if (userEmailEl) userEmailEl.textContent = displayName;

  /* ─── KRİTİK DÜZELTME: getIdToken(true) ile zorla yenile ──────────────── */
  /* Orijinal kodda getIdToken() (force=false) kullanılıyordu.               */
  /* Electron'da uygulama 1+ saat açık kalırsa token süresi dolar.           */
  /* Tarayıcının aksine Electron otomatik yenileyemez.                       */
  /* Süresi dolmuş token ile Firebase okuma izniz olsa bile boş veri döner. */
  try {
    await user.getIdToken(
      true,
    ); /* force=true: her zaman sunucudan taze token al */
  } catch (_tokenError) {}

  if (typeof initUserDataRef === "function") {
    initUserDataRef(user.uid);
  }
}

/* ─── ÇIKIŞ YAPILDIĞINDA ─────────────────────────────────────────────────── */
function onUserLoggedOut() {
  const pageWrapper = document.getElementById("pageWrapper");
  const appFooter = document.getElementById("appFooter");
  const userInfo = document.getElementById("userInfo");
  const authOverlay = document.getElementById("authOverlay");

  if (pageWrapper) pageWrapper.classList.add("hidden");
  if (appFooter) appFooter.classList.add("hidden");
  if (userInfo) userInfo.classList.add("hidden");

  if (typeof allData !== "undefined") allData = {};

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) {
    loginForm.reset();
    const loginBtn = loginForm.querySelector(".auth-submit-btn");
    if (loginBtn) {
      loginBtn.textContent = "Giriş Yap";
      loginBtn.disabled = false;
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

  if (authOverlay) authOverlay.classList.add("active");
}

/* ─── ŞİFRE GİZLE / GÖSTER ───────────────────────────────────────────────── */
document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", function () {
    const input = this.previousElementSibling;
    if (!input) return;

    if (input.type === "password") {
      input.type = "text";
      this.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
      input.type = "password";
      this.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
  });
});

/* ─── ŞİFRE EŞLEŞTİRME ───────────────────────────────────────────────────── */
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
    regPasswordInput?.classList.remove("match-error");
    regPasswordConfirm?.classList.remove("match-error");
    regPasswordInput?.classList.add("match-success");
    regPasswordConfirm?.classList.add("match-success");
  } else {
    regPasswordInput?.classList.remove("match-success");
    regPasswordConfirm?.classList.remove("match-success");
    if (p2.length > 0) {
      regPasswordInput?.classList.add("match-error");
      regPasswordConfirm?.classList.add("match-error");
    }
  }
}

if (regPasswordInput) {
  regPasswordInput.addEventListener("input", validatePasswords);
}
if (regPasswordConfirm) {
  regPasswordConfirm.addEventListener("input", validatePasswords);
}

/* ─── GİRİŞ FORMU ─────────────────────────────────────────────────────────── */
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

      if (rememberMeCheck && rememberMeCheck.checked) {
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

/* ─── KULLANICI ADI UYGUNLUK KONTROLÜ ────────────────────────────────────── */
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
    const val = regUsernameInput.value.trim();

    if (!val) {
      setHint("", "");
      return;
    }

    if (val.length < 3) {
      setHint("En az 3 karakter gerekli", "error");
      return;
    }

    setHint("Kontrol ediliyor...", "");

    usernameCheckTimer = setTimeout(async () => {
      try {
        const snap = await database
          .ref("usernames/" + val.toLowerCase())
          .once("value");
        if (snap.exists()) {
          setHint("Bu kullanıcı adı alınmış", "error");
        } else {
          setHint("Bu kullanıcı adı kullanılabilir", "ok");
        }
      } catch (_err) {
        setHint("", "");
      }
    }, 500);
  });
}

/* ─── KAYIT FORMU ──────────────────────────────────────────────────────────── */
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

    if (password !== passwordConfirm) {
      errEl.textContent = "Şifreler uyuşmuyor.";
      return;
    }

    btn.textContent = "Kayıt olunuyor...";
    btn.disabled = true;

    try {
      const usernameKey = username.toLowerCase();
      const usernameSnap = await database
        .ref("usernames/" + usernameKey)
        .once("value");

      if (usernameSnap.exists()) {
        errEl.textContent = "Bu kullanıcı adı zaten alınmış.";
        btn.textContent = "Kayıt Ol";
        btn.disabled = false;
        return;
      }

      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: username });
      await database.ref("usernames/" + usernameKey).set(cred.user.uid);
    } catch (err) {
      errEl.textContent = getAuthErrorMessage(err.code);
      btn.textContent = "Kayıt Ol";
      btn.disabled = false;
    }
  });
}

/* ─── PANEL GEÇİŞİ ─────────────────────────────────────────────────────────── */
document.getElementById("goToRegister")?.addEventListener("click", () => {
  document.getElementById("loginPanel")?.classList.add("hidden");
  document.getElementById("registerPanel")?.classList.remove("hidden");
});

document.getElementById("goToLogin")?.addEventListener("click", () => {
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.remove("hidden");
});

/* ─── AYARLAR VE ÇIKIŞ ─────────────────────────────────────────────────────── */
const settingsModal =
  document.getElementById("settingsModal") ||
  document.getElementById("userSettingsModal");
const changePasswordModal = document.getElementById("changePasswordModal");
const deleteAccountModal = document.getElementById("deleteAccountModal");
const settingsTrigger =
  document.getElementById("settingsBtn") || document.getElementById("userInfo");

function closeSettingsModal() {
  if (settingsModal) settingsModal.classList.remove("active");
}
function closeChangePassModal() {
  if (changePasswordModal) changePasswordModal.classList.remove("active");
}
function closeDeleteModal() {
  if (deleteAccountModal) deleteAccountModal.classList.remove("active");
}

settingsTrigger?.addEventListener("click", (e) => {
  if (e.target && e.target.closest && e.target.closest("#logoutBtn")) return;
  const user = auth.currentUser;
  if (!user) return;
  const nameInput = document.getElementById("settingsDisplayName");
  if (nameInput) {
    nameInput.value = user.displayName || "";
    nameInput.readOnly = true;
  }
  document.getElementById("editUsernameBtn")?.classList.remove("hidden");
  document.getElementById("saveUsernameBtn")?.classList.add("hidden");
  if (settingsModal) settingsModal.classList.add("active");
});

document
  .getElementById("closeSettingsBtn")
  ?.addEventListener("click", closeSettingsModal);
document
  .getElementById("closeChangePassBtn")
  ?.addEventListener("click", closeChangePassModal);
document
  .getElementById("closeDeleteAccountBtn")
  ?.addEventListener("click", closeDeleteModal);
document
  .getElementById("closeDeleteBtn")
  ?.addEventListener("click", closeDeleteModal);

settingsModal?.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});
changePasswordModal?.addEventListener("click", (e) => {
  if (e.target === changePasswordModal) closeChangePassModal();
});
deleteAccountModal?.addEventListener("click", (e) => {
  if (e.target === deleteAccountModal) closeDeleteModal();
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  closeSettingsModal();
  auth.signOut();
});

function goBackToSettings(fromModal) {
  if (fromModal === "changePass") closeChangePassModal();
  if (fromModal === "deleteAcc") closeDeleteModal();
  if (settingsModal) settingsModal.classList.add("active");
}

document
  .getElementById("backToSettingsFromPass")
  ?.addEventListener("click", () => goBackToSettings("changePass"));
document
  .getElementById("backToSettingsFromDelete")
  ?.addEventListener("click", () => goBackToSettings("deleteAcc"));

/* ─── KULLANICI ADI DÜZENLEME ────────────────────────────────────────────── */
const editBtn = document.getElementById("editUsernameBtn");
const saveBtn = document.getElementById("saveUsernameBtn");
const nameInput = document.getElementById("settingsDisplayName");

editBtn?.addEventListener("click", () => {
  nameInput.readOnly = false;
  nameInput.focus();
  editBtn.classList.add("hidden");
  saveBtn.classList.remove("hidden");
});

saveBtn?.addEventListener("click", async () => {
  const newName = nameInput.value.trim();
  if (!newName) return;

  try {
    await auth.currentUser.updateProfile({ displayName: newName });
    document.getElementById("userEmail").textContent = newName;
    if (typeof showToast === "function") {
      showToast("Kullanıcı adı güncellendi", "success");
    }
    nameInput.readOnly = true;
    saveBtn.classList.add("hidden");
    editBtn.classList.remove("hidden");
  } catch (_err) {
    if (typeof showToast === "function") showToast("Hata oluştu", "error");
  }
});

/* ─── ŞİFRE DEĞİŞTİRME ────────────────────────────────────────────────────── */
document.getElementById("openChangePassBtn")?.addEventListener("click", () => {
  closeSettingsModal();
  if (changePasswordModal) changePasswordModal.classList.add("active");
});

document
  .getElementById("changePasswordForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const oldPass = document.getElementById("oldPassword").value;
    const newPass = document.getElementById("newPassword").value;
    const newPassConfirm = document.getElementById("newPasswordConfirm").value;
    const errEl = document.getElementById("changePassError");
    const submitBtn = e.currentTarget.querySelector('button[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Kaydediliyor...";
    }

    if (newPass !== newPassConfirm) {
      errEl.style.color = "var(--red)";
      errEl.textContent = "Yeni şifreler uyuşmuyor.";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Şifreyi Kaydet";
      }
      return;
    }

    if (newPass.length < 6) {
      errEl.style.color = "var(--red)";
      errEl.textContent = "Yeni şifre en az 6 karakter olmalıdır.";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Şifreyi Kaydet";
      }
      return;
    }

    try {
      const user = auth.currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(
        user.email,
        oldPass,
      );

      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPass);
      await user.reload();

      errEl.style.color = "var(--green)";
      errEl.textContent = "Şifre başarıyla değiştirildi.";

      setTimeout(() => {
        closeChangePassModal();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Şifreyi Kaydet";
        }
        if (typeof showToast === "function") {
          showToast("Şifre güncellendi", "success");
        }
      }, 900);
    } catch (err) {
      errEl.style.color = "var(--red)";
      errEl.textContent =
        err.code === "auth/wrong-password"
          ? "Mevcut şifre hatalı."
          : "Bir hata oluştu.";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Şifreyi Kaydet";
      }
    }
  });

/* ─── HESAP SİLME ─────────────────────────────────────────────────────────── */
document
  .getElementById("openDeleteAccountBtn")
  ?.addEventListener("click", () => {
    closeSettingsModal();
    if (deleteAccountModal) deleteAccountModal.classList.add("active");
  });

document
  .getElementById("deleteConfirmCheck")
  ?.addEventListener("change", (e) => {
    document.getElementById("finalDeleteBtn").disabled = !e.target.checked;
  });

document
  .getElementById("deleteAccountForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("deleteEmail").value;
    const pass = document.getElementById("deletePassword").value;
    const errEl = document.getElementById("deleteAccountError");
    const submitBtn = e.currentTarget.querySelector('button[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Siliniyor...";
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Oturum bulunamadı, lütfen yeniden giriş yapın.");
      }

      const credential = firebase.auth.EmailAuthProvider.credential(
        email,
        pass,
      );
      await user.reauthenticateWithCredential(credential);

      if (typeof database !== "undefined" && user.uid) {
        await database.ref("users/" + user.uid).remove();

        const usernameKey = (user.displayName || "").trim().toLowerCase();
        if (usernameKey) {
          const usernameRef = database.ref("usernames/" + usernameKey);
          const usernameSnap = await usernameRef.once("value");
          if (usernameSnap.val() === user.uid) {
            await usernameRef.remove();
          }
        }
      }

      await user.delete();

      if (typeof showToast === "function") {
        showToast("Hesabınız kalıcı olarak silindi.", "info");
      }
      closeDeleteModal();
    } catch (err) {
      errEl.style.color = "var(--red)";
      const code = err?.code || "";

      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        errEl.textContent = "E-posta veya şifre hatalı.";
      } else if (code === "auth/too-many-requests") {
        errEl.textContent = "Çok fazla deneme. Lütfen bekleyin.";
      } else if (code === "auth/requires-recent-login") {
        errEl.textContent = "Yeniden giriş yapmanız gerekiyor.";
      } else if (err?.message) {
        errEl.textContent = err.message;
      } else {
        errEl.textContent = "Bir hata oluştu. Lütfen tekrar deneyin.";
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Hesabı Kalıcı Olarak Sil";
      }
    }
  });

/* ─── HATA MESAJLARI ──────────────────────────────────────────────────────── */
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
