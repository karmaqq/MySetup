/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        POST OLUŞTURMA SİSTEMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { serverTimestamp } from "firebase/database";
import { getStorage, ref, uploadBytes, getDownloadURL, UploadResult } from "firebase/storage";
import { currentUser } from "./app-state";
import { POST_PHRASES } from "./global-ut";
import { addPostToFirebase } from "./firebase-post";
import { showToast } from "./global-fn";

/* ─────────────────── DOM Referansları ─────────────────── */

const postText = document.getElementById(
  "postText",
) as HTMLTextAreaElement | null;
const postImageInput = document.getElementById(
  "postImageInput",
) as HTMLInputElement | null;
const postImageBtn = document.getElementById(
  "postImageBtn",
) as HTMLElement | null;
const publishPostBtn = document.getElementById(
  "publishPostBtn",
) as HTMLElement | null;
const postImagePreviewEl = document.getElementById(
  "postImagePreview",
) as HTMLElement | null;

/* ─────────────────── Seçili Görsel ─────────────────── */

let selectedPostImage: File | null = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           POST OLUŞTURMA                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post Oluşturma ─────────────────── */

export function createPost(): void {
  const text = (postText ? postText.value : "").trim();
  if (!text && !selectedPostImage) {
    showToast("Lütfen bir metin yazın veya görsel seçin.", "warn");
    return;
  }


  const user = currentUser;
  if (!user) return;

  if (publishPostBtn) {
    (publishPostBtn as HTMLButtonElement).disabled = true;
    publishPostBtn.textContent = "Yayınlanıyor...";
  }

  const postData: Record<string, any> = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    content: text,
    imageUrl: null,
    createdAt: serverTimestamp(),
    likes: {},
    phraseIndex: Math.floor(Math.random() * POST_PHRASES.length),
  };

  if (selectedPostImage) {
    _uploadAndSavePost(postData, selectedPostImage);
  } else {
    _savePost(postData);
  }
}

/* ─────────────────── Görsel varsa önce yükle, sonra kaydet ─────────────────── */

function _compressPostImage(file: File): Promise<Blob> {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, 1200 / img.naturalWidth);
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        function (blob) {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("Sıkıştırma başarısız"));
        },
        "image/webp",
        0.82,
      );
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel yüklenemedi"));
    };
    img.src = url;
  });
}

function _uploadAndSavePost(postData: Record<string, any>, file: File): void {
  const user = currentUser;
  if (!user) { showToast("Oturum bulunamadı.", "error"); return; }
  const path = "users/" + user.uid + "/posts/" + Date.now();

  _compressPostImage(file).then(function (blob) {
    var imageRef = ref(getStorage(), path);
    return uploadBytes(imageRef, blob)
      .then(function (snap: UploadResult) {
        return getDownloadURL(snap.ref);
      })
      .then(function (url) {
        postData.imageUrl = url;
        postData.imagePath = path;
        _savePost(postData);
      });
  }).catch(function () {
    if (publishPostBtn) {
      (publishPostBtn as HTMLButtonElement).disabled = false;
      publishPostBtn.textContent = "Yayınla";
    }
    showToast("Görsel yüklenemedi.", "error");
  });
}

/* ─────────────────── Firebase'e post yazar, formu sıfırlar ─────────────────── */

function _savePost(postData: Record<string, any>): void {
  addPostToFirebase(postData)
    .then(function () {
      if (postText) postText.value = "";
      selectedPostImage = null;
      if (postImagePreviewEl) {
        postImagePreviewEl.classList.add("hidden");
        postImagePreviewEl.innerHTML = "";
      }
      if (publishPostBtn) {
        (publishPostBtn as HTMLButtonElement).disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      if (postImageInput) postImageInput.value = "";
      showToast("Gönderi yayınlandı!", "success");
    })
    .catch(function () {
      if (publishPostBtn) {
        (publishPostBtn as HTMLButtonElement).disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      showToast("Gönderi yayınlanamadı.", "error");
    });
}

/* ─────────────────── Görsel seçildiğinde önizleme ─────────────────── */

function _handlePostImageSelect(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Lütfen geçerli bir görsel seçin.", "warn");
    return;
  }
  selectedPostImage = file;
  const reader = new FileReader();
  reader.onload = function (ev) {
    if (!postImagePreviewEl) return;
    postImagePreviewEl.innerHTML =
      '<div class="post-preview-wrapper">' +
      '<img src="' +
      (ev.target as any).result +
      '" class="post-preview-img" />' +
      '<button class="remove-post-image-btn">✕</button>' +
      "</div>";
    postImagePreviewEl.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

/* ─────────────────── Seçili görseli kaldır ─────────────────── */

export function _removePostImage(): void {
  selectedPostImage = null;
  if (postImagePreviewEl) {
    postImagePreviewEl.classList.add("hidden");
    postImagePreviewEl.innerHTML = "";
  }
  if (postImageInput) postImageInput.value = "";
}

/* ─────────────────── Post taslağını temizle ─────────────────── */

export function clearPostDraft(): void {
  if (postText) postText.value = "";
  selectedPostImage = null;
  if (postImagePreviewEl) {
    postImagePreviewEl.classList.add("hidden");
    postImagePreviewEl.innerHTML = "";
  }
  if (postImageInput) postImageInput.value = "";
}

/* ─────────────────── Event Bağlantıları ─────────────────── */

if (postImageBtn && postImageInput) {
  postImageBtn.addEventListener("click", () => postImageInput!.click());
  postImageInput.addEventListener("change", _handlePostImageSelect);
}

if (postImagePreviewEl) {
  postImagePreviewEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("remove-post-image-btn")) {
      _removePostImage();
    }
  });
}

if (publishPostBtn) {
  publishPostBtn.addEventListener("click", createPost);
}

if (postText) {
  postText.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      createPost();
    }
  });
}

/* ─────────────────── Taslak Temizleme Kaydı ─────────────────── */

(window as any).clearPostDraft = clearPostDraft;
