/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            HESAP SILME                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { currentUser } from "./app-state";
import { deleteUserAccount } from "./firebase-user";
import { showToast } from "./global-fn";
import { closeSettingsModal } from "./userset";

const deleteAccountModal = document.getElementById("deleteAccountModal") as HTMLElement | null;

export function closeDeleteModal(): void {
  const form = document.getElementById("deleteAccountForm") as HTMLFormElement | null;
  if (form) form.reset();
  const errEl = document.getElementById("deleteAccountError");
  if (errEl) errEl.textContent = "";
  const checkEl = document.getElementById("deleteConfirmCheck") as HTMLInputElement | null;
  if (checkEl) checkEl.checked = false;
  const submitBtn = document.getElementById("finalDeleteBtn") as HTMLButtonElement | null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Hesabı Kalıcı Olarak Sil"; }
  if (deleteAccountModal) deleteAccountModal.classList.remove("active");
}

document.getElementById("openDeleteAccountBtn")?.addEventListener("click", () => {
  closeSettingsModal();
  closeDeleteModal();
  if (deleteAccountModal) deleteAccountModal.classList.add("active");
});

document.getElementById("deleteConfirmCheck")?.addEventListener("change", (e) => {
  (document.getElementById("finalDeleteBtn") as HTMLButtonElement).disabled = !(e.target as HTMLInputElement).checked;
});

document.getElementById("deleteAccountForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = (document.getElementById("deleteEmail") as HTMLInputElement).value;
  const pass = (document.getElementById("deletePassword") as HTMLInputElement).value;
  const errEl = document.getElementById("deleteAccountError") as HTMLElement;
  const submitBtn = (e.currentTarget as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;

  submitBtn.disabled = true;
  submitBtn.textContent = "Siliniyor...";

  try {
    const user = currentUser;
    if (!user) throw new Error("Oturum bulunamadı, lütfen yeniden giriş yapın.");

    const credential = firebase.auth.EmailAuthProvider.credential(email, pass);
    await user.reauthenticateWithCredential(credential);

    const result = await deleteUserAccount(user);
    if (!result.success) throw result.error;

    showToast("Hesabınız kalıcı olarak silindi.", "info");
    closeDeleteModal();
  } catch (err: any) {
    errEl.style.color = "var(--red)";
    const code = err?.code || "";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      errEl.textContent = "E-posta veya şifre hatalı.";
    } else if (code === "auth/too-many-requests") {
      errEl.textContent = "Çok fazla deneme. Lütfen bekleyin.";
    } else if (code === "auth/requires-recent-login") {
      errEl.textContent = "Yeniden giriş yapmanız gerekiyor.";
    } else {
      errEl.textContent = err?.message || "Bir hata oluştu. Lütfen tekrar deneyin.";
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Hesabı Kalıcı Olarak Sil";
  }
});

document.getElementById("closeDeleteBtn")?.addEventListener("click", closeDeleteModal);

deleteAccountModal?.addEventListener("click", (e) => {
  if (e.target === deleteAccountModal) closeDeleteModal();
});
