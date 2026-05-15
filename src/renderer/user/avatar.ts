/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AVATAR SİSTEMİ                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

import Cropper from "cropperjs";

import {
  currentUser,
  avatarModal,
  avatarModalClose,
  avatarModalCancel,
  avatarModalSave,
  avatarModalRemove,
  avatarCropImage,
  avatarCropContainer,
  avatarHistoryContainer,
  avatarHistoryList,
  avatarFileInput,
  avatarLightbox,
  avatarLightboxImg,
  profileAvatarBtn,
  profileAvatarContainer,
} from "../core/app-state";

import {
  escAttr,
  getFromAvatarCache,
  setAvatarCache,
  clearAvatarCache,
} from "../core/global-ut";

import {
  showToast,
  _walkAndUpdateAvatar,
  updateAvatarImage,
} from "../core/global-fn";

import { allPosts } from "../social/post-render";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { get, ref as dbRef, update } from "firebase/database";
import { db } from "../core/firebase-init";

/* ─────────────────── Durum Değişkenleri ─────────────────── */

let _cropper: Cropper | null = null;

const _CROPPER_CONFIG: Cropper.Options = {
  aspectRatio: 1,
  viewMode: 1,
  dragMode: "move",
  cropBoxMovable: false,
  cropBoxResizable: false,
  toggleDragModeOnDblclick: false,
  guides: false,
  center: true,
  background: false,
  minCropBoxWidth: 200,
  minCropBoxHeight: 200,
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YARDIMCI FONKSİYONLAR                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Storage Yükleme ─────────────────── */

function _uploadAvatarBlob(
  blob: Blob,
  storagePath: string,
): Promise<{ downloadUrl: string; storagePath: string }> {
  return new Promise(function (resolve, reject) {
    var storageReference = ref(getStorage(), storagePath);
    var uploadTask = uploadBytesResumable(storageReference, blob);

    uploadTask.on(
      "state_changed",
      function (snapshot) {
        var percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        _setUploadProgress(percent);
      },
      function (error) {
        reject(error);
      },
      function () {
        getDownloadURL(uploadTask.snapshot.ref)
          .then(function (url) {
            resolve({ downloadUrl: url, storagePath: storagePath });
          })
          .catch(reject);
      },
    );
  });
}

function _setUploadProgress(percent: number): void {
  var progressEl = document.getElementById("avatarUploadProgress");
  var fillEl = document.getElementById("avatarUploadFill");
  var labelEl = document.getElementById("avatarUploadLabel");

  if (!progressEl) return;

  progressEl.classList.remove("hidden");

  if (fillEl) fillEl.style.width = Math.round(percent) + "%";
  if (labelEl) labelEl.textContent = "Yükleniyor... %" + Math.round(percent);
}

function _hideUploadProgress(): void {
  var progressEl = document.getElementById("avatarUploadProgress");
  var fillEl = document.getElementById("avatarUploadFill");
  if (progressEl) progressEl.classList.add("hidden");
  if (fillEl) fillEl.style.width = "0%";
}

function _setModalSaving(isSaving: boolean): void {
  if (avatarModalSave) {
    (avatarModalSave as HTMLButtonElement).disabled = isSaving;
    avatarModalSave.textContent = isSaving ? "Kaydediliyor..." : "Kaydet";
  }
  if (avatarModalCancel) {
    (avatarModalCancel as HTMLButtonElement).disabled = isSaving;
  }
  if (avatarModalRemove) {
    (avatarModalRemove as HTMLButtonElement).disabled = isSaving;
  }
}

/* ─────────────────── Cropper Başlatma ─────────────────── */

function _initCropper(imageUrl: string): void {
  if (_cropper) {
    _cropper.destroy();
    _cropper = null;
  }

  if (!avatarCropImage) return;

  avatarCropImage.src = imageUrl;

  var _createInstance = function (): void {
    if (_cropper) {
      _cropper.destroy();
    }
    _cropper = new Cropper(avatarCropImage!, _CROPPER_CONFIG);
  };

  if (avatarCropImage.complete && avatarCropImage.naturalWidth > 0) {
    _createInstance();
  } else {
    avatarCropImage.onload = _createInstance;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          MODAL AÇ/KAPAT                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modal Açma ─────────────────── */

export function openAvatarModal(): void {
  var user = currentUser;
  if (!user) return;

  var hasAvatar = !!getFromAvatarCache(user.uid);
  if (avatarModalRemove) {
    (avatarModalRemove as HTMLButtonElement).disabled = !hasAvatar;
  }

  _hideUploadProgress();

  if (avatarFileInput) {
    avatarFileInput.value = "";
    avatarFileInput.click();
  }
}

/* ─────────────────── Modal Kapatma ─────────────────── */

export function closeAvatarModal(): void {
  if (_cropper) {
    _cropper.destroy();
    _cropper = null;
  }
  _hideUploadProgress();
  _setModalSaving(false);
  if (avatarModal) avatarModal.classList.remove("active");
  if (avatarCropImage) avatarCropImage.src = "";
  if (avatarHistoryContainer) avatarHistoryContainer.classList.add("hidden");
  if (avatarHistoryList) avatarHistoryList.innerHTML = "";
}

/* ─────────────────── Dosya Seçme ─────────────────── */

function _onFileSelected(file: File): void {
  if (!file.type.startsWith("image/")) {
    showToast("Lütfen geçerli bir görsel dosyası seçin", "error");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast("Dosya boyutu 5 MB sınırını aşıyor", "error");
    return;
  }

  var reader = new FileReader();

  reader.onload = function (e) {
    var dataUrl = (e.target as FileReader).result as string;
    _initCropper(dataUrl);
    if (avatarModal) avatarModal.classList.add("active");
    _loadAvatarHistory();
  };

  reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          KAYDETME VE YÜKLEME                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kırpılmış Avatarı Kaydetme ─────────────────── */

async function _saveCroppedAvatar(): Promise<void> {
  if (!_cropper) return;

  var user = currentUser;
  if (!user) {
    showToast("Oturum bulunamadı", "error");
    return;
  }

  var canvas = _cropper.getCroppedCanvas({ width: 400, height: 400 });

  if (!canvas) {
    showToast("Fotoğraf kesilemedi", "error");
    return;
  }

  var savedUser = user;

  _setModalSaving(true);

  canvas.toBlob(
    async function (blob) {
      if (!blob) {
        showToast("Görsel işlenemedi", "error");
        _setModalSaving(false);
        return;
      }

      try {
        var uid = savedUser.uid;
        var now = Date.now();
        var historyPath = "users/" + uid + "/avatar/history/" + now;
        var mainPath = "users/" + uid + "/avatar/main";

        var historyResult = await _uploadAvatarBlob(blob, historyPath);

        _setUploadProgress(60);

        var mainResult = await _uploadAvatarBlob(blob, mainPath);

        _setUploadProgress(90);

        var historySnapshot = await get(
          dbRef(db.database, "users/" + uid + "/avatarHistory"),
        );
        var existingHistory = (historySnapshot.val() || {}) as Record<
          string,
          { url: string; storagePath: string; createdAt: number }
        >;
        var historyKeys = Object.keys(existingHistory).sort();

        var dbUpdates: Record<string, any> = {};
        dbUpdates["users/" + uid + "/avatarUrl"] = mainResult.downloadUrl;
        dbUpdates["users/" + uid + "/avatarHistory/" + now] = {
          url: historyResult.downloadUrl,
          storagePath: historyPath,
          createdAt: now,
        };

        while (historyKeys.length >= 3) {
          var oldestKey = historyKeys.shift()!;
          dbUpdates["users/" + uid + "/avatarHistory/" + oldestKey] = null;

          var oldEntry = existingHistory[oldestKey];
          if (oldEntry && oldEntry.storagePath) {
            try {
              await deleteObject(ref(getStorage(), oldEntry.storagePath)).catch(
                function () {},
              );
            } catch (_) {}
          }
        }

        await update(dbRef(db.database), dbUpdates);

        setAvatarCache(uid, mainResult.downloadUrl);
        _walkAndUpdateAvatar(uid, mainResult.downloadUrl);
        updateAvatarImage(
          "sidebarAvatar",
          mainResult.downloadUrl,
          savedUser.displayName || "",
        );
        updateAvatarImage(
          "profileAvatarContainer",
          mainResult.downloadUrl,
          savedUser.displayName || "",
        );
        _updateAllPostAvatars(uid, mainResult.downloadUrl);

        _setUploadProgress(100);

        closeAvatarModal();
        showToast("Profil fotoğrafı güncellendi", "success");
      } catch (err: any) {
        showToast(
          "Yükleme başarısız: " + (err?.message || "Bilinmeyen hata"),
          "error",
        );
        _setModalSaving(false);
        _hideUploadProgress();
      }
    },
    "image/webp",
    0.9,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AVATAR SİLME                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function _removeAvatar(): Promise<void> {
  var user = currentUser;
  if (!user) return;

  var currentUrl = getFromAvatarCache(user.uid);
  if (!currentUrl) {
    closeAvatarModal();
    return;
  }

  _setModalSaving(true);

  try {
    var uid = user.uid;
    var dbUpdates: Record<string, any> = {};
    dbUpdates["users/" + uid + "/avatarUrl"] = null;

    await update(dbRef(db.database), dbUpdates);

    try {
      await deleteObject(
        ref(getStorage(), "users/" + uid + "/avatar/main"),
      ).catch(function () {});
    } catch (_) {}

    setAvatarCache(uid, null);
    _walkAndUpdateAvatar(uid, null);
    updateAvatarImage("sidebarAvatar", null, user.displayName || "");
    updateAvatarImage("profileAvatarContainer", null, user.displayName || "");
    _updateAllPostAvatars(uid, null);

    closeAvatarModal();
    showToast("Profil fotoğrafı kaldırıldı", "success");
  } catch (err: any) {
    showToast("Kaldırma işlemi başarısız oldu", "error");
    _setModalSaving(false);
  }
}

/* ─────────────────── Avatar Değişince Post/Yorum/Yanıt avatarUrl Güncelle ─────────────────── */

async function _updateAllPostAvatars(uid: string, url: string | null): Promise<void> {
  var dbUpdates: Record<string, any> = {};
  var postKeys = Object.keys(allPosts);
  for (var pi = 0; pi < postKeys.length; pi++) {
    var pid = postKeys[pi];
    var postData = allPosts[pid];
    if (!postData) continue;
    if (postData.uid === uid) {
      dbUpdates["posts/" + pid + "/avatarUrl"] = url;
    }
    if (postData.comments) {
      var cids = Object.keys(postData.comments);
      for (var ci = 0; ci < cids.length; ci++) {
        var cid = cids[ci];
        var comment = postData.comments[cid];
        if (comment.uid === uid) {
          dbUpdates["posts/" + pid + "/comments/" + cid + "/avatarUrl"] = url;
        }
        if (comment.replies) {
          var rids = Object.keys(comment.replies);
          for (var ri = 0; ri < rids.length; ri++) {
            var rid = rids[ri];
            var reply = comment.replies[rid];
            if (reply.uid === uid) {
              dbUpdates["posts/" + pid + "/comments/" + cid + "/replies/" + rid + "/avatarUrl"] = url;
            }
          }
        }
      }
    }
  }
  var batchKeys = Object.keys(dbUpdates);
  if (batchKeys.length === 0) return;
  for (var bi = 0; bi < batchKeys.length; bi += 500) {
    var batchChunk: Record<string, any> = {};
    var chunkKeys = batchKeys.slice(bi, bi + 500);
    for (var cki = 0; cki < chunkKeys.length; cki++) {
      batchChunk[chunkKeys[cki]] = dbUpdates[chunkKeys[cki]];
    }
    await update(dbRef(db.database), batchChunk);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AVATAR GEÇMİŞİ                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function _loadAvatarHistory(): Promise<void> {
  var user = currentUser;
  if (!user || !avatarHistoryContainer || !avatarHistoryList) return;

  try {
    var snap = await get(
      dbRef(db.database, "users/" + user.uid + "/avatarHistory"),
    );
    var history = (snap.val() || {}) as Record<
      string,
      { url: string; storagePath: string; createdAt: number }
    >;
    var keys = Object.keys(history).sort(function (a, b) {
      return Number(b) - Number(a);
    });

    if (keys.length === 0) {
      avatarHistoryContainer.classList.add("hidden");
      return;
    }

    avatarHistoryContainer.classList.remove("hidden");

    var currentUrl = getFromAvatarCache(user.uid);
    var recentKeys = keys.slice(0, 3);
    var html = "";

    for (var i = 0; i < recentKeys.length; i++) {
      var entry = history[recentKeys[i]];
      var isCurrent = entry.url === currentUrl;
      html +=
        '<div class="avatar-history-item' +
        (isCurrent ? " is-current" : "") +
        '" data-url="' +
        escAttr(entry.url) +
        '">' +
        '<img src="' +
        escAttr(entry.url) +
        '" alt="Geçmiş avatar" loading="lazy" />' +
        (isCurrent
          ? '<span class="avatar-history-check" aria-label="Mevcut">✓</span>'
          : "") +
        "</div>";
    }

    avatarHistoryList.innerHTML = html;

    avatarHistoryList
      .querySelectorAll(".avatar-history-item")
      .forEach(function (item) {
        item.addEventListener("click", function () {
          var url = (item as HTMLElement).dataset.url;
          if (url && avatarCropImage) {
            _initCropper(url);
          }
        });
      });
  } catch (_) {
    avatarHistoryContainer.classList.add("hidden");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          LIGHTBOX                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function openAvatarLightbox(): void {
  var user = currentUser;
  if (!user || !avatarLightbox || !avatarLightboxImg) return;

  var url = getFromAvatarCache(user.uid);
  if (!url) return;

  avatarLightboxImg.src = url;
  avatarLightbox.classList.add("active");
}

export function closeAvatarLightbox(): void {
  if (!avatarLightbox) return;
  avatarLightbox.classList.remove("active");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          İLKİLLENDİRME                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _initAvatarSystem(): void {
  if (avatarFileInput) {
    avatarFileInput.addEventListener("change", function () {
      var files = avatarFileInput!.files;
      if (files && files.length > 0) {
        _onFileSelected(files[0]);
        avatarFileInput!.value = "";
      }
    });
  }

  if (profileAvatarBtn) {
    profileAvatarBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openAvatarModal();
    });
  }

  if (profileAvatarContainer) {
    profileAvatarContainer.addEventListener("click", function () {
      var user = currentUser;
      if (!user) return;
      if (getFromAvatarCache(user.uid)) openAvatarLightbox();
    });

    profileAvatarContainer.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        var user = currentUser;
        if (!user) return;
        if (getFromAvatarCache(user.uid)) openAvatarLightbox();
      }
    });
  }

  if (avatarModalClose) {
    avatarModalClose.addEventListener("click", closeAvatarModal);
  }

  if (avatarModalCancel) {
    avatarModalCancel.addEventListener("click", closeAvatarModal);
  }

  if (avatarModalSave) {
    avatarModalSave.addEventListener("click", _saveCroppedAvatar);
  }

  if (avatarModalRemove) {
    avatarModalRemove.addEventListener("click", _removeAvatar);
  }

  if (avatarModal) {
    avatarModal.addEventListener("click", function (e) {
      if (e.target === avatarModal) closeAvatarModal();
    });
  }

  if (avatarLightbox) {
    avatarLightbox.addEventListener("click", function (e) {
      if (e.target === avatarLightbox) closeAvatarLightbox();
    });
    var lightboxContent = avatarLightbox.querySelector(
      ".avatar-lightbox-content",
    );
    if (lightboxContent) {
      lightboxContent.addEventListener("click", closeAvatarLightbox);
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (avatarModal && avatarModal.classList.contains("active")) {
        closeAvatarModal();
        return;
      }
      if (avatarLightbox && avatarLightbox.classList.contains("active")) {
        closeAvatarLightbox();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (avatarModal && avatarModal.classList.contains("active")) {
        e.preventDefault();
        _saveCroppedAvatar();
      }
    }
  });
}

_initAvatarSystem();

export { clearAvatarCache };
