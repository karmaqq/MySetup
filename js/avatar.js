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
let avatarErrorEl = null;
let avatarViewModal = null;
let avatarViewImg = null;
let avatarViewCloseBtn = null;

let _avatarDragActive = false;
let avatarFile = null;
let _selectedOldAvatarUrl = null;
let avatarModalInitialized = false;

/* ─────────────────── Crop State ─────────────────── */

let cropOffsetX = 0;
let cropOffsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let currentAvatarImg = null;

/* ─────────────────── Son Avatarlar Cache ─────────────────── */

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
  avatarErrorEl = document.getElementById("avatarError");
  avatarViewModal = document.getElementById("avatarViewModal");
  avatarViewImg = document.getElementById("avatarViewImg");
  avatarViewCloseBtn = document.getElementById("closeAvatarView");

  if (avatarFileInput) {
    avatarFileInput.addEventListener("change", function (e) {
      _avatarDragActive = false;
      if (e.target.files && e.target.files[0]) {
        _loadAvatarImage(e.target.files[0]);
      }
    });
  }

  if (saveAvatarBtn) saveAvatarBtn.addEventListener("click", _saveAvatarOnly);
  if (publishAvatarBtn)
    publishAvatarBtn.addEventListener("click", _showPublishComposer);
  if (cancelAvatarBtn)
    cancelAvatarBtn.addEventListener("click", _closeAvatarModal);
  if (closeAvatarModalBtn)
    closeAvatarModalBtn.addEventListener("click", _closeAvatarModal);
  if (deleteAvatarBtn) deleteAvatarBtn.addEventListener("click", _deleteAvatar);
  if (avatarPublishSubmitBtn)
    avatarPublishSubmitBtn.addEventListener("click", _publishAvatarWithPost);
  if (avatarPublishCancelBtn)
    avatarPublishCancelBtn.addEventListener("click", _hidePublishComposer);

  if (avatarViewCloseBtn) {
    avatarViewCloseBtn.addEventListener("click", function () {
      if (avatarViewModal) avatarViewModal.classList.remove("active");
    });
  }

  var profileContainer = document.getElementById("profileAvatarContainer");
  if (profileContainer) {
    profileContainer.addEventListener("click", function () {
      _openAvatarView();
    });
  }

  var editProfileBtn = document.getElementById("editProfileAvatarBtn");
  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      _openAvatarModal();
    });
  }

  if (avatarDropArea) {
    avatarDropArea.addEventListener("click", function (e) {
      if (e.target.closest("canvas")) return;
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

  db.ref("users/" + uid + "/avatarUrl")
    .once("value")
    .then(function (snap) {
      window.currentUserAvatarUrl = snap.val() || null;
      if (typeof updateSidebarAvatar === "function")
        updateSidebarAvatar(window.currentUserAvatarUrl);
      if (typeof updateProfileAvatar === "function")
        updateProfileAvatar(window.currentUserAvatarUrl);
    });

  db.ref("users/" + uid + "/avatarHistory")
    .once("value")
    .then(function (snap) {
      window._avatarHistory = snap.val() || [];
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     AVATAR GÖRSELİ ALMA (CACHE)                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Verilen uid için avatar URL'sini döndürür ─────────────────── */

function getAvatarUrl(uid, fallbackUrl) {
  if (
    uid &&
    firebase.auth().currentUser &&
    uid === firebase.auth().currentUser.uid
  ) {
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
  var letter = String(username || "?")
    .charAt(0)
    .toUpperCase();
  return escHtml(letter);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     MODAL AÇ/KAPAT                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Avatar modalını aç ─────────────────── */

function _openAvatarModal() {
  if (!avatarModalEl) return;
  _resetModalState();
  avatarModalEl.classList.add("active");
  _showCurrentInPreview();
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
  currentAvatarImg = null;
  cropOffsetX = 0;
  cropOffsetY = 0;
  isDragging = false;

  if (avatarPreview) avatarPreview.innerHTML = "";
  if (avatarFileInput) avatarFileInput.value = "";
  if (saveAvatarBtn) {
    saveAvatarBtn.disabled = true;
    saveAvatarBtn.textContent = "Kaydet";
  }
  if (publishAvatarBtn) {
    publishAvatarBtn.disabled = true;
    publishAvatarBtn.textContent = "Kaydet ve Yayınla";
  }
  if (deleteAvatarBtn)
    deleteAvatarBtn.style.display = window.currentUserAvatarUrl
      ? "inline-flex"
      : "none";
  if (avatarErrorEl) avatarErrorEl.textContent = "";
  if (avatarPublishComposer) avatarPublishComposer.classList.add("hidden");
  if (avatarPublishText) avatarPublishText.value = "";

  var canvas = document.getElementById("avatarCanvas");
  if (canvas) {
    canvas.classList.add("hidden");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.remove("hidden");

  if (avatarDropArea) avatarDropArea.classList.remove("dragover");
}

/* ─────────────────── Büyük avatar görüntüleme ─────────────────── */

function _openAvatarView() {
  if (!avatarViewModal || !avatarViewImg) return;
  var url = window.currentUserAvatarUrl || "";
  if (url) {
    avatarViewImg.src = url;
    avatarViewImg.style.display = "block";
    avatarViewModal.classList.add("active");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     GÖRSEL YÜKLEME, KROPRİNG VE ÖNİZLEME               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yeni görsel yükle ─────────────────── */

function _loadAvatarImage(file) {
  if (!file.type.startsWith("image/")) {
    if (typeof showToast === "function")
      showToast("Lütfen geçerli bir görsel seçin.", "warn");
    return;
  }

  avatarFile = file;
  _selectedOldAvatarUrl = null;
  cropOffsetX = 0;
  cropOffsetY = 0;

  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      currentAvatarImg = img;
      _showCropUI();
      _drawCropPreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);

  if (saveAvatarBtn) saveAvatarBtn.disabled = false;
  if (publishAvatarBtn) publishAvatarBtn.disabled = false;
  if (deleteAvatarBtn) deleteAvatarBtn.style.display = "none";

  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.add("hidden");
}

/* ─────────────────── Crop UI göster ─────────────────── */

function _showCropUI() {
  var canvas = document.getElementById("avatarCanvas");
  if (canvas) {
    canvas.classList.remove("hidden");
    _initCropDrag(canvas);
  }
  if (avatarPreview) avatarPreview.innerHTML = "";
}

/* ─────────────────── Canvas üzerine kırpılmış görseli çiz ─────────────────── */

function _drawCropPreview() {
  var canvas = document.getElementById("avatarCanvas");
  if (!canvas || !currentAvatarImg) return;

  var ctx = canvas.getContext("2d");
  var size = canvas.width;

  ctx.clearRect(0, 0, size, size);

  // Daire kırpma maskesi
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  var img = currentAvatarImg;
  var imgRatio = img.width / img.height;
  var drawWidth, drawHeight;

  if (imgRatio > 1) {
    drawHeight = size;
    drawWidth = size * imgRatio;
  } else {
    drawWidth = size;
    drawHeight = size / imgRatio;
  }

  var baseX = (size - drawWidth) / 2;
  var baseY = (size - drawHeight) / 2;

  ctx.drawImage(
    img,
    baseX + cropOffsetX,
    baseY + cropOffsetY,
    drawWidth,
    drawHeight,
  );
  ctx.restore();

  _syncPreviewCircle(canvas);
}

/* ─────────────────── Canvas içeriğini önizleme dairesine aktar ─────────────────── */

function _syncPreviewCircle(canvas) {
  if (!avatarPreview) return;
  var dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  avatarPreview.innerHTML = "";
  var img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText =
    "width:100%;height:100%;object-fit:cover;border-radius:50%;";
  avatarPreview.appendChild(img);
}

/* ─────────────────── Crop sürükleme olaylarını başlat ─────────────────── */

function _initCropDrag(canvas) {
  canvas.style.cursor = "grab";

  canvas.onmousedown = function (e) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.style.cursor = "grabbing";
  };

  canvas.onmousemove = function (e) {
    if (!isDragging) return;
    cropOffsetX += e.clientX - dragStartX;
    cropOffsetY += e.clientY - dragStartY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    _drawCropPreview();
  };

  canvas.onmouseup = function () {
    isDragging = false;
    canvas.style.cursor = "grab";
  };

  canvas.onmouseleave = function () {
    isDragging = false;
    canvas.style.cursor = "grab";
  };

  // Dokunmatik destek
  canvas.ontouchstart = function (e) {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
  };

  canvas.ontouchmove = function (e) {
    e.preventDefault();
    if (!isDragging) return;
    cropOffsetX += e.touches[0].clientX - dragStartX;
    cropOffsetY += e.touches[0].clientY - dragStartY;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    _drawCropPreview();
  };

  canvas.ontouchend = function () {
    isDragging = false;
  };
}

/* ─────────────────── Mevcut avatarı drop zone önizlemesine göster ─────────────────── */

function _showCurrentInPreview() {
  if (!avatarPreview) return;
  avatarPreview.innerHTML = "";
  var url = window.currentUserAvatarUrl;
  if (!url) return;
  var img = document.createElement("img");
  img.src = url;
  img.style.cssText =
    "width:100%;height:100%;object-fit:cover;border-radius:50%;";
  avatarPreview.appendChild(img);
  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.add("hidden");
}

/* ─────────────────── Son avatarları render et ─────────────────── */

function _renderOldAvatars() {
  if (!oldAvatarsContainer) return;
  oldAvatarsContainer.innerHTML = "";

  var history = window._avatarHistory || [];
  if (history.length === 0) return;

  var recentHistory = history.slice(0, 3);

  recentHistory.forEach(function (url, idx) {
    var item = document.createElement("div");
    item.className = "avatar-history-item";
    if (url === window.currentUserAvatarUrl) item.classList.add("active");
    item.dataset.idx = idx;

    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    item.appendChild(img);

    item.addEventListener("click", function () {
      _selectOldAvatar(idx);
    });

    oldAvatarsContainer.appendChild(item);
  });
}

/* ─────────────────── Eski avatarı seç ─────────────────── */

function _selectOldAvatar(idx) {
  var history = window._avatarHistory || [];
  if (!history[idx]) return;

  _selectedOldAvatarUrl = history[idx];
  avatarFile = null;
  currentAvatarImg = null;

  // Canvas'ı gizle, placeholder'ı gizle
  var canvas = document.getElementById("avatarCanvas");
  if (canvas) {
    canvas.classList.add("hidden");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  var placeholder = document.getElementById("avatarPlaceholder");
  if (placeholder) placeholder.classList.add("hidden");

  // Önizlemeye göster
  if (avatarPreview) {
    avatarPreview.innerHTML = "";
    var img = document.createElement("img");
    img.src = _selectedOldAvatarUrl;
    img.style.cssText =
      "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    avatarPreview.appendChild(img);
  }

  if (saveAvatarBtn) saveAvatarBtn.disabled = false;
  if (publishAvatarBtn) publishAvatarBtn.disabled = false;
  if (deleteAvatarBtn) deleteAvatarBtn.style.display = "none";

  // Aktif işareti güncelle
  var items = oldAvatarsContainer
    ? oldAvatarsContainer.querySelectorAll(".avatar-history-item")
    : [];
  items.forEach(function (item) {
    item.classList.toggle("active", parseInt(item.dataset.idx, 10) === idx);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     CANVAS → BLOB YARDIMCISI                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Canvas içeriğini blob'a çevirir, yükler ─────────────────── */

function _canvasToBlob(callback) {
  var canvas = document.getElementById("avatarCanvas");
  if (!canvas || !currentAvatarImg) {
    callback(null);
    return;
  }
  canvas.toBlob(
    function (blob) {
      callback(blob);
    },
    "image/jpeg",
    0.92,
  );
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

  if (_selectedOldAvatarUrl) {
    _selectExistingAvatar(_selectedOldAvatarUrl);
    return;
  }

  if (avatarFile) {
    _uploadAndSaveAvatar();
    return;
  }

  if (saveAvatarBtn) {
    saveAvatarBtn.disabled = false;
    saveAvatarBtn.textContent = "Kaydet";
  }
}

/* ─────────────────── Mevcut bir avatarı seç ve kaydet ─────────────────── */

function _selectExistingAvatar(url) {
  window.currentUserAvatarUrl = url;
  var user = firebase.auth().currentUser;
  if (!user) return;

  firebase
    .database()
    .ref("users/" + user.uid + "/avatarUrl")
    .set(url)
    .then(function () {
      if (typeof updateSidebarAvatar === "function") updateSidebarAvatar(url);
      if (typeof updateProfileAvatar === "function") updateProfileAvatar(url);
      _closeAvatarModal();
      if (typeof showToast === "function")
        showToast("Avatar güncellendi", "success");
    })
    .catch(function () {
      if (avatarErrorEl) avatarErrorEl.textContent = "Avatar kaydedilemedi.";
      if (saveAvatarBtn) {
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.textContent = "Kaydet";
      }
    });
}

/* ─────────────────── Yeni dosyayı kırp, yükle ve kaydet ─────────────────── */

function _uploadAndSaveAvatar() {
  var user = firebase.auth().currentUser;
  if (!user) return;

  _canvasToBlob(function (blob) {
    if (!blob) {
      if (avatarErrorEl) avatarErrorEl.textContent = "Görsel işlenemedi.";
      if (saveAvatarBtn) {
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.textContent = "Kaydet";
      }
      return;
    }

    var fileName = "avatar_" + Date.now();
    var ref = firebase
      .storage()
      .ref("users/" + user.uid + "/avatars/" + fileName);

    ref
      .put(blob)
      .then(function (snap) {
        return snap.ref.getDownloadURL();
      })
      .then(function (url) {
        return _updateAvatarHistory(user.uid, url).then(function () {
          window.currentUserAvatarUrl = url;
          var updates = {};
          updates["users/" + user.uid + "/avatarUrl"] = url;
          updates["users/" + user.uid + "/avatarHistory"] =
            window._avatarHistory;
          return firebase.database().ref().update(updates);
        });
      })
      .then(function () {
        if (typeof updateSidebarAvatar === "function")
          updateSidebarAvatar(window.currentUserAvatarUrl);
        if (typeof updateProfileAvatar === "function")
          updateProfileAvatar(window.currentUserAvatarUrl);
        _closeAvatarModal();
        if (typeof showToast === "function")
          showToast("Avatar kaydedildi", "success");
      })
      .catch(function () {
        if (avatarErrorEl) avatarErrorEl.textContent = "Avatar yüklenemedi.";
        if (saveAvatarBtn) {
          saveAvatarBtn.disabled = false;
          saveAvatarBtn.textContent = "Kaydet";
        }
      });
  });
}

/* ─────────────────── Avatar history güncelle (son 3 gösterim, tümü sakla) ─────────────────── */

function _updateAvatarHistory(uid, newUrl) {
  return new Promise(function (resolve) {
    var history = window._avatarHistory || [];
    history = history.filter(function (u) {
      return u !== newUrl;
    });
    history.unshift(newUrl);
    window._avatarHistory = history;
    resolve();
  });
}

/* ─────────────────── Storage'dan URL ile sil ─────────────────── */

function _deleteFromStorage(url) {
  if (!url) return;
  try {
    var match = url.match(/\/o\/(.+)\?/);
    if (match && match[1]) {
      firebase
        .storage()
        .ref(decodeURIComponent(match[1]))
        .delete()
        .catch(function () {});
    }
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     YAYINLA VE KAYDET                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Publish composer'ı göster ─────────────────── */

function _showPublishComposer() {
  if (!avatarPublishComposer) return;

  // Edit alanını gizle
  var avatarLayout = document.querySelector(".avatar-layout");
  if (avatarLayout) avatarLayout.classList.add("hidden");

  // Modal footer'ı gizle
  var modalFooter = document.querySelector(".avatar-modal-box .modal-footer");
  if (modalFooter) modalFooter.classList.add("hidden");

  // Büyük önizlemeyi doldur
  if (avatarPublishPreview) {
    avatarPublishPreview.innerHTML = "";
    var img = document.createElement("img");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;";
    if (_selectedOldAvatarUrl) {
      img.src = _selectedOldAvatarUrl;
      avatarPublishPreview.appendChild(img);
    } else if (avatarFile && currentAvatarImg) {
      // Canvas'tan al
      var canvas = document.getElementById("avatarCanvas");
      if (canvas) {
        img.src = canvas.toDataURL("image/jpeg", 0.92);
        avatarPublishPreview.appendChild(img);
      }
    } else if (window.currentUserAvatarUrl) {
      img.src = window.currentUserAvatarUrl;
      avatarPublishPreview.appendChild(img);
    }
  }

  avatarPublishComposer.classList.remove("hidden");
  if (avatarPublishText)
    setTimeout(function () {
      avatarPublishText.focus();
    }, 80);
}

/* ─────────────────── Publish composer'ı gizle ─────────────────── */

function _hidePublishComposer() {
  // Publish composer'ı gizle
  if (avatarPublishComposer) avatarPublishComposer.classList.add("hidden");
  if (avatarPublishText) avatarPublishText.value = "";

  // Edit alanını tekrar göster
  var avatarLayout = document.querySelector(".avatar-layout");
  if (avatarLayout) avatarLayout.classList.remove("hidden");

  // Modal footer'ı tekrar göster
  var modalFooter = document.querySelector(".avatar-modal-box .modal-footer");
  if (modalFooter) modalFooter.classList.remove("hidden");
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

  var captionText = avatarPublishText ? avatarPublishText.value.trim() : "";

  if (_selectedOldAvatarUrl) {
    // Eski avatar seçildi — önce DB'ye yaz, sonra post at
    window.currentUserAvatarUrl = _selectedOldAvatarUrl;
    firebase
      .database()
      .ref("users/" + user.uid + "/avatarUrl")
      .set(_selectedOldAvatarUrl)
      .then(function () {
        return _createAvatarPost(user, captionText);
      })
      .then(function () {
        if (typeof updateSidebarAvatar === "function")
          updateSidebarAvatar(window.currentUserAvatarUrl);
        if (typeof updateProfileAvatar === "function")
          updateProfileAvatar(window.currentUserAvatarUrl);
        _closeAvatarModal();
        if (typeof showToast === "function")
          showToast("Avatar yayınlandı!", "success");
      })
      .catch(function () {
        _publishError();
      });
    return;
  }

  if (avatarFile) {
    _canvasToBlob(function (blob) {
      if (!blob) {
        _publishError();
        return;
      }
      var fileName = "avatar_" + Date.now();
      var ref = firebase
        .storage()
        .ref("users/" + user.uid + "/avatars/" + fileName);
      ref
        .put(blob)
        .then(function (snap) {
          return snap.ref.getDownloadURL();
        })
        .then(function (url) {
          return _updateAvatarHistory(user.uid, url).then(function () {
            window.currentUserAvatarUrl = url;
            var updates = {};
            updates["users/" + user.uid + "/avatarUrl"] = url;
            updates["users/" + user.uid + "/avatarHistory"] =
              window._avatarHistory;
            return firebase.database().ref().update(updates);
          });
        })
        .then(function () {
          return _createAvatarPost(user, captionText);
        })
        .then(function () {
          if (typeof updateSidebarAvatar === "function")
            updateSidebarAvatar(window.currentUserAvatarUrl);
          if (typeof updateProfileAvatar === "function")
            updateProfileAvatar(window.currentUserAvatarUrl);
          _closeAvatarModal();
          if (typeof showToast === "function")
            showToast("Avatar yayınlandı!", "success");
        })
        .catch(function () {
          _publishError();
        });
    });
    return;
  }

  _publishError();
}

/* ─────────────────── Avatar postunu oluşturur ─────────────────── */

function _createAvatarPost(user, captionText) {
  var postData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    avatarUrl: window.currentUserAvatarUrl,
    content: captionText,
    imageUrl: window.currentUserAvatarUrl,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
    isAvatarPost: true,
  };
  return addPostToFirebase(postData);
}

/* ─────────────────── Publish hata durumu ─────────────────── */

function _publishError() {
  if (avatarErrorEl) avatarErrorEl.textContent = "Yayınlanamadı.";
  if (avatarPublishSubmitBtn) {
    avatarPublishSubmitBtn.disabled = false;
    avatarPublishSubmitBtn.textContent = "Paylaş";
  }
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

  var storageRef = firebase.storage().ref("users/" + user.uid + "/avatars");

  storageRef
    .listAll()
    .then(function (result) {
      return Promise.all(
        result.items.map(function (item) {
          return item.delete().catch(function () {});
        }),
      );
    })
    .then(function () {
      var updates = {};
      updates["users/" + user.uid + "/avatarUrl"] = null;
      updates["users/" + user.uid + "/avatarHistory"] = null;
      return firebase.database().ref().update(updates);
    })
    .then(function () {
      window.currentUserAvatarUrl = null;
      window._avatarHistory = [];
      if (typeof updateSidebarAvatar === "function") updateSidebarAvatar(null);
      if (typeof updateProfileAvatar === "function") updateProfileAvatar(null);
      if (avatarPreview) avatarPreview.innerHTML = "";
      if (deleteAvatarBtn) {
        deleteAvatarBtn.style.display = "none";
        deleteAvatarBtn.disabled = false;
        deleteAvatarBtn.textContent = "Avatarı Sil";
      }
      if (typeof showToast === "function") showToast("Avatar silindi", "info");
      _closeAvatarModal();
    })
    .catch(function () {
      if (typeof showToast === "function")
        showToast("Avatar silinemedi.", "error");
      if (deleteAvatarBtn) {
        deleteAvatarBtn.disabled = false;
        deleteAvatarBtn.textContent = "Avatarı Sil";
      }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     SIDEBAR / PROFİL GÜNCELLEME                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sidebar avatarını güncelle ─────────────────── */

function updateSidebarAvatar(url) {
  var el = document.getElementById("sidebarAvatar");
  if (!el) return;
  el.innerHTML = "";
  if (url) {
    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    el.appendChild(img);
  } else {
    el.textContent = (firebase.auth().currentUser?.displayName || "?")
      .charAt(0)
      .toUpperCase();
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
