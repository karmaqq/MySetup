/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ŞİFRE DEĞİŞTİRME                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, reload } from "firebase/auth";
import { currentUser } from "./app-state";
import { showToast } from "./global-fn";

const changePasswordModal = document.getElementById("changePasswordModal") as HTMLElement | null;

/* ─────────────────── Modal Kapatma ─────────────────── */

export function closeChangePassModal(): void {
  const form = document.getElementById("changePasswordForm") as HTMLFormElement | null;
  if (form) form.reset();
  const errEl = document.getElementById("changePassError");
  if (errEl) { errEl.textContent = ""; errEl.className = "auth-error"; }
  const submitBtn = document.getElementById("changePassSubmitBtn") as HTMLButtonElement | null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Şifreyi Kaydet"; }
  ["oldPassword", "newPassword", "newPasswordConfirm"].forEach(function (id) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.classList.remove("input-error");
  });
  if (changePasswordModal) changePasswordModal.classList.remove("active");
}

document.getElementById("openChangePassBtn")?.addEventListener("click", () => {
  const settingsModal = document.getElementById("userSettingsModal") as HTMLElement | null;
  if (settingsModal) settingsModal.classList.remove("active");
  const form = document.getElementById("changePasswordForm") as HTMLFormElement | null;
  if (form) form.reset();
  const errEl = document.getElementById("changePassError");
  if (errEl) { errEl.textContent = ""; errEl.className = "auth-error"; }
  ["oldPassword", "newPassword", "newPasswordConfirm"].forEach(function (id) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.classList.remove("input-error");
  });
  const submitBtn = document.getElementById("changePassSubmitBtn") as HTMLButtonElement | null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Şifreyi Kaydet"; }
  if (changePasswordModal) changePasswordModal.classList.add("active");
});

(function () {
  const oldPassEl = document.getElementById("oldPassword") as HTMLInputElement | null;
  const newPassEl = document.getElementById("newPassword") as HTMLInputElement | null;
  const newPassConfEl = document.getElementById("newPasswordConfirm") as HTMLInputElement | null;
  const submitBtn = document.getElementById("changePassSubmitBtn") as HTMLButtonElement | null;
  const errEl = document.getElementById("changePassError") as HTMLElement | null;

  function validate() {
    if (!oldPassEl || !newPassEl || !newPassConfEl || !submitBtn) return;
    const oldVal = oldPassEl.value;
    const newVal = newPassEl.value;
    const confirmVal = newPassConfEl.value;
    let errorMsg = "";
    let newPassInvalid = false;
    let confirmInvalid = false;

    if (newVal.length > 0 && newVal.length < 6) { errorMsg = "Yeni şifre en az 6 karakter olmalıdır."; newPassInvalid = true; }
    else if (confirmVal.length > 0 && newVal.length >= 6 && newVal !== confirmVal) { errorMsg = "Yeni şifreler uyuşmuyor."; confirmInvalid = true; }

    newPassEl.classList.toggle("input-error", newPassInvalid);
    newPassConfEl.classList.toggle("input-error", confirmInvalid);
    if (errEl) { errEl.textContent = errorMsg; errEl.style.color = errorMsg ? "var(--red)" : ""; }

    submitBtn.disabled = !(oldVal.length > 0 && newVal.length >= 6 && confirmVal.length >= 6 && newVal === confirmVal);
  }

  oldPassEl?.addEventListener("input", validate);
  newPassEl?.addEventListener("input", validate);
  newPassConfEl?.addEventListener("input", validate);
})();

document.getElementById("changePasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const oldPass = (document.getElementById("oldPassword") as HTMLInputElement).value;
  const newPass = (document.getElementById("newPassword") as HTMLInputElement).value;
  const newPassConfirm = (document.getElementById("newPasswordConfirm") as HTMLInputElement).value;
  const errEl = document.getElementById("changePassError") as HTMLElement;
  const submitBtn = (e.currentTarget as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;

  submitBtn.disabled = true;
  submitBtn.textContent = "Kaydediliyor...";

  if (newPass !== newPassConfirm) {
    errEl.textContent = "Yeni şifreler uyuşmuyor.";
    submitBtn.disabled = false;
    submitBtn.textContent = "Şifreyi Kaydet";
    return;
  }

  try {
    const user = currentUser;
    if (!user) {
      errEl.textContent = "Oturum bulunamadı. Lütfen yeniden giriş yapın.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Şifreyi Kaydet";
      return;
    }
    const userEmail = user.email || "";
    if (!userEmail) {
      errEl.textContent = "E-posta adresinize erişilemiyor. Lütfen destek ekibiyle iletişime geçin.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Şifreyi Kaydet";
      return;
    }
    const credential = EmailAuthProvider.credential(userEmail, oldPass);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPass);
    await reload(user);

    errEl.textContent = "Şifre başarıyla değiştirildi.";
    errEl.className = "auth-error success";

    setTimeout(() => {
      closeChangePassModal();
      showToast("Şifre güncellendi", "success");
    }, 900);
  } catch (err: any) {
    errEl.className = "auth-error";
    const passChangeErrors: Record<string, string> = {
      "auth/wrong-password": "Mevcut şifre hatalı.",
      "auth/invalid-credential": "Mevcut şifre hatalı.",
      "auth/too-many-requests": "Çok fazla başarısız deneme. Lütfen bekleyin.",
      "auth/network-request-failed": "Ağ bağlantısı hatası. İnterneti kontrol edin.",
      "auth/requires-recent-login": "Güvenlik nedeniyle lütfen tekrar giriş yapın.",
      "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
      "auth/user-not-found": "Kullanıcı bulunamadı.",
    };
    errEl.textContent = passChangeErrors[err.code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
    const oldPassInput = document.getElementById("oldPassword") as HTMLInputElement | null;
    if (oldPassInput) { oldPassInput.value = ""; oldPassInput.focus(); }
    submitBtn.disabled = false;
    submitBtn.textContent = "Şifreyi Kaydet";
  }
});

document.getElementById("closeChangePassBtn")?.addEventListener("click", closeChangePassModal);

changePasswordModal?.addEventListener("click", (e) => {
  if (e.target === changePasswordModal) closeChangePassModal();
});
