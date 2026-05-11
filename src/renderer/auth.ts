/* ═══════════════════════════════════════════════════════════════════════════ */
/*                  KİMLİK DOĞRULAMA VE OTURUM YÖNETİMİ                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { onUserLoggedIn, onUserLoggedOut, getAuthErrorMessage, hideLoading } from "./auth-nav";
import { db } from "./firebase-init";

const auth = firebase.auth();

auth.onAuthStateChanged((user) => {
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

const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (document.getElementById("loginEmail") as HTMLInputElement).value.trim();
    const password = (document.getElementById("loginPassword") as HTMLInputElement).value;
    const errEl = document.getElementById("loginError") as HTMLElement;
    const btn = loginForm.querySelector(".auth-submit-btn") as HTMLButtonElement;
    const rememberMeCheck = document.getElementById("rememberMe") as HTMLInputElement | null;

    errEl.textContent = "";
    btn.textContent = "Giriş yapılıyor...";
    btn.disabled = true;

    try {
      await auth.setPersistence(
        rememberMeCheck?.checked
          ? firebase.auth.Auth.Persistence.LOCAL
          : firebase.auth.Auth.Persistence.SESSION,
      );
      await auth.signInWithEmailAndPassword(email, password);
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

const registerForm = document.getElementById("registerForm") as HTMLFormElement | null;

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = (document.getElementById("regUsername") as HTMLInputElement).value.trim();
    const email = (document.getElementById("regEmail") as HTMLInputElement).value.trim();
    const password = (document.getElementById("regPassword") as HTMLInputElement).value;
    const passwordConfirm = (document.getElementById("regPasswordConfirm") as HTMLInputElement).value;
    const errEl = document.getElementById("regError") as HTMLElement;
    const btn = registerForm.querySelector(".auth-submit-btn") as HTMLButtonElement;

    errEl.textContent = "";

    if (!username || username.length < 3) {
      errEl.textContent = "Kullanıcı adı en az 3 karakter olmalıdır.";
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      errEl.textContent = "Kullanıcı adı sadece küçük harf (a-z), rakam, nokta, tire, alt çizgi içerebilir.";
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
      const tempToken = "reserving_" + Date.now() + "_" + Math.random();
      const usernameRef = db.database!.ref("usernames/" + usernameKey);

      const txnResult = await usernameRef.transaction((current) => {
        if (current === null) return tempToken;
      });

      if (!txnResult.committed) {
        errEl.textContent = "Bu kullanıcı adı zaten alınmış.";
        btn.textContent = "Kayıt Ol";
        btn.disabled = false;
        return;
      }

      let cred: firebase.auth.UserCredential | null = null;
      try {
        cred = await auth.createUserWithEmailAndPassword(email, password);
        await usernameRef.set(cred.user.uid);
        await cred.user.updateProfile({ displayName: username });
      } catch (userErr: any) {
        try {
          await usernameRef.transaction(function (current) {
            if (current === tempToken) return null;
            return current;
          });
        } catch (_) {}
        if (cred && cred.user) {
          try { await cred.user.delete(); } catch (_) {}
        }
        errEl.textContent = getAuthErrorMessage(userErr.code) || "Bir hata oluştu.";
        btn.textContent = "Kayıt Ol";
        btn.disabled = false;
      }
    } catch (err: any) {
      errEl.textContent = getAuthErrorMessage(err.code);
      btn.textContent = "Kayıt Ol";
      btn.disabled = false;
    }
  });
}

/* ─────────────────── Panel Geçişi ─────────────────── */

document.getElementById("goToRegister")?.addEventListener("click", () => {
  document.getElementById("loginPanel")?.classList.add("hidden");
  document.getElementById("registerPanel")?.classList.remove("hidden");
});

document.getElementById("goToLogin")?.addEventListener("click", () => {
  document.getElementById("registerPanel")?.classList.add("hidden");
  document.getElementById("loginPanel")?.classList.remove("hidden");
});

/* ─────────────────── Şifre Eşleştirme Kontrolü ─────────────────── */

const regPasswordInput = document.getElementById("regPassword") as HTMLInputElement | null;
const regPasswordConfirm = document.getElementById("regPasswordConfirm") as HTMLInputElement | null;

function validatePasswords(): void {
  const p1 = regPasswordInput?.value || "";
  const p2 = regPasswordConfirm?.value || "";

  if (!p1 && !p2) {
    regPasswordInput?.classList.remove("match-success", "match-error");
    regPasswordConfirm?.classList.remove("match-success", "match-error");
    return;
  }

  const isMatch = p1 === p2 && p1.length >= 6;
  const hasInput = p2.length > 0;

  regPasswordInput?.classList.toggle("match-success", isMatch);
  regPasswordInput?.classList.toggle("match-error", !isMatch && hasInput);
  regPasswordConfirm?.classList.toggle("match-success", isMatch);
  regPasswordConfirm?.classList.toggle("match-error", !isMatch && hasInput);
}

regPasswordInput?.addEventListener("input", validatePasswords);
regPasswordConfirm?.addEventListener("input", validatePasswords);

/* ─────────────────── Şifre Gizle / Göster ─────────────────── */

document.querySelectorAll(".toggle-password").forEach((btn) => {
  const eyeTmpl = document.getElementById("svg-eye") as HTMLTemplateElement | null;
  if (eyeTmpl && btn.childNodes.length === 0) {
    btn.appendChild(eyeTmpl.content.cloneNode(true));
  }
  btn.addEventListener("click", function (this: HTMLElement) {
    const input = this.previousElementSibling as HTMLInputElement | null;
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      this.innerHTML = "";
      const eyeOffTmpl = document.getElementById("svg-eye-off") as HTMLTemplateElement | null;
      if (eyeOffTmpl) this.appendChild(eyeOffTmpl.content.cloneNode(true));
    } else {
      input.type = "password";
      this.innerHTML = "";
      const eyeTmpl2 = document.getElementById("svg-eye") as HTMLTemplateElement | null;
      if (eyeTmpl2) this.appendChild(eyeTmpl2.content.cloneNode(true));
    }
  });
});
