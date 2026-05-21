/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       KULLANICI AYARLARI YÖNETİMİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { getAuth, getIdToken, signOut, updateProfile } from "firebase/auth";
import { get, ref, runTransaction, remove } from "firebase/database";
import { currentUser } from "../core/app-state";
import { db } from "../core/firebase-init";
import { initUserDataRef } from "../data/firebase-core";
import { refreshAllAvatars, showToast } from "../core/global-fn";
import { getFromAvatarCache } from "../core/global-ut";
import { closeChangePassModal } from "./pass-change";
import { closeDeleteModal } from "./delete-account-ui";
import { closeAvatarModal } from "./avatar";
import { allPosts } from "../social/post-render";
import { _updateUserFieldInPosts } from "../data/firebase-post";
import { updateUserPrivacy, getUserPrivacySettings } from "../data/firebase-user";

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
  closeAvatarModal();
}

/* ─────────────────── Global Modal Kapatma Hook'u ─────────────────── */
(window as any)._closeAllModals = closeAllModals;

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

  getUserPrivacySettings(user.uid).then(function (settings) {
    var invToggle = document.getElementById("inventoryPrivacyToggle") as HTMLInputElement | null;
    var likesToggle = document.getElementById("likesPrivacyToggle") as HTMLInputElement | null;
    if (invToggle) invToggle.checked = settings.inventoryPrivacy;
    if (likesToggle) likesToggle.checked = settings.likesPrivacy;
  }).catch(function () {});
}

/* ─────────────────── Modal Kapatma Olayları ─────────────────── */

document.getElementById("closeSettingsBtn")?.addEventListener("click", closeSettingsModal);

settingsModal?.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

/* ─────────────────── Çıkış Yap ─────────────────── */

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  initUserDataRef(null);
  signOut(getAuth());
});

/* ─────────────────── Alt Modallerden Geri Dön ─────────────────── */

function goBackToSettings(from: string): void {
  if (from === "changePass") closeChangePassModal();
  if (from === "deleteAcc") closeDeleteModal();
  setTimeout(function () {
    openSettingsModal();
  }, 240);
}

document.getElementById("backToSettingsFromPass")?.addEventListener("click", () => goBackToSettings("changePass"));
document.getElementById("backToSettingsFromDelete")?.addEventListener("click", () => goBackToSettings("deleteAcc"));

document.getElementById("profileSettingsBtn")?.addEventListener("click", () => {
  openSettingsModal();
});

/* ─────────────────── Gizlilik Toggle'ları ─────────────────── */

document.getElementById("inventoryPrivacyToggle")?.addEventListener("change", function (this: HTMLInputElement) {
  var input = this;
  var checked = input.checked;
  updateUserPrivacy("inventoryPrivacy", checked)
    .then(function () {
      showToast(checked ? "Envanter gizlendi" : "Envanter herkese açıldı", "success");
    })
    .catch(function () {
      input.checked = !checked;
      showToast("Gizlilik ayarı güncellenemedi", "error");
    });
});

document.getElementById("likesPrivacyToggle")?.addEventListener("change", function (this: HTMLInputElement) {
  var input = this;
  var checked = input.checked;
  updateUserPrivacy("likesPrivacy", checked)
    .then(function () {
      showToast(checked ? "Beğeniler gizlendi" : "Beğeniler herkese açıldı", "success");
    })
    .catch(function () {
      input.checked = !checked;
      showToast("Gizlilik ayarı güncellenemedi", "error");
    });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        KULLANICI ADI DÜZENLEMESI                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

const editBtn = document.getElementById("editUsernameBtn") as HTMLElement | null;
const saveBtn = document.getElementById("saveUsernameBtn") as HTMLButtonElement | null;
const cancelBtn = document.getElementById("cancelUsernameBtn") as HTMLElement | null;
const nameInput = document.getElementById("settingsDisplayName") as HTMLInputElement | null;
const usernameErrEl = document.getElementById("usernameError") as HTMLElement | null;

/* ─────────────────── Düzenleme Durumu Sıfırlama ─────────────────── */

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
  if (!nameInput || !saveBtn || !cancelBtn) return;
  nameInput.dataset.original = nameInput.value;
  nameInput.readOnly = false;
  nameInput.focus();
  const len = nameInput.value.length;
  nameInput.setSelectionRange(len, len);
  editBtn.classList.add("hidden");
  saveBtn.classList.remove("hidden");
  cancelBtn.classList.remove("hidden");
  saveBtn.disabled = true;
});

nameInput?.addEventListener("input", () => {
  if (nameInput.readOnly || !usernameErrEl || !saveBtn) return;
  const val = nameInput.value;
  const originalName = nameInput.dataset.original || "";
  let msg = "";

  if (/\s/.test(val)) msg = "Boşluk kullanılamaz";
  else if (/[A-Z]/.test(val)) msg = "Büyük harf kullanılamaz";
  else if (/[çğıöşüÇĞİÖŞÜ]/.test(val)) msg = "Türkçe karakter kullanılamaz";
  else if (/[^a-z0-9._-]/.test(val)) msg = "Geçersiz karakter";
  else if (val.length > 0 && val.length < 3) msg = "En az 3 karakter gerekli";

  usernameErrEl.textContent = msg;

  const isDirty = val.trim() !== originalName.trim();
  const isValid = !msg && val.trim().length >= 3;
  saveBtn.disabled = !(isDirty && isValid);
});

cancelBtn?.addEventListener("click", resetUsernameEditState);

saveBtn?.addEventListener("click", async () => {
  if (!nameInput || !saveBtn || !cancelBtn || !editBtn) return;
  const newName = nameInput.value.trim();
  if (usernameErrEl) usernameErrEl.textContent = "";

  if (!newName || newName.length < 3) {
    if (usernameErrEl) usernameErrEl.textContent = "Kullanıcı adı en az 3 karakter olmalı";
    return;
  }

  saveBtn.disabled = true;

  try {
    const user = currentUser;
    if (!user) {
      if (usernameErrEl) usernameErrEl.textContent = "Oturum bulunamadı, tekrar giriş yapın";
      saveBtn.disabled = false;
      return;
    }

    await getIdToken(user, true);
    const oldName = (user.displayName || "").trim().toLowerCase();
    const newKey = newName.toLowerCase();

    if (oldName !== newKey) {
      if (!/^[a-z0-9._-]{3,32}$/.test(newKey)) {
        if (usernameErrEl) usernameErrEl.textContent = "Geçersiz kullanıcı adı";
        saveBtn.disabled = false;
        return;
      }

      const usernameRef = ref(db.database, "usernames/" + newKey);
      const txnResult = await runTransaction(usernameRef, (current) => {
        if (current === null || current === user.uid) return user.uid;
        return;
      });
      if (!txnResult.committed || (txnResult.snapshot.exists() && txnResult.snapshot.val() !== user.uid)) {
        if (usernameErrEl) usernameErrEl.textContent = "Bu kullanıcı adı zaten alınmış";
        saveBtn.disabled = false;
        return;
      }
      if (oldName && oldName !== newKey) {
        try { await remove(ref(db.database, "usernames/" + oldName)); } catch (e) {}
      }
    }

    await updateProfile(user, { displayName: newName });

    var _currentAvatarUrl: string | null | undefined;
    try {
      _currentAvatarUrl = getFromAvatarCache(user.uid);
      await _updateUserFieldInPosts(user.uid, "username", newName, allPosts);
      if (_currentAvatarUrl !== undefined) {
        await _updateUserFieldInPosts(user.uid, "avatarUrl", _currentAvatarUrl, allPosts);
      }
    } catch (_) {
    }

    const userEmailEl = document.getElementById("userEmail");
    if (userEmailEl) userEmailEl.textContent = newName;
    const profileUsernameEl = document.getElementById("profileUsername");
    if (profileUsernameEl) profileUsernameEl.textContent = newName;

    refreshAllAvatars(newName, _currentAvatarUrl || undefined);

    if (usernameErrEl) usernameErrEl.textContent = "";
    showToast("Kullanıcı adı güncellendi", "success");

    nameInput.readOnly = true;
    saveBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
    editBtn.classList.remove("hidden");
  } catch (err: any) {
    const msg = err.code === "PERMISSION_DENIED" || err.message?.includes("Permission")
      ? "Yetki hatası — tekrar giriş yapıp deneyin"
      : err.message || "Hata oluştu";
    if (usernameErrEl) usernameErrEl.textContent = msg;
    saveBtn.disabled = false;
  }
});
