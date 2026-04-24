/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       KULLANICI AYARLARI YÖNETİMİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modal Referansları ─────────────────── */

const settingsModal = document.getElementById("userSettingsModal");
const changePasswordModal = document.getElementById("changePasswordModal");
const deleteAccountModal = document.getElementById("deleteAccountModal");
const settingsTrigger = document.querySelector("#userInfo .settings-icon");

/* ─────────────────── Modal Kapatma Fonksiyonları ─────────────────── */

function closeSettingsModal() {
  if (typeof resetUsernameEditState === "function") resetUsernameEditState();
  if (settingsModal) {
    settingsModal.classList.remove("active");
  }
}

function closeChangePassModal() {
  if (changePasswordModal) {
    changePasswordModal.classList.remove("active");
  }
}

function closeDeleteModal() {
  if (deleteAccountModal) {
    deleteAccountModal.classList.remove("active");
  }
}

/* ─────────────────── Ayarlar Modalını Aç ─────────────────── */

settingsTrigger?.addEventListener("click", (e) => {
  if (e.target?.closest("#logoutBtn")) return;
  const user = auth.currentUser;
  if (!user) return;

  const _ni = document.getElementById("settingsDisplayName");
  if (_ni) {
    _ni.value = user.displayName || "";
    _ni.readOnly = true;
  }
  document.getElementById("editUsernameBtn")?.classList.remove("hidden");
  document.getElementById("saveUsernameBtn")?.classList.add("hidden");
  document.getElementById("cancelUsernameBtn")?.classList.add("hidden");
  const _sb = document.getElementById("saveUsernameBtn");
  if (_sb) _sb.disabled = true;
  const _err = document.getElementById("usernameError");
  if (_err) _err.textContent = "";
  if (settingsModal) {
    settingsModal.classList.add("active");
  }
});

/* ─────────────────── Modal Kapatma Olayları ─────────────────── */

document
  .getElementById("closeSettingsBtn")
  ?.addEventListener("click", closeSettingsModal);
document
  .getElementById("closeChangePassBtn")
  ?.addEventListener("click", closeChangePassModal);
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

/* ─────────────────── Çıkış Yap ─────────────────── */

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  closeSettingsModal();
  auth.signOut();
});

/* ─────────────────── Alt Modallerden Geri Dön ─────────────────── */

function goBackToSettings(from) {
  if (from === "changePass") closeChangePassModal();
  if (from === "deleteAcc") closeDeleteModal();
  if (settingsModal) {
    settingsModal.classList.add("active");
  }
}

document
  .getElementById("backToSettingsFromPass")
  ?.addEventListener("click", () => goBackToSettings("changePass"));
document
  .getElementById("backToSettingsFromDelete")
  ?.addEventListener("click", () => goBackToSettings("deleteAcc"));

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        KULLANICI ADI DÜZENLEMESİ                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Düzenleme Alanı Referansları ─────────────────── */

const editBtn = document.getElementById("editUsernameBtn");
const saveBtn = document.getElementById("saveUsernameBtn");
const cancelBtn = document.getElementById("cancelUsernameBtn");
const nameInput = document.getElementById("settingsDisplayName");
const usernameErrEl = document.getElementById("usernameError");

/* ─────────────────── Düzenleme Durumunu Sıfırla (modal kapanınca da) ─────────────────── */

function resetUsernameEditState() {
  const user = auth.currentUser;
  if (nameInput) {
    nameInput.value = user?.displayName || "";
    nameInput.readOnly = true;
  }
  if (usernameErrEl) usernameErrEl.textContent = "";
  editBtn?.classList.remove("hidden");
  saveBtn?.classList.add("hidden");
  cancelBtn?.classList.add("hidden");
  if (saveBtn) saveBtn.disabled = true;
}

/* ─────────────────── Düzenleme Modunu Aç ─────────────────── */

editBtn?.addEventListener("click", () => {
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

/* ─────────────────── Anlık Format Doğrulama + Dirty Kontrolü ─────────────────── */

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
  saveBtn.disabled = !(isDirty && isValid);
});

/* ─────────────────── İptal ─────────────────── */

cancelBtn?.addEventListener("click", () => {
  resetUsernameEditState();
});

/* ─────────────────── Kullanıcı Adını Kaydet ─────────────────── */

saveBtn?.addEventListener("click", async () => {
  const newName = nameInput.value.trim();
  if (usernameErrEl) usernameErrEl.textContent = "";

  if (!newName || newName.length < 3) {
    if (usernameErrEl) {
      usernameErrEl.textContent = "Kullanıcı adı en az 3 karakter olmalı";
      usernameErrEl.style.color = "var(--red)";
    }
    return;
  }

  saveBtn.disabled = true;

  try {
    const user = auth.currentUser;
    if (!user) {
      if (usernameErrEl) {
        usernameErrEl.textContent = "Oturum bulunamadı, tekrar giriş yapın";
        usernameErrEl.style.color = "var(--red)";
      }
      saveBtn.disabled = false;
      return;
    }

    await user.getIdToken(true);
    const oldName = (user.displayName || "").trim().toLowerCase();
    const newKey = newName.toLowerCase();

    if (oldName !== newKey) {
      if (!/^[a-z0-9._-]{3,32}$/.test(newKey)) {
        if (usernameErrEl) {
          usernameErrEl.textContent = "Geçersiz kullanıcı adı";
          usernameErrEl.style.color = "var(--red)";
        }
        saveBtn.disabled = false;
        return;
      }
      // Transaction ile atomic kullanıcı adı kaydı
      const usernameRef = database.ref("usernames/" + newKey);
      const txnResult = await usernameRef.transaction((current) => {
        if (current === null || current === user.uid) {
          return user.uid;
        }
        return; // başka bir kullanıcıya aitse değişiklik yapma
      });
      if (
        !txnResult.committed ||
        (txnResult.snapshot.exists() && txnResult.snapshot.val() !== user.uid)
      ) {
        if (usernameErrEl) {
          usernameErrEl.textContent = "Bu kullanıcı adı zaten alınmış";
          usernameErrEl.style.color = "var(--red)";
        }
        saveBtn.disabled = false;
        return;
      }
      if (oldName && oldName !== newKey) {
        try {
          await database.ref("usernames/" + oldName).set(null);
        } catch (_) {}
      }
    }

    await user.updateProfile({ displayName: newName });
    document.getElementById("userEmail").textContent = newName;
    if (usernameErrEl) usernameErrEl.textContent = "";
    if (typeof showToast === "function")
      showToast("Kullanıcı adı güncellendi", "success");

    nameInput.readOnly = true;
    saveBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
    editBtn.classList.remove("hidden");
  } catch (err) {
    const msg =
      err.code === "PERMISSION_DENIED" || err.message?.includes("Permission")
        ? "Yetki hatası — tekrar giriş yapıp deneyin"
        : err.message || "Hata oluştu";
    if (usernameErrEl) {
      usernameErrEl.textContent = msg;
      usernameErrEl.style.color = "var(--red)";
    }
    saveBtn.disabled = false;
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ŞİFRE DEĞİŞTİRME                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Şifre Değiştirme Modalını Aç ─────────────────── */

document.getElementById("openChangePassBtn")?.addEventListener("click", () => {
  closeSettingsModal();
  if (changePasswordModal) {
    openModalCount++;
    changePasswordModal.classList.add("active");
  }
});

/* ─────────────────── Anlık Şifre Doğrulama ─────────────────── */

(function () {
  const oldPassEl = document.getElementById("oldPassword");
  const newPassEl = document.getElementById("newPassword");
  const newPassConfEl = document.getElementById("newPasswordConfirm");
  const submitBtn = document.getElementById("changePassSubmitBtn");
  const errEl = document.getElementById("changePassError");

  function validate() {
    if (!oldPassEl || !newPassEl || !newPassConfEl || !submitBtn) return;
    const oldVal = oldPassEl.value;
    const newVal = newPassEl.value;
    const confirmVal = newPassConfEl.value;
    let errorMsg = "";
    let newPassInvalid = false;
    let confirmInvalid = false;

    if (newVal.length > 0 && newVal.length < 6) {
      errorMsg = "Yeni şifre en az 6 karakter olmalıdır.";
      newPassInvalid = true;
    } else if (
      confirmVal.length > 0 &&
      newVal.length >= 6 &&
      newVal !== confirmVal
    ) {
      errorMsg = "Yeni şifreler uyuşmuyor.";
      confirmInvalid = true;
    }

    newPassEl.classList.toggle("input-error", newPassInvalid);
    newPassConfEl.classList.toggle("input-error", confirmInvalid);
    if (errEl) {
      errEl.textContent = errorMsg;
      errEl.style.color = errorMsg ? "var(--red)" : "";
    }

    submitBtn.disabled = !(
      oldVal.length > 0 &&
      newVal.length >= 6 &&
      confirmVal.length >= 6 &&
      newVal === confirmVal
    );
  }

  oldPassEl?.addEventListener("input", validate);
  newPassEl?.addEventListener("input", validate);
  newPassConfEl?.addEventListener("input", validate);
})();

/* ─────────────────── Şifre Değiştirme Formu Submit ─────────────────── */

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
        document.getElementById("changePasswordForm")?.reset();
        errEl.textContent = "";
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Şifreyi Kaydet";
        }
        if (typeof showToast === "function")
          showToast("Şifre güncellendi", "success");
      }, 900);
    } catch (err) {
      errEl.style.color = "var(--red)";
      errEl.textContent =
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
          ? "Mevcut şifre hatalı."
          : "Bir hata oluştu.";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Şifreyi Kaydet";
      }
    }
  });

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            HESAP SİLME                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Hesap Silme Modalını Aç ─────────────────── */

document
  .getElementById("openDeleteAccountBtn")
  ?.addEventListener("click", () => {
    closeSettingsModal();
    if (deleteAccountModal) {
      openModalCount++;
      deleteAccountModal.classList.add("active");
    }
  });

/* ─────────────────── Onay Checkbox Kontrolü ─────────────────── */

document
  .getElementById("deleteConfirmCheck")
  ?.addEventListener("change", (e) => {
    document.getElementById("finalDeleteBtn").disabled = !e.target.checked;
  });

/* ─────────────────── Hesap Silme Formu Submit ─────────────────── */

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
      if (!user)
        throw new Error("Oturum bulunamadı, lütfen yeniden giriş yapın.");

      const credential = firebase.auth.EmailAuthProvider.credential(
        email,
        pass,
      );
      await user.reauthenticateWithCredential(credential);

      // 1. Realtime Database'den kullanıcı verilerini sil
      if (typeof database !== "undefined" && user.uid) {
        await database.ref("users/" + user.uid).remove();
        const usernameKey = (user.displayName || "").trim().toLowerCase();
        if (usernameKey) {
          const ref = database.ref("usernames/" + usernameKey);
          const snap = await ref.once("value");
          if (snap.val() === user.uid) await ref.remove();
        }
      }

      // 2. Storage'dan kullanıcıya ait tüm dosyaları sil
      if (typeof firebase !== "undefined" && firebase.storage && user.uid) {
        try {
          const storageRef = firebase.storage().ref();
          const userFolderRef = storageRef.child(`users/${user.uid}`);
          // Tüm alt dosya ve klasörleri listele ve sil
          async function deleteAllInFolder(ref) {
            const list = await ref.listAll();
            // Dosyaları sil
            await Promise.all(list.items.map((item) => item.delete()));
            // Alt klasörler için recursive silme
            await Promise.all(list.prefixes.map(deleteAllInFolder));
          }
          await deleteAllInFolder(userFolderRef);
        } catch (storageErr) {
          // Storage'da dosya yoksa veya erişim yoksa sessiz geç
          console.warn("Storage silme hatası:", storageErr);
        }
      }

      // 3. Kullanıcıyı sil
      await user.delete();
      if (typeof showToast === "function")
        showToast("Hesabınız kalıcı olarak silindi.", "info");
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
      } else {
        errEl.textContent =
          err?.message || "Bir hata oluştu. Lütfen tekrar deneyin.";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Hesabı Kalıcı Olarak Sil";
      }
    }
  });
