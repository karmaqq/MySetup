/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        POST OLUŞTURMA SİSTEMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

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
    createdAt: firebase.database.ServerValue.TIMESTAMP,
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

function _uploadAndSavePost(postData: Record<string, any>, file: File): void {
  const user = currentUser!;
  const ref = firebase
    .storage()
    .ref()
    .child("users/" + user.uid + "/posts/" + Date.now());

  ref
    .put(file)
    .then(function (snap: firebase.storage.UploadTaskSnapshot) {
      return snap.ref.getDownloadURL();
    })
    .then(function (url) {
      postData.imageUrl = url;
      _savePost(postData);
      return;
    })
    .catch(function () {
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
