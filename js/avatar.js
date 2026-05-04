/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AVATAR SİSTEMİ                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Global State ─────────────────── */

let avatarModalEl = null;
let avatarFileInput = null;
let avatarDropArea = null;
let avatarPreview = null;
let saveAvatarBtn = null;
let publishAvatarBtn = null;
let cancelAvatarBtn = null;
let closeAvatarModalBtn = null;
let deleteAvatarBtn = null;
let oldAvatarsContainer = null;
let avatarPublishComposer = null;
let avatarPublishText = null;
let avatarPublishPreview = null;
let avatarPublishSubmitBtn = null;
let avatarPublishCancelBtn = null;
let avatarPublishFooter = null;
let avatarErrorEl = null;
let avatarViewModal = null;
let avatarViewImg = null;
let avatarViewCloseBtn = null;

let _avatarDragActive = false;
let avatarFile = null;
let _selectedOldAvatarUrl = null;
let avatarModalInitialized = false;

/* ─────────────────── Son 3 Avatar Cache ─────────────────── */

window._avatarHistory = [];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          İNİTİALİZASYON                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Avatar sistemini başlat ─────────────────── */

function initAvatarSystem() {
  if (avatarModalInitialized) return;
  avatarModalInitialized = true;

  avatarModalEl = document.getElementById("avatarModal");
  avatarFileInput = document.getElementById("avatarFileInput");
  avatarDropArea = document.getElementById("avatarDropArea");
  avatarPreview = document.getElementById("avatarPreview");
  saveAvatarBtn = document.getElementById("saveAvatarBtn");
  publishAvatarBtn = document.getElementById("publishAvatarBtn");
  cancelAvatarBtn = document.getElementById("cancelAvatarBtn");
  closeAvatarModalBtn = document.getElementById("closeAvatarModal");
  deleteAvatarBtn = document.getElementById("deleteAvatarBtn");
  oldAvatarsContainer = document.getElementById("oldAvatarsContainer");
  avatarPublishComposer = document.getElementById("avatarPublishComposer");
  avatarPublishText = document.getElementById("avatarPublishText");
  avatarPublishPreview = document.getElementById("avatarPublishPreview");
  avatarPublishSubmitBtn = document.getElementById("avatarPublishSubmitBtn");
  avatarPublishCancelBtn = document.getElementById("avatarPublishCancelBtn");
  avatarPublishFooter = document.getElementById("avatarPublishFooter");
  avatarErrorEl = document.getElementById("avatarError");
  avatarViewModal = document.getElementById("avatarViewModal");
  avatarViewImg = document.getElementById("avatarViewImg");
  avatarViewCloseBtn = document.getElementById("closeAvatarView");

  // Event listeners
  if (avatarFileInput) {
    avatarFileInput.addEventListener("change", function (e) {
      _avatarDragActive = false;
      if (e.target.files && e.target.files[0]) {
        _loadAvatarImage(e.target.files[0]);
      }
    });
  }

  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener("click", _saveAvatarOnly);
  }

  if (publishAvatarBtn) {
    publishAvatarBtn.addEventListener("click", _showPublishComposer);
  }

  if (cancelAvatarBtn) {
    cancelAvatarBtn.addEventListener("click", _closeAvatarModal);
  }

  if (closeAvatarModalBtn) {
    closeAvatarModalBtn.addEventListener("click", _closeAvatarModal);
  }

  if (deleteAvatarBtn) {
    deleteAvatarBtn.addEventListener("click", _deleteAvatar);
  }

  if (avatarPublishSubmitBtn) {
    avatarPublishSubmitBtn.addEventListener("click", _publishAvatarWithPost);
  }

  if (avatarPublishCancelBtn) {
    avatarPublishCancelBtn.addEventListener("click", _hidePublishComposer);
  }

  // Avatar view modal close
  if (avatarViewCloseBtn) {
    avatarViewCloseBtn.addEventListener("click", function () {
      if (avatarViewModal) avatarViewModal.classList.remove("active");
    });
  }

  // Profile avatar view
  var profileContainer = document.getElementById("profileAvatarContainer");
  if (profileContainer) {
    profileContainer.addEventListener("click", function () {
      _openAvatarView();
    });
  }

  // Edit profile avatar button
  var editBtn = document.getElementById("editProfileAvatarBtn");
  if (editBtn) {
    editBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      _openAvatarModal();
    });
  }

  // Modal dışı tıklamada kapanmasın
  if (avatarModalEl) {
    avatarModalEl.addEventListener("click", function (e) {
      if (e.target === avatarModalEl) {
        // Kapanmaz
      }
    });
  }

  // Drop area
  if (avatarDropArea) {
    avatarDropArea.addEventListener("click", function () {
      if (_avatarDragActive) {
        _avatarDragActive = false;
        return;
      }
      if (avatarFileInput) avatarFileInput.click();
    });

    avatarDropArea.addEventListener("dragover", function (e) {
      e.preventDefault();
      avatarDropArea.classList.add("dragover");
    });

    avatarDropArea.addEventListener("dragleave", function () {
      avatarDropArea.classList.remove("dragover");
    });

    avatarDropArea.addEventListener("drop", function (e) {
      e.preventDefault();
      avatarDropArea.classList.remove("dragover");
      _avatarDragActive = true;
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        _loadAvatarImage(e.dataTransfer.files[0]);
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     LOGIN'DE AVATAR YÜKLEME                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Login'de bir kez çağrılır ─────────────────── */

function loadUserAvatarOnLogin(uid) {
  var db = firebase.database();

  // avatarUrl'yi çek
  db.ref("users/" + uid + "/avatarUrl").once("value").then(function (snap) {
    window.currentUserAvatarUrl = snap.val() || null;
    if (typeof updateSidebarAvatar === "function") {
      updateSidebarAvatar(window.currentUserAvatarUrl);
    }
    if (typeof updateProfileAvatar === "function") {
      updateProfileAvatar(window.currentUserAvatarUrl);
    }
  });

  // avatarHistory'yi çek
  db.ref("users/" + uid + "/avatarHistory").once("value").then(function (snap) {
    window._avatarHistory = snap.val() || [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     AVATAR GÖRSELİ ALMA (CACHE)                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Verilen uid için avatar URL'sini döndürür ─────────────────── */

function getAvatarUrl(uid, fallbackUrl) {
  if (uid && firebase.auth().currentUser && uid === firebase.auth().currentUser.uid) {
    return window.currentUserAvatarUrl || fallbackUrl || "";
  }
  return fallbackUrl || "";
}

/* ─────────────────── Avatar HTML'i üretir ─────────────────── */

function renderAvatarHTML(username, uid, avatarUrl, size) {
  var url = getAvatarUrl(uid, avatarUrl);
  if (url) {
    return (
      '<img src="' +
      escAttr(url) +
      '" alt="" width="' +
      size +
      '" height="' +
      size +
      '" />'
    );
  }
  var nameStr = String(username || "?");
  var letter = nameStr.charAt(0).toUpperCase();
  return escHtml(letter);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     MODAL AÇ/KAPAT                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Avatar modalını aç ─────────────────── */

function _openAvatarModal() {
  if (!avatarModalEl) return;

  // Reset
  _resetModalState();
  avatarModalEl.classList.add("active");

  // Mevcut avatarı önizle
  _showCurrentInPreview();

  // Eski 3 avatarı göster
  _renderOldAvatars();
}

/* ─────────────────── Avatar modalını kapat ─────────────────── */

function _closeAvatarModal() {
  if (!avatarModalEl) return;
  avatarModalEl.classList.remove("active");
  _resetModalState();
}

/* ─────────────────── Modal state'ini sıfırla ─────────────────── */

function _resetModalState() {
  avatarFile = null;
  _selectedOldAvatarUrl = null;
  if (avatarPreview) avatarPreview.innerHTML = "";
  if (avatarFileInput) avatarFileInput.value = "";
  if (saveAvatarBtn) saveAvatarBtn.disabled = true;
  if (publishAvatarBtn) publishAvatarBtn.disabled = true;
  if (deleteAvatarBtn) {
    deleteAvatarBtn.style.display = window.currentUserAvatarUrl ? "block" : "none";
  }
  if (avatarErrorEl) avatarErrorEl.textContent = "";
  if (avatarPublishComposer) avatarPublishComposer.classList.add("hidden");
  if (avatarPublishFooter) avatarPublishFooter.classList.add("hidden");
  if (avatarPublishText) avatarPublishText.value = "";
  if (avatarDropArea) {
    avatarDropArea.classList.remove("dragover");
    var placeholder = document.getElementById("avatarPlaceholder");
    if (placeholder) placeholder.classList.remove("hidden");
  }
}

/* ─────────────────── Büyük avatar görüntüleme ─────────────────── */

function _openAvatarView() {
  if (!avatarViewModal || !avatarViewImg) return;
  var url = window.currentUserAvatarUrl || "";
  if (url) {
    avatarViewImg.src = url;
    avatarViewImg.style.display = "block";
  } else {
    avatarViewImg.style.display = "none";
  }
  avatarViewModal.classList.add("active");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     GÖRSEL YÜKLEME VE ÖNİZLEME                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yeni görsel yükle ─────────────────── */

function _loadAvatarImage(file) {
  if (!file.type.startsWith("image/")) {
    if (typeof showToast === "function") {
      showToast("Lütfen geçerli bir görsel seçin.", "warn");
    }
    return;
  }

  avatarFile = file;
  _selectedOldAvatarUrl = null; // Yeni seçildi, eski seçim temizlenir

  // Önizleme
  if (avatarPreview) {
    avatarPreview.innerHTML = "";
    var img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "50%";
    avatarPreview.appendChild(img);
  }

  if (saveAvatarBtn) saveAvatarBtn.disabled = false;
  if (publishAvatarBtn) publishAvatarBtn.disabled = false;
  if (deleteAvatarBtn) deleteAvatarBtn.style.display = "none";

  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.add("hidden");
}

/* ─────────────────── Mevcut avatarı önizleme alanında göster ─────────────────── */

function _showCurrentInPreview() {
  if (!avatarPreview) return;
  avatarPreview.innerHTML = "";

  var url = window.currentUserAvatarUrl;
  if (!url) return;

  var img = document.createElement("img");
  img.src = url;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.borderRadius = "50%";
  avatarPreview.appendChild(img);

  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.add("hidden");
}

/* ─────────────────── Eski 3 avatarı render et ─────────────────── */

function _renderOldAvatars() {
  if (!oldAvatarsContainer) return;
  oldAvatarsContainer.innerHTML = "";

  var history = window._avatarHistory || [];
  history.forEach(function (url, index) {
    var item = document.createElement("div");
    item.className = "avatar-old-item";
    item.dataset.index = index;

    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.width = 48;
    img.height = 48;
    item.appendChild(img);

    item.addEventListener("click", function () {
      _selectOldAvatar(index);
    });

    oldAvatarsContainer.appendChild(item);
  });
}

/* ─────────────────── Eski avatarı seç ─────────────────── */

function _selectOldAvatar(index) {
  var history = window._avatarHistory || [];
  if (!history[index]) return;

  _selectedOldAvatarUrl = history[index];
  avatarFile = null;

  // Önizleme
  if (avatarPreview) {
    avatarPreview.innerHTML = "";
    var img = document.createElement("img");
    img.src = _selectedOldAvatarUrl;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "50%";
    avatarPreview.appendChild(img);
  }

  if (saveAvatarBtn) saveAvatarBtn.disabled = false;
  if (publishAvatarBtn) publishAvatarBtn.disabled = false;
  if (deleteAvatarBtn) deleteAvatarBtn.style.display = "none";

  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.add("hidden");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     SADECE KAYDET (POST YOK)                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _saveAvatarOnly() {
  if (saveAvatarBtn) {
    saveAvatarBtn.disabled = true;
    saveAvatarBtn.textContent = "Kaydediliyor...";
  }
  if (avatarErrorEl) avatarErrorEl.textContent = "";

  // Eski avatar seçildiyse
  if (_selectedOldAvatarUrl) {
    _selectExistingAvatar(_selectedOldAvatarUrl);
    return;
  }

  // Yeni dosya yüklendiyse
  if (avatarFile) {
    _uploadAndSaveAvatar(avatarFile);
    return;
  }

  // Hiçbir şey seçilmedi
  if (saveAvatarBtn) {
    saveAvatarBtn.disabled = false;
    saveAvatarBtn.textContent = "Kaydet";
  }
}

/* ─────────────────── Mevcut bir avatarı seç ve kaydet ─────────────────── */

function _selectExistingAvatar(url) {
  window.currentUserAvatarUrl = url;

  // Database'i güncelle
  var user = firebase.auth().currentUser;
  if (!user) return;

  firebase
    .database()
    .ref("users/" + user.uid + "/avatarUrl")
    .set(url)
    .then(function () {
      if (typeof updateSidebarAvatar === "function") {
        updateSidebarAvatar(url);
      }
      if (typeof updateProfileAvatar === "function") {
        updateProfileAvatar(url);
      }
      _closeAvatarModal();
      if (typeof showToast === "function") {
        showToast("Avatar güncellendi", "success");
      }
    })
    .catch(function () {
      if (avatarErrorEl) avatarErrorEl.textContent = "Avatar kaydedilemedi.";
      if (saveAvatarBtn) {
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.textContent = "Kaydet";
      }
    });
}

/* ─────────────────── Yeni dosyayı yükle ve kaydet ─────────────────── */

function _uploadAndSaveAvatar(file) {
  var user = firebase.auth().currentUser;
  if (!user) return;

  var newFileName = "avatar_" + Date.now();
  var storageRef = firebase.storage().ref();
  var avatarRef = storageRef.child("users/" + user.uid + "/avatars/" + newFileName);

  avatarRef
    .put(file)
    .then(function (snap) {
      return snap.ref.getDownloadURL();
    })
    .then(function (url) {
      // History'yi güncelle
      return _updateAvatarHistory(user.uid, url).then(function () {
        window.currentUserAvatarUrl = url;

        // Database'e yaz
        var updates = {};
        updates["users/" + user.uid + "/avatarUrl"] = url;
        updates["users/" + user.uid + "/avatarHistory"] = window._avatarHistory;

        return firebase.database().ref().update(updates);
      });
    })
    .then(function () {
      if (typeof updateSidebarAvatar === "function") {
        updateSidebarAvatar(window.currentUserAvatarUrl);
      }
      if (typeof updateProfileAvatar === "function") {
        updateProfileAvatar(window.currentUserAvatarUrl);
      }
      _closeAvatarModal();
      if (typeof showToast === "function") {
        showToast("Avatar kaydedildi", "success");
      }
    })
    .catch(function () {
      if (avatarErrorEl) avatarErrorEl.textContent = "Avatar yüklenemedi.";
      if (saveAvatarBtn) {
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.textContent = "Kaydet";
      }
    });
}

/* ─────────────────── Avatar history'yi güncelle (son 3'ü tut) ─────────────────── */

function _updateAvatarHistory(uid, newUrl) {
  return new Promise(function (resolve) {
    var history = window._avatarHistory || [];

    // Yeni URL'yi başa ekle
    history.unshift(newUrl);

    // 4. varsa sil
    if (history.length > 3) {
      var oldUrl = history.pop(); // En eski
      // Storage'dan sil
      _deleteFromStorage(oldUrl);
    }

    window._avatarHistory = history;
    resolve();
  });
}

/* ─────────────────── Storage'dan sil ─────────────────── */

function _deleteFromStorage(url) {
  if (!url) return;
  try {
    var match = url.match(/\/o\/(.+)\?/);
    if (match && match[1]) {
      var path = decodeURIComponent(match[1]);
      firebase.storage().ref(path).delete().catch(function () {});
    }
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     YAYINLA VE KAYDET                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Publish composer'ı göster ─────────────────── */

function _showPublishComposer() {
  if (!avatarPublishComposer || !avatarPublishFooter) return;

  avatarPublishComposer.classList.remove("hidden");
  avatarPublishFooter.classList.remove("hidden");

  // Seçilen görseli 350x350 daire önizlemede göster
  if (avatarPublishPreview) {
    avatarPublishPreview.innerHTML = "";
    var url = _selectedOldAvatarUrl || "";
    if (avatarFile) {
      url = URL.createObjectURL(avatarFile);
    }
    if (url) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      avatarPublishPreview.appendChild(img);
    }
  }
}

/* ─────────────────── Publish composer'ı gizle ─────────────────── */

function _hidePublishComposer() {
  if (avatarPublishComposer) avatarPublishComposer.classList.add("hidden");
  if (avatarPublishFooter) avatarPublishFooter.classList.add("hidden");
  if (avatarPublishText) avatarPublishText.value = "";
}

/* ─────────────────── Avatarı kaydet ve post oluştur ─────────────────── */

function _publishAvatarWithPost() {
  if (avatarPublishSubmitBtn) {
    avatarPublishSubmitBtn.disabled = true;
    avatarPublishSubmitBtn.textContent = "Yayınlanıyor...";
  }
  if (avatarErrorEl) avatarErrorEl.textContent = "";

  var user = firebase.auth().currentUser;
  if (!user) return;

  // 1. Önce avatarı kaydet
  var avatarPromise;
  if (_selectedOldAvatarUrl) {
    // Eski avatar seçildiyse
    window.currentUserAvatarUrl = _selectedOldAvatarUrl;
    avatarPromise = firebase
      .database()
      .ref("users/" + user.uid + "/avatarUrl")
      .set(_selectedOldAvatarUrl);
  } else if (avatarFile) {
    // Yeni dosya
    avatarPromise = _uploadNewAvatar(user);
  } else {
    if (avatarPublishSubmitBtn) {
      avatarPublishSubmitBtn.disabled = false;
      avatarPublishSubmitBtn.textContent = "Yayınla";
    }
    return;
  }

  avatarPromise
    .then(function (newUrl) {
      // 2. Post oluştur
      var postData = {
        uid: user.uid,
        username: user.displayName || "Kullanici",
        avatarUrl: window.currentUserAvatarUrl,
        content: avatarPublishText ? avatarPublishText.value.trim() : "",
        imageUrl: window.currentUserAvatarUrl,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        likes: {},
        isAvatarPost: true,
      };

      return addPostToFirebase(postData);
    })
    .then(function () {
      if (typeof updateSidebarAvatar === "function") {
        updateSidebarAvatar(window.currentUserAvatarUrl);
      }
      if (typeof updateProfileAvatar === "function") {
        updateProfileAvatar(window.currentUserAvatarUrl);
      }
      _closeAvatarModal();
      if (typeof showToast === "function") {
        showToast("Avatar yayınlandı!", "success");
      }
    })
    .catch(function () {
      if (avatarErrorEl) avatarErrorEl.textContent = "Yayınlanamadı.";
      if (avatarPublishSubmitBtn) {
        avatarPublishSubmitBtn.disabled = false;
        avatarPublishSubmitBtn.textContent = "Yayınla";
      }
    });
}

/* ─────────────────── Yeni avatar yükle ve URL'yi döndür ─────────────────── */

function _uploadNewAvatar(user) {
  return new Promise(function (resolve, reject) {
    var newFileName = "avatar_" + Date.now();
    var storageRef = firebase.storage().ref();
    var avatarRef = storageRef.child(
      "users/" + user.uid + "/avatars/" + newFileName
    );

    avatarRef
      .put(avatarFile)
      .then(function (snap) {
        return snap.ref.getDownloadURL();
      })
      .then(function (url) {
        return _updateAvatarHistory(user.uid, url).then(function () {
          window.currentUserAvatarUrl = url;

          var updates = {};
          updates["users/" + user.uid + "/avatarUrl"] = url;
          updates["users/" + user.uid + "/avatarHistory"] = window._avatarHistory;

          return firebase.database().ref().update(updates);
        });
      })
      .then(function () {
        resolve(window.currentUserAvatarUrl);
      })
      .catch(reject);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     AVATAR SİL                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _deleteAvatar() {
  var user = firebase.auth().currentUser;
  if (!user) return;

  if (deleteAvatarBtn) {
    deleteAvatarBtn.disabled = true;
    deleteAvatarBtn.textContent = "Siliniyor...";
  }

  // Storage'daki tüm avatarları sil
  var storageRef = firebase.storage().ref();
  var avatarsRef = storageRef.child("users/" + user.uid + "/avatars");

  avatarsRef
    .listAll()
    .then(function (result) {
      var deletes = result.items.map(function (itemRef) {
        return itemRef.delete().catch(function () {});
      });
      return Promise.all(deletes);
    })
    .then(function () {
      // Database'den temizle
      var updates = {};
      updates["users/" + user.uid + "/avatarUrl"] = null;
      updates["users/" + user.uid + "/avatarHistory"] = null;
      return firebase.database().ref().update(updates);
    })
    .then(function () {
      window.currentUserAvatarUrl = null;
      window._avatarHistory = [];

      if (typeof updateSidebarAvatar === "function") {
        updateSidebarAvatar(null);
      }
      if (typeof updateProfileAvatar === "function") {
        updateProfileAvatar(null);
      }

      if (avatarPreview) avatarPreview.innerHTML = "";
      if (deleteAvatarBtn) {
        deleteAvatarBtn.style.display = "none";
        deleteAvatarBtn.disabled = false;
        deleteAvatarBtn.textContent = "Avatarı Sil";
      }

      if (typeof showToast === "function") {
        showToast("Avatar silindi", "info");
      }
    })
    .catch(function () {
      if (typeof showToast === "function") {
        showToast("Avatar silinemedi.", "error");
      }
      if (deleteAvatarBtn) {
        deleteAvatarBtn.disabled = false;
        deleteAvatarBtn.textContent = "Avatarı Sil";
      }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     SIDEBAR/PROFIL GÜNCELLEME                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sidebar avatarını güncelle ─────────────────── */

function updateSidebarAvatar(url) {
  var sidebarAvatar = document.querySelector("#sidebarAvatar");
  if (!sidebarAvatar) return;

  sidebarAvatar.innerHTML = "";
  if (url) {
    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    sidebarAvatar.appendChild(img);
  } else {
    var letter = (firebase.auth().currentUser?.displayName || "?")
      .charAt(0)
      .toUpperCase();
    sidebarAvatar.textContent = letter;
  }
}

/* ─────────────────── Profil avatarını güncelle ─────────────────── */

function updateProfileAvatar(url) {
  var profileImg = document.getElementById("profileAvatarImg");
  var profileSvg = document.getElementById("profileAvatarSvg");

  if (!profileImg || !profileSvg) return;

  if (url) {
    profileImg.src = url;
    profileImg.classList.remove("hidden");
    profileSvg.classList.add("hidden");
  } else {
    profileImg.classList.add("hidden");
    profileSvg.classList.remove("hidden");
  }
}
