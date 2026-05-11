/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       KULLANICI AYARLARI YÖNETİMİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { currentUser } from "./app-state";
import { db } from "./firebase-init";
import { initUserDataRef } from "./firebase-core";
import { refreshAllAvatars } from "./global-fn";
import { showToast } from "./global-fn";
import { closeChangePassModal } from "./pass-change";
import { closeDeleteModal } from "./delete-account-ui";

/* ─────────────────── Modal Referansları ─────────────────── */

const settingsModal = document.getElementById("userSettingsModal") as HTMLElement | null;

/* ─────────────────── Modal Kapatma Fonksiyonları ─────────────────── */

export function closeSettingsModal(): void {
  resetUsernameEditState();
  if (settingsModal) settingsModal.classList.remove("active");
}

export function closeAllModals(): void {
  closeSettingsModal();
  closeChangePassModal();
  closeDeleteModal();
}

/* ─────────────────── Ayarlar Modalını Aç ─────────────────── */

function openSettingsModal(): void {
  const user = currentUser;
  if (!user) return;

  const _ni = document.getElementById("settingsDisplayName") as HTMLInputElement | null;
  if (_ni) { _ni.value = user.displayName || ""; _ni.readOnly = true; }
  document.getElementById("editUsernameBtn")?.classList.remove("hidden");
  document.getElementById("saveUsernameBtn")?.classList.add("hidden");
  document.getElementById("cancelUsernameBtn")?.classList.add("hidden");
  const _sb = document.getElementById("saveUsernameBtn") as HTMLButtonElement | null;
  if (_sb) _sb.disabled = true;
  const _err = document.getElementById("usernameError");
  if (_err) _err.textContent = "";
  if (settingsModal) settingsModal.classList.add("active");
}

/* ─────────────────── Modal Kapatma Olayları ─────────────────── */

document.getElementById("closeSettingsBtn")?.addEventListener("click", closeSettingsModal);

settingsModal?.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

/* ─────────────────── Çıkış Yap ─────────────────── */

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  closeAllModals();
  initUserDataRef(null);
  firebase.auth().signOut();
});

/* ─────────────────── Alt Modallerden Geri Dön ─────────────────── */

function goBackToSettings(from: string): void {
  if (from === "changePass") closeChangePassModal();
  if (from === "deleteAcc") closeDeleteModal();
  if (settingsModal) settingsModal.classList.add("active");
}

document.getElementById("backToSettingsFromPass")?.addEventListener("click", () => goBackToSettings("changePass"));
document.getElementById("backToSettingsFromDelete")?.addEventListener("click", () => goBackToSettings("deleteAcc"));

document.getElementById("profileSettingsBtn")?.addEventListener("click", () => {
  openSettingsModal();
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        KULLANICI ADI DÜZENLEMESI                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

const editBtn = document.getElementById("editUsernameBtn") as HTMLElement | null;
const saveBtn = document.getElementById("saveUsernameBtn") as HTMLButtonElement | null;
const cancelBtn = document.getElementById("cancelUsernameBtn") as HTMLElement | null;
const nameInput = document.getElementById("settingsDisplayName") as HTMLInputElement | null;
const usernameErrEl = document.getElementById("usernameError") as HTMLElement | null;

export function resetUsernameEditState(): void {
  const user = currentUser;
  if (nameInput) { nameInput.value = user?.displayName || ""; nameInput.readOnly = true; }
  if (usernameErrEl) usernameErrEl.textContent = "";
  editBtn?.classList.remove("hidden");
  saveBtn?.classList.add("hidden");
  cancelBtn?.classList.add("hidden");
  if (saveBtn) saveBtn.disabled = true;
}

editBtn?.addEventListener("click", () => {
  nameInput!.dataset.original = nameInput!.value;
  nameInput!.readOnly = false;
  nameInput!.focus();
  const len = nameInput!.value.length;
  nameInput!.setSelectionRange(len, len);
  editBtn.classList.add("hidden");
  saveBtn!.classList.remove("hidden");
  cancelBtn!.classList.remove("hidden");
  saveBtn!.disabled = true;
});

nameInput?.addEventListener("input", () => {
  if (nameInput.readOnly || !usernameErrEl) return;
  const val = nameInput.value;
  const originalName = nameInput.dataset.original || "";
  let msg = "";

  if (/\s/.test(val)) msg = "Boşluk kullanılamaz";
  else if (/[A-Z]/.test(val)) msg = "Büyük harf kullanılamaz";
  else if (/[çğıöşüÇĞİÖŞÜ]/.test(val)) msg = "Türkçe karakter kullanılamaz";
  else if (/[^a-z0-9._-]/.test(val)) msg = "Geçersiz karakter";
  else if (val.length > 0 && val.length < 3) msg = "En az 3 karakter gerekli";

  usernameErrEl.textContent = msg;
  usernameErrEl.style.color = msg ? "var(--red)" : "";

  const isDirty = val.trim() !== originalName.trim();
  const isValid = !msg && val.trim().length >= 3;
  saveBtn!.disabled = !(isDirty && isValid);
});

cancelBtn?.addEventListener("click", resetUsernameEditState);

saveBtn?.addEventListener("click", async () => {
  const newName = nameInput!.value.trim();
  if (usernameErrEl) usernameErrEl.textContent = "";

  if (!newName || newName.length < 3) {
    if (usernameErrEl) { usernameErrEl.textContent = "Kullanıcı adı en az 3 karakter olmalı"; usernameErrEl.style.color = "var(--red)"; }
    return;
  }

  saveBtn!.disabled = true;

  try {
    const user = currentUser;
    if (!user) {
      if (usernameErrEl) { usernameErrEl.textContent = "Oturum bulunamadı, tekrar giriş yapın"; usernameErrEl.style.color = "var(--red)"; }
      saveBtn!.disabled = false;
      return;
    }

    await user.getIdToken(true);
    const oldName = (user.displayName || "").trim().toLowerCase();
    const newKey = newName.toLowerCase();

    if (oldName !== newKey) {
      if (!/^[a-z0-9._-]{3,32}$/.test(newKey)) {
        if (usernameErrEl) { usernameErrEl.textContent = "Geçersiz kullanıcı adı"; usernameErrEl.style.color = "var(--red)"; }
        saveBtn!.disabled = false;
        return;
      }

      const usernameRef = db.database!.ref("usernames/" + newKey);
      const txnResult = await usernameRef.transaction((current) => {
        if (current === null || current === user.uid) return user.uid;
        return;
      });
      if (!txnResult.committed || (txnResult.snapshot!.exists() && txnResult.snapshot!.val() !== user.uid)) {
        if (usernameErrEl) { usernameErrEl.textContent = "Bu kullanıcı adı zaten alınmış"; usernameErrEl.style.color = "var(--red)"; }
        saveBtn!.disabled = false;
        return;
      }
      if (oldName && oldName !== newKey) {
        try { await db.database!.ref("usernames/" + oldName).remove(); } catch (_) {}
      }
    }

    await user.updateProfile({ displayName: newName });
    const userEmailEl = document.getElementById("userEmail");
    if (userEmailEl) userEmailEl.textContent = newName;
    const profileUsernameEl = document.getElementById("profileUsername");
    if (profileUsernameEl) profileUsernameEl.textContent = newName;

    refreshAllAvatars(newName);

    if (usernameErrEl) usernameErrEl.textContent = "";
    showToast("Kullanıcı adı güncellendi", "success");

    nameInput!.readOnly = true;
    saveBtn!.classList.add("hidden");
    cancelBtn!.classList.add("hidden");
    editBtn!.classList.remove("hidden");
  } catch (err: any) {
    const msg = err.code === "PERMISSION_DENIED" || err.message?.includes("Permission")
      ? "Yetki hatası — tekrar giriş yapıp deneyin"
      : err.message || "Hata oluştu";
    if (usernameErrEl) { usernameErrEl.textContent = msg; usernameErrEl.style.color = "var(--red)"; }
    saveBtn!.disabled = false;
  }
});
