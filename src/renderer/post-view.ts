/* ─────────────────── Yanıt Listener Başlatıcı (Post View) ─────────────────── */
function _initReplyListenerPV(postId: string, commentId: string): void {
  var post = allPosts[postId];
  if (!post || !post.comments || !post.comments[commentId]) return;
  var repliesRef = db
    .postsRef!.child(postId)
    .child("comments")
    .child(commentId)
    .child("replies");
  repliesRef.on("child_added", function (s) {
    if (!s.key) return;
  });
  repliesRef.on("child_removed", function (s) {
    if (!s.key) return;
  });
}
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              POST VIEW                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allPosts, _renderPostHTML, _initPostImage } from "./posts-render";
import { db } from "./firebase-init";
import { _renderCommentThreadHTML } from "./post-comment";
import { addCommentToFirebase, addReplyToFirebase } from "./firebase-post";
import { showToast } from "./io";
import {
  _currentPage,
  mainScroll,
  _commentListenerRefs,
  escHtml,
  escAttr,
  _onlyCommentLikesChanged,
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
  /* ─────────────────── Güvenli Listener Temizliği ─────────────────── */
  const pidToClean = (window as any)._viewingPostId as string | null;
  if (pidToClean && _commentListenerRefs[pidToClean]) {
    (_commentListenerRefs[pidToClean] as any).off();
    delete _commentListenerRefs[pidToClean];
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
  var pid = escAttr(postId);
  let html = _renderPostHTML(postId, postData, { inPostView: true });
  html += `<div class="comment-section visible" id="commentSection-${pid}">`;
  html += `<div class="comment-list" id="commentList-${pid}">`;
  if (postData.comments) {
    var sorted = Object.keys(postData.comments).sort(function (a, b) {
      return (
        (postData.comments[a].createdAt || 0) -
        (postData.comments[b].createdAt || 0)
      );
    });
    const isPostOwner = !!(user && user.uid === postData.uid);
    sorted.forEach(function (cid) {
      html += _renderCommentThreadHTML(
        postId,
        cid,
        postData.comments[cid],
        user,
        isPostOwner,
      );
    });
  }
  html += "</div>";
  html += "</div>";
  container.innerHTML = html;
  var lazyImg = container.querySelector(
    ".post-img-lazy",
  ) as HTMLImageElement | null;
  if (lazyImg) _initPostImage(lazyImg);
  _initPostViewCommentListener(postId);

  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLTextAreaElement | null;
  var sendBtn = document.getElementById("postViewSendBtn");
  if (input && sendBtn) {
    sendBtn.classList.toggle("visible", input.value.trim().length > 0);
    input.addEventListener("input", function (this: HTMLTextAreaElement) {
      var sendBtn = document.getElementById("postViewSendBtn");
      if (sendBtn)
        sendBtn.classList.toggle("visible", this.value.trim().length > 0);
    });
    input.addEventListener("keydown", function (e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        _submitPostViewComment();
      }
    });
  }
  if (sendBtn) sendBtn.addEventListener("click", _submitPostViewComment);

  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLTextAreaElement | null;
  var sendBtn = document.getElementById("postViewSendBtn");
  if (input && sendBtn) {
    sendBtn.classList.toggle("visible", input.value.trim().length > 0);
  }
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

  var ref = db
    .postsRef!.child(postId)
    .child("comments")
    .orderByChild("createdAt");
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

    _initReplyListenerPV(postId, cid);

    var commentList = document.getElementById("commentList-" + postId);
    if (commentList) {
      var wrapper = document.createElement("div");
      var post = allPosts[postId];
      var isPostOwner = !!(
        _currentUser &&
        post &&
        _currentUser.uid === post.uid
      );
      wrapper.innerHTML = _renderCommentThreadHTML(
        postId,
        cid,
        data,
        _currentUser,
        isPostOwner,
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

    _initReplyListenerPV(postId, cid);

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
    var post = allPosts[postId];
    var isPostOwner = !!(_currentUser && post && _currentUser.uid === post.uid);
    wrapper.innerHTML = _renderCommentThreadHTML(
      postId,
      cid,
      newData,
      _currentUser,
      isPostOwner,
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
    if (post && post.comments) {
      delete post.comments[cid];
    }

    var thread = document.getElementById("commentThread-" + postId + "-" + cid);
    if (thread) thread.remove();
    _updatePostViewCommentCount(postId);
  });
  function _initReplyListenerPV(postId: string, commentId: string): void {
    var post = allPosts[postId];
    if (!post || !post.comments || !post.comments[commentId]) return;
    var repliesRef = db
      .postsRef!.child(postId)
      .child("comments")
      .child(commentId)
      .child("replies");
    repliesRef.on("child_added", function (s) {
      if (!s.key) return;
      if (typeof post._commentCount !== "number") post._commentCount = 0;
      post._commentCount++;
    });
    repliesRef.on("child_removed", function (s) {
      if (!s.key) return;
      if (typeof post._commentCount === "number" && post._commentCount > 0)
        post._commentCount--;
    });
  }
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
        var input = document.getElementById(
          "postViewCommentInput",
        ) as HTMLTextAreaElement | null;
        if (input) input.value = "";
        var sendBtn = document.getElementById("postViewSendBtn");
        if (sendBtn) sendBtn.classList.remove("visible");
      })
      .catch(function () {
        showToast("Yanıt eklenemedi", "error");
      });
  } else {
    addCommentToFirebase((window as any)._viewingPostId, baseData)
      .then(function () {
        showToast("Yorum eklendi", "success");
        var input = document.getElementById(
          "postViewCommentInput",
        ) as HTMLTextAreaElement | null;
        if (input) input.value = "";
        var sendBtn = document.getElementById("postViewSendBtn");
        if (sendBtn) sendBtn.classList.remove("visible");
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
