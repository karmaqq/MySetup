/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════ */
/*                              POST VIEW                                     */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modül Durum Değişkenleri ─────────────────── */

let _previousPage = null;
let _previousScrollTop = 0;
let _replyTargetCommentId = null;
let _replyTargetUsername = null;
let _pvActiveNavBtn = null;

/* ═══════════════════════════════════════════════════════════════════ */
/*                              AÇMA / KAPAMA                                 */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post View'i açar ─────────────────── */

function openPostView(postId, fromCommentBtn) {
  var postData = allPosts[postId];
  if (!postData) return;

  _viewingPostId = postId;
  sessionStorage.setItem("_viewingPostId", postId);
  _previousPage = _currentPage;
  sessionStorage.setItem("_pvPreviousPage", _previousPage);
  sessionStorage.setItem("_pvScrollTop", mainScroll ? mainScroll.scrollTop : 0);
  _previousScrollTop = mainScroll ? mainScroll.scrollTop : 0;

  var authorLabel = document.getElementById("postViewAuthorLabel");
  if (authorLabel) {
    authorLabel.textContent =
      escHtml(postData.username || "Kullanıcı") + " gönderisi";
  }

  _pvActiveNavBtn = document.querySelector(".sidebar-nav-btn.active");

  _renderPostViewContent(postId, postData);

  showPage("postView");

  if (mainScroll) mainScroll.classList.add("pv-active");

  if (_pvActiveNavBtn) {
    _pvActiveNavBtn.classList.add("active");
  }

  if (fromCommentBtn) {
    setTimeout(function () {
      var input = document.getElementById("postViewCommentInput");
      if (input) input.focus();
    }, 350);
  }
}

/* ─────────────────── Post View'i kapatır ve geri döner ─────────────────── */

function closePostView() {
  if (_viewingPostId && _commentListenerRefs[_viewingPostId]) {
    _commentListenerRefs[_viewingPostId].off();
    delete _commentListenerRefs[_viewingPostId];
  }

  var targetPage = _previousPage || "home";
  var savedScroll = _previousScrollTop;
  var savedNavBtn = _pvActiveNavBtn;

  _viewingPostId = null;
  sessionStorage.removeItem("_viewingPostId");
  sessionStorage.removeItem("_pvPreviousPage");
  sessionStorage.removeItem("_pvScrollTop");
  _previousPage = null;
  _previousScrollTop = 0;
  _replyTargetCommentId = null;
  _replyTargetUsername = null;
  _pvActiveNavBtn = null;

  var postViewContent = document.getElementById("postViewContent");
  if (postViewContent) postViewContent.innerHTML = "";

  if (mainScroll) mainScroll.classList.remove("pv-active");

  showPage(targetPage);

  if (savedNavBtn) {
    savedNavBtn.classList.add("active");
  }

  setTimeout(function () {
    if (mainScroll) mainScroll.scrollTop = savedScroll;
  }, 320);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                                RENDER                                      */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post + yorumları render eder ─────────────────── */

function _renderPostViewContent(postId, postData) {
  var container = document.getElementById("postViewContent");
  if (!container) return;

  var user = firebase.auth().currentUser;
  var isOwn = user && user.uid === postData.uid;
  var liked = postData.likes && user && postData.likes[user.uid];
  var likeCount = postData.likes ? Object.keys(postData.likes).length : 0;
  var commentCount = postData.comments
    ? Object.keys(postData.comments).length
    : 0;
  var pid = escAttr(postId);

  var html = '<div class="post-card" data-post-id="' + pid + '">';

  html += '<div class="post-header">';
  html +=
    '<div class="post-avatar">' + getAvatarLetter(postData.username) + "</div>";
  html += '<div class="post-user-info">';
  html +=
    '<span class="post-username">' +
    escHtml(postData.username || "Kullanici") +
    "</span>";
  html +=
    '<span class="post-time">' +
    escHtml(formatTimeAgo(postData.createdAt, postData.phraseIndex)) +
    "</span>";
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
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">';
    html += '<polyline points="3 6 5 6 21 6"/>';
    html +=
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
    html += "</svg> Sil</button>";
    html += "</div>";
  }
  html += "</div>";

  html += '<div class="post-body">';
  if (postData.content) {
    html += '<div class="post-text">' + escHtml(postData.content) + "</div>";
  }
  if (postData.imageUrl) {
    html +=
      '<div class="post-image"><img src="' +
      escAttr(postData.imageUrl) +
      '" alt="" class="post-img-lazy"></div>';
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
    '" stroke="currentColor" stroke-width="2">';
  html +=
    '<path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/>';
  html +=
    '</svg> <span class="post-like-count-' +
    pid +
    '">' +
    likeCount +
    "</span></button>";

  html +=
    '<button class="post-action-btn comment-btn" data-action="pv-focus-composer">';
  html +=
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">';
  html +=
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';
  html +=
    '</svg> <span class="comment-count-' +
    pid +
    '">' +
    commentCount +
    "</span></button>";

  html +=
    '<span class="post-date">' +
    escHtml(formatDateTime(postData.createdAt)) +
    "</span>";
  html += "</div>";

  html +=
    '<div class="comment-section visible" id="commentSection-' + pid + '">';
  html += '<div class="comment-list" id="commentList-' + pid + '">';

  if (postData.comments) {
    var sorted = Object.keys(postData.comments).sort(function (a, b) {
      return (
        (postData.comments[a].createdAt || 0) -
        (postData.comments[b].createdAt || 0)
      );
    });
    sorted.forEach(function (cid) {
      html += _renderCommentThreadHTML(postId, cid, postData.comments[cid]);
    });
  }

  html += "</div>";
  html += "</div>";
  html += "</div>";

  container.innerHTML = html;

  var lazyImg = container.querySelector(".post-img-lazy");
  if (lazyImg) _initPostImage(lazyImg);

  _initPostViewCommentListener(postId);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                          YORUM LİSTENER (POST VIEW)                        */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase yorum listener'ını başlatır ─────────────────── */

function _initPostViewCommentListener(postId) {
  if (_commentListenerRefs[postId]) {
    _commentListenerRefs[postId].off();
    delete _commentListenerRefs[postId];
  }

  var ref = postsRef.child(postId).child("comments").orderByChild("createdAt");
  _commentListenerRefs[postId] = ref;

  ref.on("child_added", function (s) {
    if (_viewingPostId !== postId) return;
    var cid = s.key;
    var data = s.val();
    var post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    if (post.comments[cid]) return;
    post.comments[cid] = data;

    var commentList = document.getElementById("commentList-" + postId);
    if (commentList) {
      var wrapper = document.createElement("div");
      wrapper.innerHTML = _renderCommentThreadHTML(postId, cid, data);
      commentList.appendChild(wrapper.firstElementChild);
    }
    _updatePostViewCommentCount(postId);
  });

  ref.on("child_changed", function (s) {
    if (_viewingPostId !== postId) return;
    var cid = s.key;
    var data = s.val();
    var post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    post.comments[cid] = data;

    var thread = document.getElementById("commentThread-" + postId + "-" + cid);
    if (thread) {
      var wrapper = document.createElement("div");
      wrapper.innerHTML = _renderCommentThreadHTML(postId, cid, data);
      var newEl = wrapper.firstElementChild;
      var repliesSec = thread.querySelector(".replies-section");
      var wasOpen = repliesSec && !repliesSec.classList.contains("hidden");
      thread.replaceWith(newEl);
      if (wasOpen) {
        var newRepliesSec = newEl.querySelector(".replies-section");
        if (newRepliesSec) newRepliesSec.classList.remove("hidden");
      }
    }
  });

  ref.on("child_removed", function (s) {
    if (_viewingPostId !== postId) return;
    var cid = s.key;
    var post = allPosts[postId];
    if (post && post.comments) delete post.comments[cid];

    var thread = document.getElementById("commentThread-" + postId + "-" + cid);
    if (thread) thread.remove();
    _updatePostViewCommentCount(postId);
  });
}

/* ─────────────────── Yorum sayacını günceller ─────────────────── */

function _updatePostViewCommentCount(postId) {
  var post = allPosts[postId];
  var count = post && post.comments ? Object.keys(post.comments).length : 0;
  document.querySelectorAll(".comment-count-" + postId).forEach(function (el) {
    el.textContent = count;
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                          YANIT HEDEF YÖNETİMİ                              */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yanıt hedefini ayarlar ─────────────────── */

function _setPostViewReplyTarget(commentId, username) {
  _replyTargetCommentId = commentId;
  _replyTargetUsername = username;

  var target = document.getElementById("postViewReplyTarget");
  var targetText = document.getElementById("postViewReplyTargetText");
  if (target && targetText) {
    targetText.textContent = "@" + username + " yanıtlanıyor";
    target.classList.add("visible");
  }

  var input = document.getElementById("postViewCommentInput");
  if (input) {
    input.placeholder = "@" + username + " kişisine yanıtla...";
    input.focus();
  }
}

/* ─────────────────── Yanıt hedefini temizler ─────────────────── */

function _clearPostViewReplyTarget() {
  _replyTargetCommentId = null;
  _replyTargetUsername = null;

  var target = document.getElementById("postViewReplyTarget");
  if (target) target.classList.remove("visible");

  var input = document.getElementById("postViewCommentInput");
  if (input) input.placeholder = "Yorum yaz...";
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                            YORUM GÖNDERİMİ                                 */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum veya yanıt gönderir ─────────────────── */

function _submitPostViewComment() {
  var input = document.getElementById("postViewCommentInput");
  if (!input || !_viewingPostId) return;

  var text = input.value.trim();
  if (!text) return;

  var user = firebase.auth().currentUser;
  if (!user) return;

  var sendBtn = document.getElementById("postViewSendBtn");
  if (sendBtn) sendBtn.classList.remove("visible");

  var baseData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  if (_replyTargetCommentId) {
    var targetCid = _replyTargetCommentId;
    addReplyToFirebase(_viewingPostId, targetCid, baseData)
      .then(function () {
        input.value = "";
        _clearPostViewReplyTarget();
        showToast("Yanıt eklendi", "success");
        var repliesSec = document.getElementById(
          "replies-" + _viewingPostId + "-" + targetCid,
        );
        if (repliesSec) repliesSec.classList.remove("hidden");
      })
      .catch(function () {
        showToast("Yanıt eklenemedi", "error");
      });
  } else {
    addCommentToFirebase(_viewingPostId, baseData)
      .then(function () {
        input.value = "";
        showToast("Yorum eklendi", "success");
      })
      .catch(function () {
        showToast("Yorum eklenemedi", "error");
      });
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                          OLAY DİNLEYİCİLERİ                                */
/* ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────── Geri butonu ─────────────────── */

var _pvBackBtn = document.getElementById("postViewBackBtn");
if (_pvBackBtn) _pvBackBtn.addEventListener("click", closePostView);

/* ─────────────────── Yanıt iptal ─────────────────── */

var _pvReplyCancel = document.getElementById("postViewReplyCancel");
if (_pvReplyCancel)
  _pvReplyCancel.addEventListener("click", _clearPostViewReplyTarget);

/* ─────────────────── Composer input ─────────────────── */

var _pvInput = document.getElementById("postViewCommentInput");
if (_pvInput) {
  _pvInput.addEventListener("input", function () {
    var sendBtn = document.getElementById("postViewSendBtn");
    if (sendBtn)
      sendBtn.classList.toggle("visible", this.value.trim().length > 0);
  });

  _pvInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      _submitPostViewComment();
    }
  });
}

/* ─────────────────── Gönder butonu ─────────────────── */

var _pvSendBtn = document.getElementById("postViewSendBtn");
if (_pvSendBtn) _pvSendBtn.addEventListener("click", _submitPostViewComment);

/* ─────────────────── Post View içi delegasyon ─────────────────── */

var _pvContent = document.getElementById("postViewContent");
if (_pvContent) {
  _pvContent.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === "pv-focus-composer") {
      var input = document.getElementById("postViewCommentInput");
      if (input) input.focus();
      return;
    }

    if (action === "start-reply") {
      _setPostViewReplyTarget(btn.dataset.commentId, btn.dataset.username);
      return;
    }

  });
}

/* ═════════════════════════════════════════════════════════════════ */
/*                          F5 / RELOAD KORUMASI                           */
/* ═════════════════════════════════════════════════════════════════ */

function _restorePostViewOnLoad() {
  var savedPid = sessionStorage.getItem("_viewingPostId");
  if (!savedPid) return;

  var _fallbackTimer = setTimeout(function () {
    document.removeEventListener("postsReady", _onPostsReady);
    if (typeof allPosts !== "undefined" && allPosts[savedPid]) {
      _onPostsReady();
    }
  }, 5000);

  function _onPostsReady() {
    clearTimeout(_fallbackTimer);
    document.removeEventListener("postsReady", _onPostsReady);
    if (!allPosts[savedPid]) return;
    _viewingPostId = savedPid;
    var postData = allPosts[savedPid];
    var authorLabel = document.getElementById("postViewAuthorLabel");
    if (authorLabel) {
      authorLabel.textContent =
        escHtml(postData.username || "Kullanıcı") + " gönderisi";
    }
    _previousPage = sessionStorage.getItem("_pvPreviousPage") || "home";
    _previousScrollTop =
      parseInt(sessionStorage.getItem("_pvScrollTop")) || 0;
    _pvActiveNavBtn = document.querySelector(
      '.sidebar-nav-btn[data-page="' + _previousPage + '"]',
    );
    _renderPostViewContent(savedPid, postData);
    showPage("postView");
    if (mainScroll) mainScroll.classList.add("pv-active");
    if (_pvActiveNavBtn) {
      _pvActiveNavBtn.classList.add("active");
    }
  }

  if (
    (typeof allPosts !== "undefined" && allPosts[savedPid]) ||
    window._postsReadyFired
  ) {
    _onPostsReady();
  } else {
    document.addEventListener("postsReady", _onPostsReady);
  }
}
