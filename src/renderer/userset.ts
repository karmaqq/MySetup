/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       KULLANICI AYARLARI YÖNETİMİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { currentUser } from "./app-state";
import { db } from "./firebase-init";
import { initUserDataRef } from "./firebase-core";
import { refreshAllAvatars, showToast } from "./global-fn";
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
  initUserDataRef(null);
  firebase.auth().signOut();
});

/* ─────────────────── Alt Modallerden Geri Dön ─────────────────── */

function goBackToSettings(from: string): void {
  if (from === "changePass") closeChangePassModal();
  if (from === "deleteAcc") closeDeleteModal();
  // F-09: Modal kapanma animasyonu (220ms CSS transition) bitmeden açma
  setTimeout(function () {
    openSettingsModal();
  }, 240);
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

    await user.getIdToken(true);
    const oldName = (user.displayName || "").trim().toLowerCase();
    const newKey = newName.toLowerCase();

    if (oldName !== newKey) {
      if (!/^[a-z0-9._-]{3,32}$/.test(newKey)) {
        if (usernameErrEl) usernameErrEl.textContent = "Geçersiz kullanıcı adı";
        saveBtn.disabled = false;
        return;
      }

      const usernameRef = db.database!.ref("usernames/" + newKey);
      const txnResult = await usernameRef.transaction((current) => {
        if (current === null || current === user.uid) return user.uid;
        return;
      });
      if (!txnResult.committed || (txnResult.snapshot?.exists() && txnResult.snapshot!.val() !== user.uid)) {
        if (usernameErrEl) usernameErrEl.textContent = "Bu kullanıcı adı zaten alınmış";
        saveBtn.disabled = false;
        return;
      }
      if (oldName && oldName !== newKey) {
        try { await db.database!.ref("usernames/" + oldName).remove(); } catch (e) { /* eski kullanıcı adı silinemedi */ }
      }
    }

    await user.updateProfile({ displayName: newName });

    // F-08: Geçmiş post/yorum/yanıtlardaki kullanıcı adını güncelle
    try {
      const postIdsSnap = await db.database!.ref("userPosts/" + user.uid).once("value");
      const postIds = postIdsSnap.val() as Record<string, number> | null;
      if (postIds) {
        const postKeys = Object.keys(postIds);
        var batchSize = 10;
        for (var i = 0; i < postKeys.length; i += batchSize) {
          var batch: Record<string, any> = {};
          var chunk = postKeys.slice(i, i + batchSize);
          for (var j = 0; j < chunk.length; j++) {
            var pid = chunk[j];
            var postSnap = await db.database!.ref("posts/" + pid).once("value");
            var postData = postSnap.val() as Record<string, any> | null;
            if (!postData) continue;
            // Post sahibi ise username alanını güncelle
            if (postData.uid === user.uid) {
              batch["posts/" + pid + "/username"] = newName;
            }
            // Yorumlarda kullanıcı adını güncelle
            if (postData.comments) {
              var cids = Object.keys(postData.comments);
              for (var k = 0; k < cids.length; k++) {
                var cid = cids[k];
                var comment = postData.comments[cid];
                if (comment.uid === user.uid) {
                  batch["posts/" + pid + "/comments/" + cid + "/username"] = newName;
                }
                // Yanıtlarda kullanıcı adını güncelle
                if (comment.replies) {
                  var rids = Object.keys(comment.replies);
                  for (var l = 0; l < rids.length; l++) {
                    var rid = rids[l];
                    var reply = comment.replies[rid];
                    if (reply.uid === user.uid) {
                      batch["posts/" + pid + "/comments/" + cid + "/replies/" + rid + "/username"] = newName;
                    }
                  }
                }
              }
            }
          }
          if (Object.keys(batch).length > 0) {
            await db.database!.ref().update(batch);
          }
        }
      }
    } catch (_) {
      // Geçmiş güncelleme başarısız — kritik değil
    }

    const userEmailEl = document.getElementById("userEmail");
    if (userEmailEl) userEmailEl.textContent = newName;
    const profileUsernameEl = document.getElementById("profileUsername");
    if (profileUsernameEl) profileUsernameEl.textContent = newName;

    refreshAllAvatars(newName);

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
