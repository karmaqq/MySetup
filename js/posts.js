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

const PAGE_SIZE = 20;
let _oldestLoadedKey = null;
let _hasMorePosts = false;
let _loadingMore = false;

/* ─────────────────── Profil Sekmesi Durumu ─────────────────── */

let _profileTab = null;
let _userPostsVisible = [];
let _userPostsOldestTs = null;
let _hasMoreUserPosts = false;
let _loadingMoreUserPosts = false;

let _likedPostsVisible = [];
let _likedPostsOldestTs = null;
let _hasMoreLikedPosts = false;
let _loadingMoreLikedPosts = false;

/* ─────────────────── Yorum Composer Durumu ─────────────────── */

let _composerTargetPostId = null;
let _composerReplyCommentId = null;
let _composerReplyUsername = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
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
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         SAYFALAMA VE LISTENER                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İlk 20 postu yükler, listener başlatır ─────────────────── */

function _startPostsListener() {
  const ref = postsRef.orderByChild("createdAt");

  // 1. Önce ilk PAGE_SIZE postu çek (en yeniler)
  ref.limitToLast(PAGE_SIZE).once("value", function (snap) {
    if (window._isLoggingOut) return;

    const raw = snap.val() || {};
    const keys = Object.keys(raw).sort(function (a, b) {
      return (raw[b].createdAt || 0) - (raw[a].createdAt || 0);
    });

    keys.forEach(function (id) {
      allPosts[id] = raw[id];
    });

    // En eski yüklenenin anahtarı sayfalama için
    if (keys.length > 0) {
      _oldestLoadedKey = keys[keys.length - 1];
    }

    // Feed'i en yeniden eskiye doğru çiz
    if (postsFeed) postsFeed.innerHTML = "";
    keys.forEach(function (id) {
      _appendPostToFeed(id, raw[id]);
    });

    if (keys.length === 0) {
      _renderEmptyFeed();
    }

    // 2. Toplam post sayısını kontrol et — daha fazlası var mı?
    _checkHasMorePosts(
      raw[_oldestLoadedKey] ? raw[_oldestLoadedKey].createdAt : null,
    );

    // 3. Gerçek zamanlı listener — sadece yeni gelenleri dinle
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

  // child_added: sadece sayfadan sonra gelen yeniler
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

  // child_changed: beğeni ve yorum sayısı güncellemeleri
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

  // child_removed: silinen postları kaldır
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            POST RENDER                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post kartı HTML döndürür ─────────────────── */

function _renderPostHTML(postId, postData) {
  const user = firebase.auth().currentUser;
  const isOwn = user && user.uid === postData.uid;
  const liked = postData.likes && user && postData.likes[user.uid];
  const likeCount = postData.likes ? Object.keys(postData.likes).length : 0;
  const commentCount = postData.comments
    ? Object.keys(postData.comments).length
    : 0;
  const timeText = formatTimeAgo(postData.createdAt, postData.phraseIndex);
  const pid = escAttr(postId);

  let html = '<div class="post-card" data-post-id="' + pid + '">';

  html += '<div class="post-header">';
  html +=
    '<div class="post-avatar">' +
    _avatarHTML(postData.username, postData.avatarUrl, 40) +
    "</div>";
  html += '<div class="post-user-info">';
  html +=
    '<span class="post-username">' +
    escHtml(postData.username || "Kullanici") +
    "</span>";
  html += '<span class="post-time">' + escHtml(timeText) + "</span>";
  html += "</div>";

  if (isOwn) {
    html +=
      '<button class="post-menu-btn" data-action="post-menu" data-id="' +
      pid +
      '">⋮</button>';
    html += '<div class="post-dropdown" id="postDropdown-' + pid + '">';
    html +=
      '<button class="post-dropdown-item delete" data-action="delete-post" data-id="' +
      pid +
      '">';
    html +=
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Sil</button>';
    html += "</div>";
  }
  html += "</div>";

  html += '<div class="post-content">';
  if (postData.content)
    html += '<div class="post-text">' + escHtml(postData.content) + "</div>";
  if (postData.imageUrl) {
    html +=
      '<div class="post-image"><img src="' +
      escAttr(postData.imageUrl) +
      "\" alt=\"\" onload=\"var r=this.naturalWidth/this.naturalHeight;var p=this.parentElement;p.classList.toggle('landscape',r>1.2);p.classList.toggle('portrait',r<0.8);p.classList.toggle('square',r>=0.8&&r<=1.2)\" /></div>";
  }
  html += "</div>";

  html += '<div class="post-actions">';
  html +=
    '<button class="post-action-btn like-btn' +
    (liked ? " liked" : "") +
    '" data-action="like-post" data-id="' +
    pid +
    '">';
  html +=
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="' +
    (liked ? "currentColor" : "none") +
    '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  html += " " + likeCount + "</button>";
  html +=
    '<button class="post-action-btn comment-btn" data-action="toggle-comments" data-id="' +
    pid +
    '">';
  html +=
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  html +=
    ' <span class="comment-count-' +
    pid +
    '">' +
    commentCount +
    "</span></button>";
  html +=
    '<span class="post-date">' +
    escHtml(formatDateTime(postData.createdAt)) +
    "</span>";
  html += "</div>";

  html += '<div class="comment-section" id="commentSection-' + pid + '">';
  html += _renderCommentComposerHTML(postId);
  html += '<div class="comment-list" id="commentList-' + pid + '">';
  if (postData.comments) {
    const sorted = Object.keys(postData.comments).sort(function (a, b) {
      return (
        (postData.comments[a].createdAt || 0) -
        (postData.comments[b].createdAt || 0)
      );
    });
    sorted.forEach(function (cid) {
      html += _renderCommentThreadHTML(postId, cid, postData.comments[cid]);
    });
  }
  html += "</div></div>";

  html += "</div>";
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      YORUM COMPOSER HTML                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ortak yorum/yanıt giriş alanı HTML ─────────────────── */

function _renderCommentComposerHTML(postId) {
  const user = firebase.auth().currentUser;
  const pid = escAttr(postId);

  let html = '<div class="comment-composer" id="commentComposer-' + pid + '">';
  html += '<div class="comment-composer-avatar">';
  html += _avatarHTML(
    user ? user.displayName || "" : "",
    user ? user.photoURL || "" : "",
    32,
  );
  html += "</div>";
  html += '<div class="comment-composer-right">';
  html += '<div class="comment-reply-target" id="replyTarget-' + pid + '">';
  html += '<span id="replyTargetText-' + pid + '"></span>';
  html +=
    '<button class="comment-reply-target-cancel" data-action="cancel-reply" data-id="' +
    pid +
    '">✕</button>';
  html += "</div>";
  html += '<div class="comment-input-row">';
  html +=
    '<textarea class="comment-input-field" id="commentInput-' +
    pid +
    '" placeholder="Yorum yaz..." maxlength="500" rows="1"></textarea>';
  html +=
    '<button class="comment-send-btn" data-action="submit-comment" data-id="' +
    pid +
    '">Gönder</button>';
  html += "</div></div></div>";

  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       YORUM THREAD HTML                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum + yanıtları kapsayan blok HTML ─────────────────── */

function _renderCommentThreadHTML(postId, commentId, commentData) {
  const pid = escAttr(postId);
  const cid = escAttr(commentId);
  const user = firebase.auth().currentUser;
  const isOwn = user && user.uid === commentData.uid;
  const liked = user && commentData.likes && commentData.likes[user.uid];
  const likeCount = commentData.likes
    ? Object.keys(commentData.likes).length
    : 0;
  const replyCount = commentData.replies
    ? Object.keys(commentData.replies).length
    : 0;
  const timeAgo = commentData.createdAt
    ? formatTimeAgo(commentData.createdAt, undefined, true)
    : "";

  let html =
    '<div class="comment-thread" id="commentThread-' + pid + "-" + cid + '">';

  html += '<div class="comment-item" data-comment-id="' + cid + '">';
  html += '<div class="comment-avatar-col">';
  html +=
    '<div class="comment-avatar">' +
    _avatarHTML(commentData.username || "", commentData.avatarUrl || "", 32) +
    "</div>";
  html += "</div>";
  html += '<div class="comment-body">';
  html += '<div class="comment-meta">';
  html +=
    '<span class="comment-username">' +
    escHtml(commentData.username || "Kullanici") +
    "</span>";
  html += '<span class="comment-time">' + escHtml(timeAgo) + "</span>";
  if (isOwn) {
    html +=
      '<button class="comment-menu-btn" data-action="comment-menu" data-post-id="' +
      pid +
      '" data-comment-id="' +
      cid +
      '">⋮</button>';
    html +=
      '<div class="comment-dropdown" id="commentDropdown-' +
      pid +
      "-" +
      cid +
      '">';
    html +=
      '<button class="comment-dropdown-item delete" data-action="delete-comment" data-post-id="' +
      pid +
      '" data-comment-id="' +
      cid +
      '">';
    html +=
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Sil</button>';
    html += "</div>";
  }
  html += "</div>";
  html +=
    '<div class="comment-text">' + escHtml(commentData.text || "") + "</div>";
  html += '<div class="comment-actions">';
  html +=
    '<button class="comment-action-btn' +
    (liked ? " liked" : "") +
    '" data-action="like-comment" data-post-id="' +
    pid +
    '" data-comment-id="' +
    cid +
    '">';
  html +=
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="' +
    (liked ? "currentColor" : "none") +
    '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  html +=
    ' <span class="like-count-c-' + cid + '">' + likeCount + "</span></button>";
  html +=
    '<button class="comment-action-btn reply-btn" data-action="start-reply" data-post-id="' +
    pid +
    '" data-comment-id="' +
    cid +
    '" data-username="' +
    escAttr(commentData.username || "Kullanici") +
    '">';
  html +=
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 10 20 15 15 20"/><path d="M17 15H3.5a2.5 2.5 0 0 1 0-5h.5"/><line x1="13" y1="5" x2="18" y2="5"/><line x1="15" y1="1" x2="15" y2="9"/></svg>' +
    '<span class="reply-count-' +
    cid +
    '">' +
    replyCount +
    "</span></button>";
  if (replyCount > 0) {
    html +=
      '<button class="toggle-replies-btn" id="toggleReplies-' +
      pid +
      "-" +
      cid +
      '" data-action="toggle-replies" data-post-id="' +
      pid +
      '" data-comment-id="' +
      cid +
      '">';
    html += "yanıtları gör</button>";
  }
  html += "</div>";
  html += "</div></div>";

  html +=
    '<div class="replies-section hidden" id="replies-' + pid + "-" + cid + '">';
  if (commentData.replies) {
    const sortedReplies = Object.keys(commentData.replies).sort(
      function (a, b) {
        return (
          (commentData.replies[a].createdAt || 0) -
          (commentData.replies[b].createdAt || 0)
        );
      },
    );
    sortedReplies.forEach(function (rid) {
      html += _renderReplyHTML(
        postId,
        commentId,
        rid,
        commentData.replies[rid],
      );
    });
  }
  html += "</div>";

  html += "</div>";
  return html;
}

/* ─────────────────── Tek yanıt satırı HTML ─────────────────── */

function _renderReplyHTML(postId, commentId, replyId, replyData) {
  const pid = escAttr(postId);
  const cid = escAttr(commentId);
  const rid = escAttr(replyId);
  const user = firebase.auth().currentUser;
  const isOwn = user && user.uid === replyData.uid;
  const liked = user && replyData.likes && replyData.likes[user.uid];
  const likeCount = replyData.likes ? Object.keys(replyData.likes).length : 0;
  const timeAgo = replyData.createdAt
    ? formatTimeAgo(replyData.createdAt, undefined, true)
    : "";

  let html = '<div class="reply-item" data-reply-id="' + rid + '">';
  html +=
    '<div class="reply-avatar">' +
    _avatarHTML(replyData.username || "", replyData.avatarUrl || "", 26) +
    "</div>";
  html += '<div class="reply-body">';
  html += '<div class="reply-meta">';
  html +=
    '<span class="reply-username">' +
    escHtml(replyData.username || "Kullanici") +
    "</span>";
  html += '<span class="reply-time">' + escHtml(timeAgo) + "</span>";
  if (isOwn) {
    html +=
      '<button class="comment-menu-btn" data-action="reply-menu" data-post-id="' +
      pid +
      '" data-comment-id="' +
      cid +
      '" data-reply-id="' +
      rid +
      '">⋮</button>';
    html +=
      '<div class="comment-dropdown" id="replyDropdown-' + pid + "-" + cid + "-" + rid + '">';
    html +=
      '<button class="comment-dropdown-item delete" data-action="delete-reply" data-post-id="' +
      pid +
      '" data-comment-id="' +
      cid +
      '" data-reply-id="' +
      rid +
      '">';
    html +=
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Sil</button>';
    html += "</div>";
  }
  html += "</div>";
  html += '<div class="reply-text">' + escHtml(replyData.text || "") + "</div>";
  html += '<div class="reply-actions">';
  html +=
    '<button class="comment-action-btn' +
    (liked ? " liked" : "") +
    '" data-action="like-reply" data-post-id="' +
    pid +
    '" data-comment-id="' +
    cid +
    '" data-reply-id="' +
    rid +
    '">';
  html +=
    '<svg viewBox="0 0 24 24" width="11" height="11" fill="' +
    (liked ? "currentColor" : "none") +
    '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  html += " <span>" + likeCount + "</span></button>";
  html += "</div>";
  html += "</div></div>";
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AVATAR YARDIMCISI                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kullanıcı adının baş harfini avatar olarak döndürür ─────────────────── */

function _avatarHTML(username, avatarUrl, size) {
  if (avatarUrl) {
    return (
      '<img src="' +
      escAttr(avatarUrl) +
      '" alt="" width="' +
      size +
      '" height="' +
      size +
      '" />'
    );
  }
  const letter = (username || "?").charAt(0).toUpperCase();
  return escHtml(letter);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        FEED DOM İŞLEMLERİ                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Feed'in en başına yeni post ekler (animasyonlu) ─────────────────── */

function _prependPostToFeed(postId, postData) {
  if (!postsFeed) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderPostHTML(postId, postData);
  const el = wrapper.firstElementChild;
  el.style.opacity = "0";
  el.style.transform = "translateY(-8px)";
  el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  postsFeed.insertBefore(el, postsFeed.firstChild);
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

/* ─────────────────── Feed'in sonuna post ekler (daha fazla yükle) ─────────────────── */

function _appendPostToFeed(postId, postData) {
  if (!postsFeed) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderPostHTML(postId, postData);
  const el = wrapper.firstElementChild;
  postsFeed.appendChild(el);
}

/* ─────────────────── Mevcut kart varsa yerinde günceller ─────────────────── */

function _patchPostCard(postId, postData) {
  const el =
    postsFeed && postsFeed.querySelector('[data-post-id="' + postId + '"]');
  if (!el) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderPostHTML(postId, postData);
  const newEl = wrapper.firstElementChild;
  const oldSection = el.querySelector(".comment-section");
  const wasOpen = oldSection && oldSection.classList.contains("visible");
  el.replaceWith(newEl);
  if (wasOpen) {
    const newSection = newEl.querySelector(".comment-section");
    if (newSection) newSection.classList.add("visible");
    const btn = newEl.querySelector(".comment-btn");
    if (btn) btn.classList.add("active");
  }
}

/* ─────────────────── Sadece beğeni sayacını günceller ─────────────────── */

function _patchPostLikes(postId, likes) {
  const user = firebase.auth().currentUser;
  const likeCount = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const cards = document.querySelectorAll('[data-post-id="' + postId + '"]');
  cards.forEach(function (card) {
    const btn = card.querySelector('[data-action="like-post"]');
    if (!btn) return;
    btn.classList.toggle("liked", !!liked);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
    const txt = Array.from(btn.childNodes).filter(function (n) {
      return n.nodeType === 3;
    });
    if (txt.length) txt[txt.length - 1].textContent = " " + likeCount;
  });
}

/* ─────────────────── Postu animasyonla kaldırır ─────────────────── */

function _softRemovePost(postId) {
  document
    .querySelectorAll('[data-post-id="' + postId + '"]')
    .forEach(function (el) {
      el.style.transition = "opacity 0.3s, transform 0.3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      setTimeout(function () {
        el.remove();
      }, 320);
    });
  if (postsFeed && postsFeed.children.length === 0) _renderEmptyFeed();
}

/* ─────────────────── Boş feed mesajı ─────────────────── */

function _renderEmptyFeed() {
  if (!postsFeed) return;
  postsFeed.innerHTML =
    '<div class="posts-empty">Henüz gönderi yok. İlk gönderiyi sen yap!</div>';
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM / YANIT GÖNDERİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Composer'daki mesajı gönderir ─────────────────── */

function _submitComposer(postId) {
  const input = document.getElementById("commentInput-" + postId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  const baseData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    avatarUrl: user.photoURL || "",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  const isReply = _composerTargetPostId === postId && _composerReplyCommentId;

  if (isReply) {
    addReplyToFirebase(postId, _composerReplyCommentId, baseData)
      .then(function () {
        input.value = "";
        _cancelReplyMode(postId);
        showToast("Yanıt eklendi", "success");
        /* Yanıtlar açık değilse aç */
        _openRepliesSection(postId, _composerReplyCommentId);
      })
      .catch(function () {
        showToast("Yanıt eklenemedi", "error");
      });
  } else {
    addCommentToFirebase(postId, baseData)
      .then(function () {
        input.value = "";
        showToast("Yorum eklendi", "success");
      })
      .catch(function () {
        showToast("Yorum eklenemedi", "error");
      });
  }
}

/* ─────────────────── Yanıt modunu başlatır ─────────────────── */

function _startReplyMode(postId, commentId, username) {
  _composerTargetPostId = postId;
  _composerReplyCommentId = commentId;
  _composerReplyUsername = username;

  const target = document.getElementById("replyTarget-" + postId);
  const targetText = document.getElementById("replyTargetText-" + postId);
  if (target && targetText) {
    targetText.textContent = "@" + username + " yanıtlanıyor";
    target.classList.add("visible");
  }

  const input = document.getElementById("commentInput-" + postId);
  if (input) {
    input.placeholder = "@" + username + " kişisine yanıtla...";
    input.focus();
  }
}

/* ─────────────────── Yanıt modunu iptal eder ─────────────────── */

function _cancelReplyMode(postId) {
  _composerTargetPostId = null;
  _composerReplyCommentId = null;
  _composerReplyUsername = null;

  const target = document.getElementById("replyTarget-" + postId);
  if (target) target.classList.remove("visible");

  const input = document.getElementById("commentInput-" + postId);
  if (input) input.placeholder = "Yorum yaz...";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         YORUM BÖLÜMÜ AÇ / KAPAT                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum bölümünü toggle eder ─────────────────── */

function _toggleCommentSection(postId) {
  const section = document.getElementById("commentSection-" + postId);
  const btn = document.querySelector(
    '[data-action="toggle-comments"][data-id="' + postId + '"]',
  );
  if (!section) return;
  const isOpen = section.classList.contains("visible");
  section.classList.toggle("visible");
  if (btn) btn.classList.toggle("active", !isOpen);

  if (!isOpen && !section.dataset.listenerInit) {
    section.dataset.listenerInit = "true";
    _initCommentListener(postId);
  }

  if (!isOpen) {
    const input = document.getElementById("commentInput-" + postId);
    if (input)
      setTimeout(function () {
        input.focus();
      }, 80);
  }
}

/* ─────────────────── Yanıtlar bölümünü aç/kapat ─────────────────── */

function _openRepliesSection(postId, commentId) {
  const sec = document.getElementById("replies-" + postId + "-" + commentId);
  const btn = document.getElementById(
    "toggleReplies-" + postId + "-" + commentId,
  );
  if (!sec || !btn) return;

  const isOpen = !sec.classList.contains("hidden");
  sec.classList.toggle("hidden");

  if (isOpen) {
    btn.textContent = "yanıtları gör";
  } else {
    btn.textContent = "yanıtları gizle";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    GERÇEK ZAMANLI YORUM LİSTENER                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum bölümü açıldığında Firebase'i dinler ─────────────────── */

function _initCommentListener(postId) {
  const ref = postsRef
    .child(postId)
    .child("comments")
    .orderByChild("createdAt");

  ref.on("child_added", function (s) {
    if (window._isLoggingOut) return;
    const cid = s.key;
    const data = s.val();
    const post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    if (post.comments[cid]) return;
    post.comments[cid] = data;

    const list = document.getElementById("commentList-" + postId);
    if (!list) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = _renderCommentThreadHTML(postId, cid, data);
    list.appendChild(wrapper.firstElementChild);
    _updateCommentCount(postId);
  });

  ref.on("child_changed", function (s) {
    if (window._isLoggingOut) return;
    const cid = s.key;
    const data = s.val();
    const post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    post.comments[cid] = data;
    /* Sadece beğeni değişti mi? */
    const thread = document.getElementById(
      "commentThread-" + postId + "-" + cid,
    );
    if (!thread) return;
    _refreshCommentThread(postId, cid, data, thread);
  });

  ref.on("child_removed", function (s) {
    if (window._isLoggingOut) return;
    const cid = s.key;
    const post = allPosts[postId];
    if (post && post.comments) delete post.comments[cid];
    const thread = document.getElementById(
      "commentThread-" + postId + "-" + cid,
    );
    if (thread) thread.remove();
    _updateCommentCount(postId);
  });
}

/* ─────────────────── Yorum thread'ini günceller ─────────────────── */

function _refreshCommentThread(postId, commentId, commentData, existingEl) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderCommentThreadHTML(postId, commentId, commentData);
  const newEl = wrapper.firstElementChild;
  const repliesSec = existingEl.querySelector(".replies-section");
  const wasOpen = repliesSec && !repliesSec.classList.contains("hidden");
  existingEl.replaceWith(newEl);
  if (wasOpen) {
    const newRepliesSec = newEl.querySelector(".replies-section");
    if (newRepliesSec) newRepliesSec.classList.remove("hidden");
    const btn = newEl.querySelector(".toggle-replies-btn");
    if (btn) {
      btn.style.display = "inline-flex";
      btn.textContent = "yanıtları gizle";
    }
  }
}

/* ─────────────────── Yorum sayısını günceller ─────────────────── */

function _updateCommentCount(postId) {
  const post = allPosts[postId];
  const count = post && post.comments ? Object.keys(post.comments).length : 0;
  const spans = document.querySelectorAll(".comment-count-" + postId);
  spans.forEach(function (s) {
    s.textContent = count;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            BEĞENİ İŞLEMLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post beğeni toggle ─────────────────── */

function _togglePostLike(postId) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  togglePostLike(postId, user.uid).catch(function () {
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yorum beğeni toggle (optimistic) ─────────────────── */

function _toggleCommentLike(postId, commentId) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const post = allPosts[postId];
  if (!post || !post.comments || !post.comments[commentId]) return;

  const comment = post.comments[commentId];
  if (!comment.likes) comment.likes = {};
  const had = !!comment.likes[user.uid];
  if (had) {
    delete comment.likes[user.uid];
  } else {
    comment.likes[user.uid] = true;
  }

  _patchCommentLikeBtn(postId, commentId, comment.likes);

  toggleCommentLike(postId, commentId, user.uid).catch(function () {
    /* Geri al */
    if (had) {
      comment.likes[user.uid] = true;
    } else {
      delete comment.likes[user.uid];
    }
    _patchCommentLikeBtn(postId, commentId, comment.likes);
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yanıt beğeni toggle (optimistic) ─────────────────── */

function _toggleReplyLike(postId, commentId, replyId) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const post = allPosts[postId];
  if (!post || !post.comments || !post.comments[commentId]) return;
  const replies = post.comments[commentId].replies;
  if (!replies || !replies[replyId]) return;

  const reply = replies[replyId];
  if (!reply.likes) reply.likes = {};
  const had = !!reply.likes[user.uid];
  if (had) {
    delete reply.likes[user.uid];
  } else {
    reply.likes[user.uid] = true;
  }

  _patchReplyLikeBtn(postId, commentId, replyId, reply.likes);

  toggleReplyLike(postId, commentId, replyId, user.uid).catch(function () {
    if (had) {
      reply.likes[user.uid] = true;
    } else {
      delete reply.likes[user.uid];
    }
    _patchReplyLikeBtn(postId, commentId, replyId, reply.likes);
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yorum beğeni butonunu DOM'da günceller ─────────────────── */

function _patchCommentLikeBtn(postId, commentId, likes) {
  const user = firebase.auth().currentUser;
  const count = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const btn = document.querySelector(
    '[data-action="like-comment"][data-post-id="' +
      postId +
      '"][data-comment-id="' +
      commentId +
      '"]',
  );
  if (!btn) return;
  btn.classList.toggle("liked", !!liked);
  const svg = btn.querySelector("svg");
  if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
  const span = btn.querySelector(".like-count-c-" + commentId);
  if (span) span.textContent = count;
}

/* ─────────────────── Yanıt beğeni butonunu DOM'da günceller ─────────────────── */

function _patchReplyLikeBtn(postId, commentId, replyId, likes) {
  const user = firebase.auth().currentUser;
  const count = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const btn = document.querySelector(
    '[data-action="like-reply"][data-post-id="' +
      postId +
      '"][data-comment-id="' +
      commentId +
      '"][data-reply-id="' +
      replyId +
      '"]',
  );
  if (!btn) return;
  btn.classList.toggle("liked", !!liked);
  const svg = btn.querySelector("svg");
  if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
  const span = btn.querySelector("span");
  if (span) span.textContent = count;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           SİLME İŞLEMLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post silme onayı ─────────────────── */

function _confirmDeletePost(postId) {
  showConfirm("Bu gönderiyi silmek istediğine emin misin?", function () {
    deletePostFromFirebase(postId)
      .then(function () {
        showToast("Gönderi silindi.", "success");
      })
      .catch(function () {
        showToast("Gönderi silinemedi.", "error");
      });
  });
}

/* ─────────────────── Yorum silme onayı ─────────────────── */

function _confirmDeleteComment(postId, commentId) {
  showConfirm("Yorum silinsin mi?", function () {
    deleteCommentFromFirebase(postId, commentId)
      .then(function () {
        showToast("Yorum silindi.", "success");
      })
      .catch(function () {
        showToast("Yorum silinemedi.", "error");
      });
  });
}

/* ─────────────────── Yanıt silme onayı ─────────────────── */

function _confirmDeleteReply(postId, commentId, replyId) {
  showConfirm("Yanıt silinsin mi?", function () {
    deleteReplyFromFirebase(postId, commentId, replyId)
      .then(function () {
        showToast("Yanıt silindi.", "success");
      })
      .catch(function () {
        showToast("Yanıt silinemedi.", "error");
      });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      SADECE BEĞENİ DEĞERLENDIRME                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İçerik değişmeden sadece beğeni farkı var mı ─────────────────── */

function _onlyLikesChanged(oldPost, newPost) {
  const fields = [
    "content",
    "imageUrl",
    "username",
    "uid",
    "createdAt",
    "comments",
  ];
  for (let i = 0; i < fields.length; i++) {
    if (
      JSON.stringify(oldPost[fields[i]]) !== JSON.stringify(newPost[fields[i]])
    )
      return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         OLAY DİNLEYİCİLERİ KURULUMU                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post oluşturma butonları ─────────────────── */

if (publishPostBtn) publishPostBtn.addEventListener("click", createPost);
if (postImageBtn)
  postImageBtn.addEventListener("click", function () {
    if (postImageInput) postImageInput.click();
  });
if (postImageInput)
  postImageInput.addEventListener("change", _handlePostImageSelect);

/* ─────────────────── Tek delegasyon noktası: tüm post/yorum eylemleri ─────────────────── */

document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-action]");

  const action = btn ? btn.dataset.action : null;

  if (btn && e.target.closest(".remove-post-image-btn")) {
    _removePostImage();
    return;
  }

  /* Hiçbir aksiyon butonu yoksa tüm dropdownları kapat */
  if (!btn) {
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    return;
  }

  /* Menü butonları dışındaki tıklamalarda dropdownları kapat */
  if (
    !btn.closest(".post-dropdown") &&
    !btn.closest(".post-menu-btn") &&
    !btn.closest(".comment-dropdown") &&
    !btn.closest(".comment-menu-btn")
  ) {
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
  }

  if (action === "post-menu") {
    const id = btn.dataset.id;
    const dd = document.getElementById("postDropdown-" + id);
    const wasActive = dd && dd.classList.contains("active");
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    if (dd && !wasActive) dd.classList.add("active");
    return;
  }

  if (action === "comment-menu") {
    const pid = btn.dataset.postId;
    const cid = btn.dataset.commentId;
    const dd = document.getElementById("commentDropdown-" + pid + "-" + cid);
    const wasActive = dd && dd.classList.contains("active");
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    if (dd && !wasActive) dd.classList.add("active");
    return;
  }

  if (action === "reply-menu") {
    const pid = btn.dataset.postId;
    const cid = btn.dataset.commentId;
    const rid = btn.dataset.replyId;
    const dd = document.getElementById("replyDropdown-" + pid + "-" + cid + "-" + rid);
    const wasActive = dd && dd.classList.contains("active");
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    if (dd && !wasActive) dd.classList.add("active");
    return;
  }

  if (action === "delete-post") {
    _confirmDeletePost(btn.dataset.id);
    return;
  }

  if (action === "like-post") {
    _togglePostLike(btn.dataset.id);
    return;
  }

  if (action === "toggle-comments") {
    _toggleCommentSection(btn.dataset.id);
    return;
  }

  if (action === "submit-comment") {
    _submitComposer(btn.dataset.id);
    return;
  }

  if (action === "cancel-reply") {
    _cancelReplyMode(btn.dataset.id);
    return;
  }

  if (action === "start-reply") {
    _startReplyMode(
      btn.dataset.postId,
      btn.dataset.commentId,
      btn.dataset.username,
    );
    return;
  }

  if (action === "toggle-replies") {
    _openRepliesSection(btn.dataset.postId, btn.dataset.commentId);
    return;
  }

  if (action === "like-comment") {
    _toggleCommentLike(btn.dataset.postId, btn.dataset.commentId);
    return;
  }

  if (action === "delete-comment") {
    _confirmDeleteComment(btn.dataset.postId, btn.dataset.commentId);
    return;
  }

  if (action === "like-reply") {
    _toggleReplyLike(
      btn.dataset.postId,
      btn.dataset.commentId,
      btn.dataset.replyId,
    );
    return;
  }

  if (action === "delete-reply") {
    _confirmDeleteReply(
      btn.dataset.postId,
      btn.dataset.commentId,
      btn.dataset.replyId,
    );
    return;
  }
});

/* ─────────────────── Textarea Enter ile gönder ─────────────────── */

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" || e.shiftKey) return;
  const target = e.target;
  if (!target.classList.contains("comment-input-field")) return;
  const postId = target.id.replace("commentInput-", "");
  if (!postId) return;
  e.preventDefault();
  _submitComposer(postId);
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           ZAMAN GÜNCELLEMESİ                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Her dakika zaman etiketlerini günceller ─────────────────── */

setInterval(function () {
  document.querySelectorAll(".post-time").forEach(function (el) {
    const card = el.closest("[data-post-id]");
    if (!card) return;
    const post = allPosts[card.dataset.postId];
    if (!post) return;
    el.textContent = formatTimeAgo(post.createdAt, post.phraseIndex);
  });

  document.querySelectorAll(".comment-time").forEach(function (el) {
    const item = el.closest("[data-comment-id]");
    const card = el.closest("[data-post-id]");
    if (!item || !card) return;
    const post = allPosts[card.dataset.postId];
    const cid = item.dataset.commentId;
    if (!post || !post.comments || !post.comments[cid]) return;
    el.textContent = formatTimeAgo(
      post.comments[cid].createdAt,
      undefined,
      true,
    );
  });

  document.querySelectorAll(".reply-time").forEach(function (el) {
    const replyEl = el.closest("[data-reply-id]");
    const commentEl = el.closest("[data-comment-id]");
    const card = el.closest("[data-post-id]");
    if (!replyEl || !commentEl || !card) return;
    const post = allPosts[card.dataset.postId];
    const cid = commentEl.dataset.commentId;
    const rid = replyEl.dataset.replyId;
    if (!post || !post.comments || !post.comments[cid]) return;
    const replies = post.comments[cid].replies;
    if (!replies || !replies[rid]) return;
    el.textContent = formatTimeAgo(replies[rid].createdAt, undefined, true);
  });
}, 60 * 1000);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL SEKMESİ YÜKLEME                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Profil sekmesi değiştiğinde çağrılır ─────────────────── */

function updateProfilePosts() {
  switchProfileTab("user-posts");
}

function switchProfileTab(tabName) {
  _profileTab = tabName;
  const userPostsTab = document.getElementById("userPostsTab");
  const likedPostsTab = document.getElementById("likedPostsTab");

  if (tabName === "user-posts") {
    _initUserPostsTab();
  } else if (tabName === "liked-posts") {
    _initLikedPostsTab();
  }
}

/* ─────────────────── Gönderilerim sekmesini başlatır ─────────────────── */

function _initUserPostsTab() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const tab = document.getElementById("userPostsTab");
  if (!tab) return;

  tab.innerHTML = "";
  _userPostsVisible = [];
  _userPostsOldestTs = null;
  _hasMoreUserPosts = false;
  _loadingMoreUserPosts = false;
  _removeProfileLoadMoreBtn("userPostsTab");

  _loadUserPostsChunk();
}

/* ─────────────────── Beğenilerim sekmesini başlatır ─────────────────── */

function _initLikedPostsTab() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const tab = document.getElementById("likedPostsTab");
  if (!tab) return;

  tab.innerHTML = "";
  _likedPostsVisible = [];
  _likedPostsOldestTs = null;
  _hasMoreLikedPosts = false;
  _loadingMoreLikedPosts = false;
  _removeProfileLoadMoreBtn("likedPostsTab");

  _loadLikedPostsChunk();
}

/* ─────────────────── Gönderilerim: ilk 20 veya sonraki 20 ─────────────────── */

function _loadUserPostsChunk() {
  if (_loadingMoreUserPosts) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  _loadingMoreUserPosts = true;
  const tab = document.getElementById("userPostsTab");
  const btn = document.getElementById("loadMoreUserPostsBtn");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";
  }

  getUserPostsOnce(user.uid, PAGE_SIZE, _userPostsOldestTs)
    .then(function (map) {
      const ids = Object.keys(map).sort(function (a, b) {
        return map[b] - map[a];
      });

      if (ids.length === 0) {
        if (_userPostsVisible.length === 0 && tab) {
          tab.innerHTML =
            '<div class="posts-empty">Henüz gönderin yok.</div>';
        }
        _hasMoreUserPosts = false;
        _removeProfileLoadMoreBtn("userPostsTab");
        _loadingMoreUserPosts = false;
        return;
      }

      const postIds = ids
        .filter(function (id) {
          return !_userPostsVisible.includes(id);
        })
        .slice(0, PAGE_SIZE);

      return getPostsByIds(postIds).then(function (posts) {
        postIds.forEach(function (id) {
          if (posts[id]) {
            allPosts[id] = posts[id];
            _userPostsVisible.push(id);
            if (tab) {
              const wrapper = document.createElement("div");
              wrapper.innerHTML = _renderPostHTML(id, posts[id]);
              tab.appendChild(wrapper.firstElementChild);
            }
          }
        });

        if (ids.length >= PAGE_SIZE) {
          _userPostsOldestTs = map[ids[ids.length - 1]];
          _hasMoreUserPosts = true;
          _renderProfileLoadMoreBtn("userPostsTab", _loadUserPostsChunk);
        } else {
          _hasMoreUserPosts = false;
          _removeProfileLoadMoreBtn("userPostsTab");
        }

        _loadingMoreUserPosts = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Daha Fazla Göster";
        }
      });
    })
    .catch(function () {
      _loadingMoreUserPosts = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Daha Fazla Göster";
      }
    });
}

/* ─────────────────── Beğenilerim: ilk 20 veya sonraki 20 ─────────────────── */

function _loadLikedPostsChunk() {
  if (_loadingMoreLikedPosts) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  _loadingMoreLikedPosts = true;
  const tab = document.getElementById("likedPostsTab");
  const btn = document.getElementById("loadMoreLikedPostsBtn");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";
  }

  getUserLikesOnce(user.uid, PAGE_SIZE, _likedPostsOldestTs)
    .then(function (map) {
      const ids = Object.keys(map).sort(function (a, b) {
        return map[b] - map[a];
      });

      if (ids.length === 0) {
        if (_likedPostsVisible.length === 0 && tab) {
          tab.innerHTML =
            '<div class="posts-empty">Henüz beğendiğin gönderi yok.</div>';
        }
        _hasMoreLikedPosts = false;
        _removeProfileLoadMoreBtn("likedPostsTab");
        _loadingMoreLikedPosts = false;
        return;
      }

      const postIds = ids
        .filter(function (id) {
          return !_likedPostsVisible.includes(id);
        })
        .slice(0, PAGE_SIZE);

      return getPostsByIds(postIds).then(function (posts) {
        postIds.forEach(function (id) {
          if (posts[id]) {
            allPosts[id] = posts[id];
            _likedPostsVisible.push(id);
            if (tab) {
              const wrapper = document.createElement("div");
              wrapper.innerHTML = _renderPostHTML(id, posts[id]);
              tab.appendChild(wrapper.firstElementChild);
            }
          }
        });

        if (ids.length >= PAGE_SIZE) {
          _likedPostsOldestTs = map[ids[ids.length - 1]];
          _hasMoreLikedPosts = true;
          _renderProfileLoadMoreBtn("likedPostsTab", _loadLikedPostsChunk);
        } else {
          _hasMoreLikedPosts = false;
          _removeProfileLoadMoreBtn("likedPostsTab");
        }

        _loadingMoreLikedPosts = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Daha Fazla Göster";
        }
      });
    })
    .catch(function () {
      _loadingMoreLikedPosts = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Daha Fazla Göster";
      }
    });
}

/* ─────────────────── Profil sekmesi için "Daha Fazla" butonu ─────────────────── */

function _renderProfileLoadMoreBtn(tabId, onClick) {
  const btnId =
    tabId === "userPostsTab"
      ? "loadMoreUserPostsBtn"
      : "loadMoreLikedPostsBtn";
  if (document.getElementById(btnId)) return;

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "load-more-btn";
  btn.textContent = "Daha Fazla Göster";
  btn.onclick = onClick;

  const tab = document.getElementById(tabId);
  if (tab && tab.parentNode) {
    tab.parentNode.insertBefore(btn, tab.nextSibling);
  }
}

function _removeProfileLoadMoreBtn(tabId) {
  const btnId =
    tabId === "userPostsTab"
      ? "loadMoreUserPostsBtn"
      : "loadMoreLikedPostsBtn";
  const btn = document.getElementById(btnId);
  if (btn) btn.remove();
}

/* ─────────────────── Profil sekmelerine event delegation ─────────────────── */

document.addEventListener("click", function (e) {
  const target = e.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const postId = target.dataset.id || target.dataset.postId;
  const commentId = target.dataset.commentId;
  const replyId = target.dataset.replyId;

  const userPostsTab = document.getElementById("userPostsTab");
  const likedPostsTab = document.getElementById("likedPostsTab");
  const inUserPosts = userPostsTab && userPostsTab.contains(target);
  const inLikedPosts = likedPostsTab && likedPostsTab.contains(target);

  if (!inUserPosts && !inLikedPosts) return;

  if (action === "like-post") {
    _togglePostLike(postId);
    return;
  }

  if (action === "toggle-comments") {
    _toggleCommentSection(postId);
    return;
  }

  if (action === "submit-comment") {
    _submitComposer(postId);
    return;
  }

  if (action === "start-reply") {
    _startReplyMode(postId, commentId, target.dataset.username);
    return;
  }

  if (action === "cancel-reply") {
    _cancelReplyMode(postId);
    return;
  }

  if (action === "like-comment") {
    _toggleCommentLike(postId, commentId);
    return;
  }

  if (action === "like-reply") {
    _toggleReplyLike(postId, commentId, replyId);
    return;
  }

  if (action === "delete-post") {
    _confirmDeletePost(postId);
    return;
  }

  if (action === "delete-comment") {
    _confirmDeleteComment(postId, commentId);
    return;
  }

  if (action === "delete-reply") {
    _confirmDeleteReply(postId, commentId, replyId);
    return;
  }

  if (action === "post-menu") {
    const dd = document.getElementById("postDropdown-" + postId);
    if (dd) dd.classList.toggle("active");
    return;
  }

  if (action === "comment-menu") {
    const dd = document.getElementById(
      "commentDropdown-" + postId + "-" + commentId,
    );
    if (dd) dd.classList.toggle("active");
    return;
  }

  if (action === "reply-menu") {
    const dd = document.getElementById(
      "replyDropdown-" + postId + "-" + commentId + "-" + replyId,
    );
    if (dd) dd.classList.toggle("active");
    return;
  }

  if (action === "toggle-replies") {
    _openRepliesSection(postId, commentId);
    return;
  }
});

/* ─────────────────── Sayfa değiştiğinde profil sekmelerini temizle ─────────────────── */

function _onPageChange(pageName) {
  if (pageName !== "profile") {
    _profileTab = null;
    _userPostsVisible = [];
    _likedPostsVisible = [];
    const userPostsTab = document.getElementById("userPostsTab");
    const likedPostsTab = document.getElementById("likedPostsTab");
    if (userPostsTab) userPostsTab.innerHTML = "";
    if (likedPostsTab) likedPostsTab.innerHTML = "";
    _removeProfileLoadMoreBtn("userPostsTab");
    _removeProfileLoadMoreBtn("likedPostsTab");
  }
}

/* ─────────────────── Profil sekmesi butonları için event ─────────────────── */

document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const tab = this.dataset.tab;
    document
      .querySelectorAll(".profile-tabs .tab-btn")
      .forEach(function (b) {
        b.classList.remove("active");
      });
    this.classList.add("active");
    document
      .querySelectorAll("#profilePage .tab-content")
      .forEach(function (c) {
        c.classList.remove("active");
      });
    const target = document.getElementById(
      tab === "user-posts" ? "userPostsTab" : "likedPostsTab",
    );
    if (target) target.classList.add("active");
    switchProfileTab(tab);
  });
});
