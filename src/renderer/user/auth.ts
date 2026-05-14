/* ═══════════════════════════════════════════════════════════════════════════ */
/*                  KİMLİK DOĞRULAMA VE OTURUM YÖNETİMİ                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, updateProfile, deleteUser } from "firebase/auth";
import { get, ref, runTransaction } from "firebase/database";
import {
  onUserLoggedIn,
  onUserLoggedOut,
  getAuthErrorMessage,
  hideLoading,
} from "./auth-nav";
import { db } from "../core/firebase-init";
import { setCurrentUser } from "../core/app-state";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  setCurrentUser(user);
  hideLoading();
  if (user) {
    onUserLoggedIn(user);
  } else {
    onUserLoggedOut();
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                             GİRİŞ FORMU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const loginForm = document.getElementById(
  "loginForm",
) as HTMLFormElement | null;

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailEl = document.getElementById(
      "loginEmail",
    ) as HTMLInputElement | null;
    const passEl = document.getElementById(
      "loginPassword",
    ) as HTMLInputElement | null;
    const errEl = document.getElementById("loginError") as HTMLElement | null;
    const btn = loginForm.querySelector(
      ".auth-submit-btn",
    ) as HTMLButtonElement | null;
    const rememberMeCheck = document.getElementById(
      "rememberMe",
    ) as HTMLInputElement | null;

    if (!emailEl || !passEl || !errEl || !btn) return;

    const email = emailEl.value.trim();
    const password = passEl.value;

    errEl.textContent = "";
    btn.textContent = "Giriş yapılıyor...";
    btn.disabled = true;

    try {
      await setPersistence(
        auth,
        rememberMeCheck?.checked
          ? browserLocalPersistence
          : browserSessionPersistence,
      );
      await signInWithEmailAndPassword(auth, email, password);
      if (rememberMeCheck?.checked) {
        localStorage.setItem("_rememberedEmail", email);
      } else {
        localStorage.removeItem("_rememberedEmail");
      }
    } catch (err: any) {
      errEl.textContent = getAuthErrorMessage(err.code);
      btn.textContent = "Giriş Yap";
      btn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                             KAYIT FORMU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const registerForm = document.getElementById(
  "registerForm",
) as HTMLFormElement | null;

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usernameEl = document.getElementById(
      "regUsername",
    ) as HTMLInputElement | null;
    const emailEl = document.getElementById(
      "regEmail",
    ) as HTMLInputElement | null;
    const passEl = document.getElementById(
      "regPassword",
    ) as HTMLInputElement | null;
    const passConfirmEl = document.getElementById(
      "regPasswordConfirm",
    ) as HTMLInputElement | null;
    const errEl = document.getElementById("regError") as HTMLElement | null;
    const btn = registerForm.querySelector(
      ".auth-submit-btn",
    ) as HTMLButtonElement | null;

    if (!usernameEl || !emailEl || !passEl || !passConfirmEl || !errEl || !btn)
      return;

    const username = usernameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passEl.value;
    const passwordConfirm = passConfirmEl.value;

    errEl.textContent = "";

    if (!username || username.length < 3) {
      errEl.textContent = "Kullanıcı adı en az 3 karakter olmalıdır.";
      return;
    }
    if (!/^[a-z][a-z0-9._-]{2,12}$/.test(username)) {
      errEl.textContent =
        "Kullanıcı adı harf ile başlamalı, 3-12 karakter arası olmalıdır.";
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
      const usernameRef = ref(db.database, "usernames/" + usernameKey);

      const regRememberMe =
        (document.getElementById("regRememberMe") as HTMLInputElement | null)
          ?.checked ?? true;
      await setPersistence(
        auth,
        regRememberMe
          ? browserLocalPersistence
          : browserSessionPersistence,
      );

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      try {
        const txnResult = await runTransaction(usernameRef, (current) => {
          if (current === null) return uid;
        });

        const snapVal = txnResult.snapshot ? txnResult.snapshot.val() : null;
        if (!txnResult.committed || snapVal !== uid) {
          try {
            await deleteUser(cred.user);
          } catch (_) {}
          errEl.textContent = "Bu kullanıcı adı zaten alınmış.";
          btn.textContent = "Kayıt Ol";
          btn.disabled = false;
          return;
        }

        await updateProfile(cred.user, { displayName: username });
      } catch (innerErr: any) {
        try {
          await deleteUser(cred.user);
        } catch (_) {}
        throw innerErr;
      }
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        errEl.textContent = "Bu e-posta adresi zaten kullanımda.";
      } else {
        errEl.textContent =
          getAuthErrorMessage(err.code) || "Bir hata oluştu.";
      }
    } finally {
      btn.textContent = "Kayıt Ol";
      btn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                  KULLANICI ADI ANLIK DOĞRULAMA                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

let _usernameCheckToken = 0;
let _usernameCheckTimer: number | null = null;

const regUsernameInput = document.getElementById(
  "regUsername",
) as HTMLInputElement | null;
const regUsernameHint = document.getElementById(
  "usernameHint",
) as HTMLElement | null;

function _validateUsernameFormat(value: string): {
  valid: boolean;
  reason: string;
} {
  const v = value.trim();
  if (!v || v.length < 3) return { valid: false, reason: "too-short" };
  if (!/^[a-z0-9._-]+$/.test(v))
    return { valid: false, reason: "invalid-chars" };
  if (/^[0-9]/.test(v)) return { valid: false, reason: "starts-with-number" };
  if (/^[._-]/.test(v)) return { valid: false, reason: "starts-with-symbol" };
  if (v.length > 12) return { valid: false, reason: "too-long" };
  return { valid: true, reason: "" };
}

function _updateUsernameUI(opts: {
  reason?: string;
  taken?: boolean;
  checking?: boolean;
}): void {
  if (!regUsernameInput || !regUsernameHint) return;

  regUsernameInput.classList.remove("match-success", "match-error");
  regUsernameHint.className = "username-hint";
  regUsernameHint.textContent = "";

  if (opts.checking) {
    regUsernameHint.classList.add("hint-checking");
    regUsernameHint.textContent = "Kullanıcı adı kontrol ediliyor...";
    return;
  }

  if (
    opts.reason === "too-short" ||
    opts.reason === "invalid-chars" ||
    opts.reason === "too-long" ||
    opts.reason === "starts-with-number" ||
    opts.reason === "starts-with-symbol"
  ) {
    regUsernameInput.classList.add("match-error");
    regUsernameHint.classList.add("hint-error");
    if (opts.reason === "too-short") {
      regUsernameHint.textContent = "En az 3 karakter girmelisiniz.";
    } else if (opts.reason === "invalid-chars") {
      regUsernameHint.textContent =
        "Yalnızca küçük harf ve semboller (a-z, 0-9, ., _, -).";
    } else if (opts.reason === "starts-with-number") {
      regUsernameHint.textContent = "Kullanıcı adı sayı ile başlayamaz.";
    } else if (opts.reason === "starts-with-symbol") {
      regUsernameHint.textContent = "Kullanıcı adı sembol ile başlayamaz.";
    } else {
      regUsernameHint.textContent =
        "Kullanıcı adı en fazla 12 karakter olabilir.";
    }
    return;
  }

  if (opts.taken === true) {
    regUsernameInput.classList.add("match-error");
    regUsernameHint.classList.add("hint-error");
    regUsernameHint.textContent = "Bu kullanıcı adı zaten alınmış.";
    return;
  }

  if (opts.taken === false) {
    regUsernameInput.classList.add("match-success");
    regUsernameHint.classList.add("hint-ok");
    regUsernameHint.textContent = "Bu kullanıcı adı kullanılabilir.";
  }
}

async function _checkUsernameAvailability(
  key: string,
  token: number,
): Promise<void> {
  try {
    const snap = await get(ref(db.database, "usernames/" + key));
    if (token !== _usernameCheckToken) return;
    _updateUsernameUI({ taken: snap.exists() });
  } catch (_) {
    if (token !== _usernameCheckToken) return;
    if (regUsernameHint) {
      regUsernameHint.textContent = "";
      regUsernameHint.className = "username-hint";
    }
  }
}

function _onUsernameInput(): void {
  if (!regUsernameInput || !regUsernameHint) return;

  const value = regUsernameInput.value;
  _usernameCheckToken++;

  if (_usernameCheckTimer !== null) {
    clearTimeout(_usernameCheckTimer);
    _usernameCheckTimer = null;
  }

  if (!value) {
    regUsernameInput.classList.remove("match-success", "match-error");
    regUsernameHint.className = "username-hint";
    regUsernameHint.textContent = "";
    return;
  }

  const result = _validateUsernameFormat(value);

  if (!result.valid) {
    _updateUsernameUI({ reason: result.reason });
    return;
  }

  _updateUsernameUI({ checking: true });

  const token = _usernameCheckToken;
  _usernameCheckTimer = window.setTimeout(function () {
    _checkUsernameAvailability(value.toLowerCase(), token);
  }, 400);
}

regUsernameInput?.addEventListener("input", _onUsernameInput);

/* ─────────────────── Panel Geçişi ─────────────────── */

document.getElementById("goToRegister")?.addEventListener("click", () => {
  document.getElementById("loginPanel")?.classList.add("hidden");
  document.getElementById("registerPanel")?.classList.remove("hidden");
});

document.getElementById("goToLogin")?.addEventListener("click", () => {
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.remove("hidden");
});

/* ─────────────────── Şifre Anlık Doğrulama ─────────────────── */

const regPasswordInput = document.getElementById(
  "regPassword",
) as HTMLInputElement | null;
const regPasswordConfirm = document.getElementById(
  "regPasswordConfirm",
) as HTMLInputElement | null;
const regPasswordHint = document.getElementById(
  "passwordHint",
) as HTMLElement | null;
const regPasswordConfirmHint = document.getElementById(
  "passwordConfirmHint",
) as HTMLElement | null;

function _validatePassword(): void {
  const p1 = regPasswordInput?.value || "";
  const p2 = regPasswordConfirm?.value || "";

  if (regPasswordHint) {
    regPasswordHint.className = "username-hint";
    regPasswordHint.textContent = "";
  }
  if (regPasswordConfirmHint) {
    regPasswordConfirmHint.className = "username-hint";
    regPasswordConfirmHint.textContent = "";
  }

  if (!p1 && !p2) {
    regPasswordInput?.classList.remove("match-success", "match-error");
    regPasswordConfirm?.classList.remove("match-success", "match-error");
    return;
  }

  if (p1.length < 6) {
    regPasswordInput?.classList.remove("match-success");
    regPasswordInput?.classList.add("match-error");
    if (regPasswordHint) {
      regPasswordHint.classList.add("hint-error");
      regPasswordHint.textContent = "Şifre en az 6 karakter olmalıdır.";
    }
  } else if (/\s/.test(p1)) {
    regPasswordInput?.classList.remove("match-success");
    regPasswordInput?.classList.add("match-error");
    if (regPasswordHint) {
      regPasswordHint.classList.add("hint-error");
      regPasswordHint.textContent = "Şifre boşluk içeremez.";
    }
  } else {
    regPasswordInput?.classList.remove("match-error");
    regPasswordInput?.classList.add("match-success");
    if (regPasswordHint) {
      regPasswordHint.classList.add("hint-ok");
      regPasswordHint.textContent = "Şifre uzunluğu yeterli.";
    }
  }

  const hasConfirmInput = p2.length > 0;
  if (!hasConfirmInput) {
    regPasswordConfirm?.classList.remove("match-success", "match-error");
    return;
  }

  const isMatch = p1 === p2;
  regPasswordConfirm?.classList.toggle("match-success", isMatch);
  regPasswordConfirm?.classList.toggle("match-error", !isMatch);
  if (regPasswordConfirmHint) {
    regPasswordConfirmHint.classList.add(isMatch ? "hint-ok" : "hint-error");
    regPasswordConfirmHint.textContent = isMatch
      ? "Şifreler eşleşiyor."
      : "Şifreler eşleşmiyor.";
  }
}

regPasswordInput?.addEventListener("input", _validatePassword);
regPasswordConfirm?.addEventListener("input", _validatePassword);

/* ─────────────────── Şifre Gizle / Göster ─────────────────── */

let _svgEyeCache: string | null = null;
let _svgEyeOffCache: string | null = null;

function _getSvgHtml(id: string): string {
  const tmpl = document.getElementById(id) as HTMLTemplateElement | null;
  if (!tmpl) return "";
  return tmpl.innerHTML;
}

document.querySelectorAll(".toggle-password").forEach((btn) => {
  if (!btn.querySelector("svg")) {
    if (!_svgEyeCache) _svgEyeCache = _getSvgHtml("svg-eye");
    btn.innerHTML = _svgEyeCache;
  }
  btn.addEventListener("click", function (this: HTMLElement) {
    const input = this.previousElementSibling as HTMLInputElement | null;
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      if (!_svgEyeOffCache) _svgEyeOffCache = _getSvgHtml("svg-eye-off");
      this.innerHTML = _svgEyeOffCache;
    } else {
      input.type = "password";
      if (!_svgEyeCache) _svgEyeCache = _getSvgHtml("svg-eye");
      this.innerHTML = _svgEyeCache;
    }
  });
});
