/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        POST OLUŞTURMA SİSTEMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── DOM Referansları ─────────────────── */

const postText = document.getElementById("postText");
const postImageInput = document.getElementById("postImageInput");
const postImageBtn = document.getElementById("postImageBtn");
const publishPostBtn = document.getElementById("publishPostBtn");
const postImagePreviewEl = document.getElementById("postImagePreview");
const postsFeed = document.getElementById("postsFeed");

/* ─────────────────── Seçili Görsel ─────────────────── */

let selectedPostImage = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           POST OLUŞTURMA                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yayınla butonuna basıldığında ─────────────────── */

function createPost() {
  const text = (postText ? postText.value : "").trim();
  if (!text && !selectedPostImage) {
    showToast("Lütfen bir metin yazın veya görsel seçin.", "warn");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) return;

  if (publishPostBtn) {
    publishPostBtn.disabled = true;
    publishPostBtn.textContent = "Yayınlanıyor...";
  }

  const postData = {
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

function _uploadAndSavePost(postData, file) {
  const user = firebase.auth().currentUser;
  const ref = firebase
    .storage()
    .ref()
    .child("users/" + user.uid + "/posts/" + Date.now());

  ref
    .put(file)
    .then(function (snap) {
      return snap.ref.getDownloadURL();
    })
    .then(function (url) {
      postData.imageUrl = url;
      _savePost(postData);
    })
    .catch(function () {
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      showToast("Görsel yüklenemedi.", "error");
    });
}

/* ─────────────────── Firebase'e post yazar, formu sıfırlar ─────────────────── */

function _savePost(postData) {
  addPostToFirebase(postData)
    .then(function () {
      if (postText) postText.value = "";
      selectedPostImage = null;
      if (postImagePreviewEl) {
        postImagePreviewEl.classList.add("hidden");
        postImagePreviewEl.innerHTML = "";
      }
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      if (postImageInput) postImageInput.value = "";
      showToast("Gönderi yayınlandı!", "success");
    })
    .catch(function () {
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      showToast("Gönderi yayınlanamadı.", "error");
    });
}

/* ─────────────────── Görsel seçildiğinde önizleme ─────────────────── */

function _handlePostImageSelect(e) {
  const file = e.target.files[0];
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
      ev.target.result +
      '" class="post-preview-img" />' +
      '<button class="remove-post-image-btn">✕</button>' +
      "</div>";
    postImagePreviewEl.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

/* ─────────────────── Seçili görseli kaldır ─────────────────── */

function _removePostImage() {
  selectedPostImage = null;
  if (postImagePreviewEl) {
    postImagePreviewEl.classList.add("hidden");
    postImagePreviewEl.innerHTML = "";
  }
  if (postImageInput) postImageInput.value = "";
}

/* ─────────────────── Post taslağını temizle ─────────────────── */

function clearPostDraft() {
  if (postText) postText.value = "";
  selectedPostImage = null;
  if (postImagePreviewEl) {
    postImagePreviewEl.classList.add("hidden");
    postImagePreviewEl.innerHTML = "";
  }
  if (postImageInput) postImageInput.value = "";
}
