/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ŞİFRE DEĞİŞTİRME                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "./firebase-init";
import { showToast } from "./global-fn";
import { closeSettingsModal } from "./userset";

const changePasswordModal = document.getElementById("changePasswordModal") as HTMLElement | null;

export function closeChangePassModal(): void {
  const form = document.getElementById("changePasswordForm") as HTMLFormElement | null;
  if (form) form.reset();
  const errEl = document.getElementById("changePassError");
  if (errEl) errEl.textContent = "";
  const submitBtn = document.getElementById("changePassSubmitBtn") as HTMLButtonElement | null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Şifreyi Kaydet"; }
  ["oldPassword", "newPassword", "newPasswordConfirm"].forEach(function (id) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.classList.remove("input-error");
  });
  if (changePasswordModal) changePasswordModal.classList.remove("active");
}

document.getElementById("openChangePassBtn")?.addEventListener("click", () => {
  closeSettingsModal();
  closeChangePassModal();
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
    errEl.style.color = "var(--red)";
    errEl.textContent = "Yeni şifreler uyuşmuyor.";
    submitBtn.disabled = false;
    submitBtn.textContent = "Şifreyi Kaydet";
    return;
  }

  try {
    const user = firebase.auth().currentUser!;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email!, oldPass);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPass);
    await user.reload();

    errEl.style.color = "var(--green)";
    errEl.textContent = "Şifre başarıyla değiştirildi.";

    setTimeout(() => {
      closeChangePassModal();
  var cpForm = document.getElementById("changePasswordForm") as HTMLFormElement | null;
  if (cpForm) cpForm.reset();
  errEl.textContent = "";
  submitBtn.disabled = false;
  submitBtn.textContent = "Şifreyi Kaydet";
  showToast("Şifre güncellendi", "success");
    }, 900);
  } catch (err: any) {
    errEl.style.color = "var(--red)";
    errEl.textContent = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
      ? "Mevcut şifre hatalı."
      : "Bir hata oluştu.";
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
