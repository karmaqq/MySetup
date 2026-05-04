/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        POST SİSTEMİ — ANA MODÜL                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── DOM Referansları ─────────────────── */

const postText = document.getElementById("postText");
const postImageInput = document.getElementById("postImageInput");
const postImageBtn = document.getElementById("postImageBtn");
const publishPostBtn = document.getElementById("publishPostBtn");
const postImagePreviewEl = document.getElementById("postImagePreview");
const postsFeed = document.getElementById("postsFeed");

/* ─────────────────── Oturum İzolasyonu için Durum ─────────────────── */

let allPosts = {};
let selectedPostImage = null;
let _postsListenerActive = false;
let _postsQuery = null;

/* ─────────────────── Sayfalama Durumu ─────────────────── */

let _oldestLoadedKey = null;
let _hasMorePosts = false;
let _loadingMore = false;

/* ─────────────────── Profil Sekmesi Durumu ─────────────────── */

let _profileTab = null;
let _userPostsVisible = new Set();
let _userPostsOldestTs = null;
let _hasMoreUserPosts = false;
let _loadingMoreUserPosts = false;

let _likedPostsVisible = new Set();
let _likedPostsOldestTs = null;
let _hasMoreLikedPosts = false;
let _loadingMoreLikedPosts = false;

/* ─────────────────── Yorum Composer Durumu ─────────────────── */

let _composerTargetPostId = null;
let _composerReplyCommentId = null;
let _composerReplyUsername = null;

/* ══════════════════════════════════════════════════════════════════════════ */
/*                         POST SİSTEMİ BAŞLATMA                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Giriş yapıldığında çağrılır ─────────────────── */

function initPosts() {
  _teardownPosts();
  allPosts = {};
  _oldestLoadedKey = null;
  _hasMorePosts = false;
  _loadingMore = false;
  _composerTargetPostId = null;
  _composerReplyCommentId = null;
  _composerReplyUsername = null;

  if (postsFeed) postsFeed.innerHTML = "";
  _removeLoadMoreBtn();
  _startPostsListener();

  const user = firebase.auth().currentUser;
  if (user) {
    initUserLikesListener(user.uid, _onUserLikesChanged);
  }
}

/* ─────────────────── Çıkış yapıldığında çağrılır ─────────────────── */

function _teardownPosts() {
  if (_postsQuery) {
    _postsQuery.off();
    _postsQuery = null;
  }
  if (postsRef) postsRef.off();
  _postsListenerActive = false;
  allPosts = {};
  if (postsFeed) postsFeed.innerHTML = "";
  _removeLoadMoreBtn();

  Object.values(_commentListenerRefs).forEach(function (ref) { ref.off(); });
  for (var k in _commentListenerRefs) delete _commentListenerRefs[k];

  removeUserLikesListener();

  _loadingMoreUserPosts = false;
  _loadingMoreLikedPosts = false;
  _userPostsVisible = new Set();
  _likedPostsVisible = new Set();
  _userPostsOldestTs = null;
  _likedPostsOldestTs = null;
  _hasMoreUserPosts = false;
  _hasMoreLikedPosts = false;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         SAYFALAMA VE LISTENER                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İlk 20 postu yükler, listener başlatır ─────────────────── */

function _startPostsListener() {
  const ref = postsRef.orderByChild("createdAt");

  ref.limitToLast(PAGE_SIZE).once("value", function (snap) {
    if (window._isLoggingOut) return;

    const raw = snap.val() || {};
    const keys = Object.keys(raw).sort(function (a, b) {
      return (raw[b].createdAt || 0) - (raw[a].createdAt || 0);
    });

    keys.forEach(function (id) {
      allPosts[id] = raw[id];
    });

    if (keys.length > 0) {
      _oldestLoadedKey = keys[keys.length - 1];
    }

    if (postsFeed) postsFeed.innerHTML = "";
    keys.forEach(function (id) {
      _appendPostToFeed(id, raw[id]);
    });

    if (keys.length === 0) {
      _renderEmptyFeed();
    }

    _checkHasMorePosts(
      raw[_oldestLoadedKey] ? raw[_oldestLoadedKey].createdAt : null,
    );

    _listenForNewPosts(ref);
  });
}

/* ─────────────────── Veritabanında daha fazla post var mı kontrol eder ─────────────────── */

function _checkHasMorePosts(oldestTs) {
  if (!oldestTs) {
    _hasMorePosts = false;
    _removeLoadMoreBtn();
    return;
  }
  postsRef
    .orderByChild("createdAt")
    .endAt(oldestTs - 1)
    .limitToLast(1)
    .once("value", function (snap) {
      if (window._isLoggingOut) return;
      _hasMorePosts = snap.exists();
      if (_hasMorePosts) {
        _renderLoadMoreBtn();
      } else {
        _removeLoadMoreBtn();
      }
    });
}

/* ─────────────────── Yeni gelen postları gerçek zamanlı dinler ─────────────────── */

function _listenForNewPosts(ref) {
  if (_postsListenerActive) return;
  _postsListenerActive = true;

  const newestTs = _getNewestTimestamp();
  const liveQuery = ref.startAt(newestTs + 1, "createdAt");
  _postsQuery = liveQuery;

  liveQuery.on("child_added", function (s) {
    if (window._isLoggingOut) return;
    const id = s.key;
    const data = s.val();
    allPosts[id] = data;
    const empty = postsFeed && postsFeed.querySelector(".posts-empty");
    if (empty) empty.remove();
    _prependPostToFeed(id, data);
  });

  postsRef.on("child_changed", function (s) {
    if (window._isLoggingOut) return;
    const id = s.key;
    if (!allPosts[id]) return;
    const oldData = allPosts[id];
    allPosts[id] = s.val();
    if (_onlyLikesChanged(oldData, s.val())) {
      _patchPostLikes(id, s.val().likes);
    } else {
      _patchPostCard(id, s.val());
    }
  });

  postsRef.on("child_removed", function (s) {
    if (window._isLoggingOut) return;
    const id = s.key;
    delete allPosts[id];
    _softRemovePost(id);
  });
}

/* ─────────────────── En yeni yüklü postun timestamp'i ─────────────────── */

function _getNewestTimestamp() {
  let max = 0;
  Object.values(allPosts).forEach(function (p) {
    if ((p.createdAt || 0) > max) max = p.createdAt;
  });
  return max;
}

/* ─────────────────── Daha fazla post yükle (sayfalama) ─────────────────── */

function _loadMorePosts() {
  if (_loadingMore || !_hasMorePosts || !_oldestLoadedKey) return;
  _loadingMore = true;

  const btn = document.getElementById("loadMoreBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";
  }

  const oldestData = allPosts[_oldestLoadedKey];
  const oldestTs = oldestData ? oldestData.createdAt : null;
  if (!oldestTs) {
    _loadingMore = false;
    return;
  }

  postsRef
    .orderByChild("createdAt")
    .endAt(oldestTs - 1)
    .limitToLast(PAGE_SIZE)
    .once("value", function (snap) {
      if (window._isLoggingOut) return;

      const raw = snap.val() || {};
      const keys = Object.keys(raw).sort(function (a, b) {
        return (raw[b].createdAt || 0) - (raw[a].createdAt || 0);
      });

      keys.forEach(function (id) {
        allPosts[id] = raw[id];
        _appendPostToFeed(id, raw[id]);
      });

      if (keys.length > 0) {
        _oldestLoadedKey = keys[keys.length - 1];
        const newOldestTs = raw[_oldestLoadedKey].createdAt;
        _checkHasMorePosts(newOldestTs);
      } else {
        _hasMorePosts = false;
        _removeLoadMoreBtn();
      }

      _loadingMore = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Daha Fazla Göster";
      }
    });
}

/* ─────────────────── Daha fazla yükle butonunu render eder ─────────────────── */

function _renderLoadMoreBtn() {
  if (document.getElementById("loadMoreBtn")) return;
  const btn = document.createElement("button");
  btn.id = "loadMoreBtn";
  btn.className = "load-more-btn";
  btn.textContent = "Daha Fazla Göster";
  btn.onclick = _loadMorePosts;
  postsFeed &&
    postsFeed.parentNode &&
    postsFeed.parentNode.insertBefore(btn, postsFeed.nextSibling);
}

function _removeLoadMoreBtn() {
  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.remove();
}

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
      '<div style="position:relative;display:inline-block;">' +
      '<img src="' +
      ev.target.result +
      '" style="max-width:100%;max-height:200px;border-radius:8px;" />' +
      '<button class="remove-post-image-btn" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:13px;">✕</button>' +
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
