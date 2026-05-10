/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              POST VIEW                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allPosts } from "./posts-render";
import { _initPostImage } from "./posts-render";
import { _renderCommentThreadHTML } from "./post-comment";
import { addCommentToFirebase, addReplyToFirebase } from "./firebase-post";
import { showToast } from "./io";
import {
  _currentPage,
  mainScroll,
  _commentListenerRefs,
  escHtml,
  escAttr,
  escUrl,
  formatTimeAgo,
  formatDateTime,
  _onlyCommentLikesChanged,
  buildAvatarHTML,
  buildPostMenuHTML,
  showPage,
  getTotalCommentCount,
} from "./utils";
import { _patchCommentLikeBtn } from "./post-comment";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AÇMA / KAPAMA                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modül Durum Değişkenleri ─────────────────── */

let _previousPage: string | null = null;
let _previousScrollTop = 0;
let _previousProfileTab: string | null = null;
let _replyTargetCommentId: string | null = null;
let _replyTargetUsername: string | null = null;
let _pvActiveNavBtn: Element | null = null;

/* ─────────────────── Post View'i açar ─────────────────── */

function openPostView(postId: string, fromCommentBtn?: boolean): void {
  var postData = allPosts[postId];
  if (!postData) return;

  var composerBar = document.getElementById("postViewComposerBar");
  if (composerBar) composerBar.style.display = "";

  (window as any)._viewingPostId = postId;
  _previousPage = _currentPage;
  _previousProfileTab =
    _currentPage === "profile" ? (window as any)._profileTab : null;
  sessionStorage.setItem("_pvPreviousPage", _previousPage || "home");
  sessionStorage.setItem(
    "_pvScrollTop",
    String(mainScroll ? mainScroll.scrollTop : 0),
  );
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
(window as any).openPostView = openPostView;

/* ─────────────────── Post View'i kapatır ve geri döner ─────────────────── */

function closePostView(): void {
  if (
    (window as any)._viewingPostId &&
    _commentListenerRefs[(window as any)._viewingPostId]
  ) {
    (_commentListenerRefs[(window as any)._viewingPostId] as any).off();
    delete _commentListenerRefs[(window as any)._viewingPostId];
  }

  var targetPage = _previousPage || "home";
  var savedScroll = _previousScrollTop;
  var savedNavBtn = _pvActiveNavBtn;
  var savedProfileTab = _previousProfileTab;

  (window as any)._viewingPostId = null;
  sessionStorage.removeItem("_pvPreviousPage");
  sessionStorage.removeItem("_pvScrollTop");
  _previousPage = null;
  _previousScrollTop = 0;
  _previousProfileTab = null;
  _replyTargetCommentId = null;
  _replyTargetUsername = null;
  _pvActiveNavBtn = null;

  var postViewContent = document.getElementById("postViewContent");
  if (postViewContent) postViewContent.innerHTML = "";

  if (mainScroll) mainScroll.classList.remove("pv-active");

  if (targetPage === "profile" && savedProfileTab) {
    (window as any)._pendingProfileTab = savedProfileTab;
  }

  showPage(targetPage);

  if (savedNavBtn) {
    savedNavBtn.classList.add("active");
  }

  setTimeout(function () {
    if (mainScroll) mainScroll.scrollTop = savedScroll;
  }, 320);
}
(window as any).closePostView = closePostView;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                                RENDER                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post + yorumları render eder ─────────────────── */

function _renderPostViewContent(postId: string, postData: any): void {
  var container = document.getElementById("postViewContent");
  if (!container) return;

  var user = firebase.auth().currentUser;
  var isOwn = !!(user && user.uid === postData.uid);
  var liked = postData.likes && user && postData.likes[user.uid];
  var likeCount = postData.likes ? Object.keys(postData.likes).length : 0;
  var commentCount = getTotalCommentCount(postData);
  var pid = escAttr(postId);

  var html = `<div class="post-card" data-post-id="${pid}">`;

  html += '<div class="post-header">';
  html += buildAvatarHTML(postData.username, "post-avatar");
  html += '<div class="post-user-info">';
  html += `<span class="post-username">${escHtml(postData.username || "Kullanici")}</span>`;
  html += `<span class="post-time">${escHtml(formatTimeAgo(postData.createdAt, postData.phraseIndex))}</span>`;
  html += "</div>";
  html += buildPostMenuHTML(pid, isOwn);
  html += "</div>";

  html += '<div class="post-body">';
  if (postData.content) {
    html += `<div class="post-text">${escHtml(postData.content)}</div>`;
  }
  if (postData.imageUrl) {
    html += `<div class="post-image"><img src="${escUrl(postData.imageUrl)}" alt="" class="post-img-lazy"></div>`;
  }
  html += "</div>";

  html += '<div class="post-actions">';
  html += `<button class="post-action-btn like-btn${liked ? " liked" : ""}" data-action="like-post" data-id="${pid}">`;
  html += `<svg viewBox="0 0 24 24" width="15" height="15" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">`;
  html += `<path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/>`;
  html += `</svg> <span class="post-like-count-${pid}">${likeCount}</span></button>`;

  html += `<button class="post-action-btn comment-btn" data-action="pv-focus-composer">`;
  html += `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">`;
  html += `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`;
  html += `</svg> <span class="comment-count-${pid}">${commentCount}</span></button>`;

  html += `<span class="post-date">${escHtml(formatDateTime(postData.createdAt))}</span>`;
  html += "</div>";

  html += `<div class="comment-section visible" id="commentSection-${pid}">`;
  html += `<div class="comment-list" id="commentList-${pid}">`;

  if (postData.comments) {
    var sorted = Object.keys(postData.comments).sort(function (a, b) {
      return (
        (postData.comments[a].createdAt || 0) -
        (postData.comments[b].createdAt || 0)
      );
    });
    sorted.forEach(function (cid) {
      html += _renderCommentThreadHTML(
        postId,
        cid,
        postData.comments[cid],
        user,
      );
    });
  }

  html += "</div>";
  html += "</div>";
  html += "</div>";

  container.innerHTML = html;

  var lazyImg = container.querySelector(
    ".post-img-lazy",
  ) as HTMLImageElement | null;
  if (lazyImg) _initPostImage(lazyImg);

  _initPostViewCommentListener(postId);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM LİSTENER (POST VIEW)                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase yorum listener'ını başlatır ─────────────────── */

function _initPostViewCommentListener(postId: string): void {
  if (_commentListenerRefs[postId]) {
    (_commentListenerRefs[postId] as any).off();
    delete _commentListenerRefs[postId];
  }

  var postsRef = firebase.database().ref("posts");
  var ref = postsRef.child(postId).child("comments").orderByChild("createdAt");
  _commentListenerRefs[postId] = ref as any;
  var _currentUser = firebase.auth().currentUser;

  ref.on("child_added", function (s: firebase.database.DataSnapshot) {
    if ((window as any)._viewingPostId !== postId) return;
    var cid = s.key;
    var data = s.val();
    if (!cid) return;
    var post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    if (post.comments[cid]) return;
    post.comments[cid] = data;

    var commentList = document.getElementById("commentList-" + postId);
    if (commentList) {
      var wrapper = document.createElement("div");
      wrapper.innerHTML = _renderCommentThreadHTML(
        postId,
        cid,
        data,
        _currentUser,
      );
      var child = wrapper.firstElementChild;
      if (child) commentList.appendChild(child);
    }
    _updatePostViewCommentCount(postId);
  });

  ref.on("child_changed", function (s: firebase.database.DataSnapshot) {
    if ((window as any)._viewingPostId !== postId) return;
    var cid = s.key;
    var newData = s.val() as any;
    if (!cid) return;
    var post = allPosts[postId];
    if (!post) return;
    var oldData = post.comments ? post.comments[cid] : null;
    if (!post.comments) post.comments = {};
    post.comments[cid] = newData;

    var thread = document.getElementById("commentThread-" + postId + "-" + cid);
    if (!thread) return;

    if (
      oldData &&
      typeof _onlyCommentLikesChanged === "function" &&
      _onlyCommentLikesChanged(oldData, newData)
    ) {
      if (typeof _patchCommentLikeBtn === "function")
        _patchCommentLikeBtn(postId, cid, newData.likes, _currentUser);
      return;
    }

    var wrapper = document.createElement("div");
    wrapper.innerHTML = _renderCommentThreadHTML(
      postId,
      cid,
      newData,
      _currentUser,
    );
    var newEl = wrapper.firstElementChild;
    if (!newEl) return;
    var repliesSec = thread.querySelector(".replies-section");
    var wasOpen = repliesSec && !repliesSec.classList.contains("hidden");
    thread.replaceWith(newEl);
    if (wasOpen) {
      var newRepliesSec = newEl.querySelector(
        ".replies-section",
      ) as HTMLElement | null;
      if (newRepliesSec) newRepliesSec.classList.remove("hidden");
      var newToggleBtn = newEl.querySelector(
        ".toggle-replies-btn",
      ) as HTMLElement | null;
      if (newToggleBtn) newToggleBtn.textContent = "yanıtları gizle";
    }
  });

  ref.on("child_removed", function (s: firebase.database.DataSnapshot) {
    if ((window as any)._viewingPostId !== postId) return;
    var cid = s.key;
    if (!cid) return;
    var post = allPosts[postId];
    if (post && post.comments) delete post.comments[cid];

    var thread = document.getElementById("commentThread-" + postId + "-" + cid);
    if (thread) thread.remove();
    _updatePostViewCommentCount(postId);
  });
}

/* ─────────────────── Yorum sayacını günceller ─────────────────── */

function _updatePostViewCommentCount(postId: string): void {
  var post = allPosts[postId];
  var count = getTotalCommentCount(post);
  document.querySelectorAll(".comment-count-" + postId).forEach(function (el) {
    el.textContent = String(count);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YANIT HEDEF YÖNETİMİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yanıt hedefini ayarlar ─────────────────── */

function _setPostViewReplyTarget(commentId: string, username: string): void {
  _replyTargetCommentId = commentId;
  _replyTargetUsername = username;

  var target = document.getElementById("postViewReplyTarget");
  var targetText = document.getElementById("postViewReplyTargetText");
  if (target && targetText) {
    targetText.textContent = "@" + username + " yanıtlanıyor";
    target.classList.add("visible");
  }

  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLTextAreaElement | null;
  if (input) {
    input.placeholder = "@" + username + " kişisine yanıtla...";
    input.focus();
  }
}

/* ─────────────────── Yanıt hedefini temizler ─────────────────── */

function _clearPostViewReplyTarget(): void {
  _replyTargetCommentId = null;
  _replyTargetUsername = null;

  var target = document.getElementById("postViewReplyTarget");
  if (target) target.classList.remove("visible");

  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLTextAreaElement | null;
  if (input) input.placeholder = "Yorum yaz...";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            YORUM GÖNDERİMİ                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum veya yanıt gönderir ─────────────────── */

function _submitPostViewComment(): void {
  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLElement | null;
  if (!input || !(window as any)._viewingPostId) return;
  if (!allPosts[(window as any)._viewingPostId]) {
    showToast("Bu gönderi artık mevcut değil", "warn");
    return;
  }

  var user = firebase.auth().currentUser;
  if (!user) return;

  var sendBtn = document.getElementById("postViewSendBtn");
  if (sendBtn) sendBtn.classList.remove("visible");

  var baseData: Record<string, any> = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    text: (input as HTMLTextAreaElement).value.trim(),
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  if (_replyTargetCommentId) {
    var targetCid = _replyTargetCommentId;
    addReplyToFirebase((window as any)._viewingPostId, targetCid, baseData)
      .then(function () {
        _clearPostViewReplyTarget();
        showToast("Yanıt eklendi", "success");
        var repliesSec = document.getElementById(
          "replies-" + (window as any)._viewingPostId + "-" + targetCid,
        );
        if (repliesSec && repliesSec.classList.contains("hidden")) {
          repliesSec.classList.remove("hidden");
          var toggleBtn = document.getElementById(
            "toggleReplies-" + (window as any)._viewingPostId + "-" + targetCid,
          ) as HTMLElement | null;
          if (toggleBtn) toggleBtn.textContent = "yanıtları gizle";
        }
      })
      .catch(function () {
        showToast("Yanıt eklenemedi", "error");
      });
  } else {
    addCommentToFirebase((window as any)._viewingPostId, baseData)
      .then(function () {
        showToast("Yorum eklendi", "success");
      })
      .catch(function () {
        showToast("Yorum eklenemedi", "error");
      });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       SİLİNEN POST YÖNETİMİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _handleDeletedPostView(): void {
  var composerBar = document.getElementById("postViewComposerBar");
  if (composerBar) composerBar.style.display = "none";

  var content = document.getElementById("postViewContent");
  if (!content) return;

  content.innerHTML =
    '<div class="post-view-deleted-state">' +
    '<div class="post-view-deleted-icon">' +
    '<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    "</svg>" +
    "</div>" +
    '<div class="post-view-deleted-text">Bu gönderi artık mevcut değil</div>' +
    '<div class="post-view-deleted-sub">Gönderi sahibi tarafından silindi.</div>' +
    '<button class="post-view-deleted-btn" id="deletedPostBackBtn">Geri Dön</button>' +
    "</div>";

  var backBtn = document.getElementById("deletedPostBackBtn");
  if (backBtn) backBtn.addEventListener("click", closePostView);
}
(window as any)._handleDeletedPostView = _handleDeletedPostView;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          OLAY DİNLEYİCİLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Geri butonu ─────────────────── */

var _pvBackBtn = document.getElementById("postViewBackBtn");
if (_pvBackBtn) _pvBackBtn.addEventListener("click", closePostView);

/* ─────────────────── Yanıt iptal ─────────────────── */

var _pvReplyCancel = document.getElementById("postViewReplyCancel");
if (_pvReplyCancel)
  _pvReplyCancel.addEventListener("click", _clearPostViewReplyTarget);

/* ─────────────────── Composer input ─────────────────── */

var _pvInput = document.getElementById(
  "postViewCommentInput",
) as HTMLTextAreaElement | null;
if (_pvInput) {
  _pvInput.addEventListener("input", function (this: HTMLTextAreaElement) {
    var sendBtn = document.getElementById("postViewSendBtn");
    if (sendBtn)
      sendBtn.classList.toggle("visible", this.value.trim().length > 0);
  });

  _pvInput.addEventListener("keydown", function (e: KeyboardEvent) {
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
  _pvContent.addEventListener("click", function (e: MouseEvent) {
    var btn = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement | null;
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === "pv-focus-composer") {
      var input = document.getElementById(
        "postViewCommentInput",
      ) as HTMLElement | null;
      if (input) input.focus();
      return;
    }

    if (action === "start-reply") {
      _setPostViewReplyTarget(btn.dataset.commentId!, btn.dataset.username!);
      return;
    }
  });
}

/* ================================================================= */
/*                          F5 / RELOAD KORUMASI                           */
/* ================================================================= */

function _restorePostViewOnLoad(): void {
  var savedPid = sessionStorage.getItem("_viewingPostId");
  if (!savedPid) return;

  var _fallbackTimer = window.setTimeout(function () {
    document.removeEventListener("postsReady", _onPostsReady);
    if (savedPid && allPosts[savedPid]) {
      _onPostsReady();
    } else if (!savedPid) {
      sessionStorage.removeItem("_viewingPostId");
    }
  }, 2000);

  function _onPostsReady(): void {
    clearTimeout(_fallbackTimer);
    document.removeEventListener("postsReady", _onPostsReady);
    if (!savedPid || !allPosts[savedPid]) return;
    (window as any)._viewingPostId = savedPid;
    var postData = allPosts[savedPid];
    var authorLabel = document.getElementById("postViewAuthorLabel");
    if (authorLabel) {
      authorLabel.textContent =
        escHtml(postData.username || "Kullanıcı") + " gönderisi";
    }
    _previousPage = sessionStorage.getItem("_pvPreviousPage") || "home";
    _previousScrollTop =
      parseInt(sessionStorage.getItem("_pvScrollTop") || "0", 10) || 0;
    _pvActiveNavBtn = document.querySelector(
      '.sidebar-nav-btn[data-page="' + _previousPage + '"]',
    );
    _renderPostViewContent(savedPid!, postData);
    showPage("postView");
    if (mainScroll) mainScroll.classList.add("pv-active");
    if (_pvActiveNavBtn) {
      _pvActiveNavBtn.classList.add("active");
    }
  }

  if (savedPid && (allPosts[savedPid] || (window as any)._postsReadyFired)) {
    _onPostsReady();
  } else if (savedPid) {
    document.addEventListener("postsReady", _onPostsReady);
  }
}
(window as any)._restorePostViewOnLoad = _restorePostViewOnLoad;
