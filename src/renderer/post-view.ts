/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              POST VIEW                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { onChildAdded, onChildChanged, onChildRemoved, off, query, orderByChild, child, DataSnapshot, Query } from "firebase/database";
import { allPosts, _renderPostHTML, _initPostImage } from "./posts-render";
import { db } from "./firebase-init";
import { _renderCommentThreadHTML } from "./post-comment";
import { _currentPage, mainScroll, _commentListenerRefs, showPage, currentUser } from "./app-state";
import { escHtml, escAttr, _onlyCommentLikesChanged } from "./global-ut";
import { getTotalCommentCount } from "./global-fn";
import { _patchCommentLikeBtn } from "./post-comment";
import { _submitPostViewComment, _clearPostViewReplyTarget } from "./post-view-comment";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          AÇMA / KAPAMA                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modül Durum Değişkenleri ─────────────────── */

let _previousPage: string | null = null;
let _previousScrollTop = 0;
let _previousProfileTab: string | null = null;
let _pvActiveNavBtn: Element | null = null;

/* ─────────────────── F5 Restore: Modül Değişkenlerini Doldur ─────────────────── */
function _restorePostViewState(prevPage: string, prevScrollTop: number): void {
  _previousPage = prevPage;
  _previousScrollTop = prevScrollTop;
  _previousProfileTab = null;
  const navPage = prevPage === "profile" ? "profile" : prevPage === "inventory" ? "inventory" : "home";
  _pvActiveNavBtn = document.querySelector(`.sidebar-nav-btn[data-page="${navPage}"]`);
}
(window as any)._restorePostViewState = _restorePostViewState;

/* ─────────────────── Post View'i açar ─────────────────── */

function openPostView(postId: string, fromCommentBtn?: boolean): void {
  var postData = allPosts[postId];
  if (!postData) return;

  var composerBar = document.getElementById("postViewComposerBar");
  if (composerBar) composerBar.style.display = "";

  (window as any)._viewingPostId = postId;
  if (!_previousPage) {
    _previousPage = _currentPage;
  }
  if (!_previousScrollTop) {
    _previousScrollTop = mainScroll ? mainScroll.scrollTop : 0;
  }
  _previousProfileTab =
    _previousPage === "profile" ? (window as any)._profileTab : null;
  sessionStorage.setItem("_pvPreviousPage", _previousPage || "home");
  sessionStorage.setItem(
    "_pvScrollTop",
    String(_previousScrollTop),
  );

  var authorLabel = document.getElementById("postViewAuthorLabel");
  if (authorLabel) {
    authorLabel.textContent =
      escHtml(postData.username || "Kullanıcı") + " gönderisi";
  }

  if (!_pvActiveNavBtn) {
    _pvActiveNavBtn = document.querySelector(".sidebar-nav-btn.active");
  }

  _renderPostViewContent(postId, postData);

  var _pvCard = document.querySelector('#postViewContent [data-post-id="' + postId + '"]');
  if (_pvCard && typeof (window as any)._registerTimeCard === "function") {
    (window as any)._registerTimeCard(_pvCard);
  }

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
    off(_commentListenerRefs[pidToClean]);
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
  _clearPostViewReplyTarget();
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

  if (savedScroll > 0 && mainScroll) {
    const _restoreScroll = function (): void {
      if (mainScroll) mainScroll.scrollTop = savedScroll;
    };
    const newPage = document.getElementById(targetPage + "Page");
    if (newPage) {
      let _scrollRestored = false;
      const _onTransitionEnd = function (): void {
        if (_scrollRestored) return;
        _scrollRestored = true;
        _restoreScroll();
      };
      newPage.addEventListener("transitionend", _onTransitionEnd, { once: true });
      setTimeout(function () {
        if (_scrollRestored) return;
        _scrollRestored = true;
        newPage.removeEventListener("transitionend", _onTransitionEnd);
        _restoreScroll();
      }, 420);
    } else {
      setTimeout(_restoreScroll, 320);
    }
  }
}
(window as any).closePostView = closePostView;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                                RENDER                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post + yorumları render eder ─────────────────── */

function _renderPostViewContent(postId: string, postData: any): void {
  var container = document.getElementById("postViewContent");
  if (!container) return;
  var user = currentUser;
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
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM LİSTENER (POST VIEW)                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase yorum listener'ını başlatır ─────────────────── */

function _initPostViewCommentListener(postId: string): void {
  if (_commentListenerRefs[postId]) {
    off(_commentListenerRefs[postId]);
    delete _commentListenerRefs[postId];
  }

  var q: Query = query(child(child(db.postsRef!, postId), "comments"), orderByChild("createdAt"));
  _commentListenerRefs[postId] = q as any;
  var _currentUser = currentUser;

  onChildAdded(q, function (s: DataSnapshot) {
    if ((window as any)._viewingPostId !== postId) return;
    var postViewContent = document.getElementById("postViewContent");
    if (!postViewContent || postViewContent.children.length === 0) return;
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

  onChildChanged(q, function (s: DataSnapshot) {
    if ((window as any)._viewingPostId !== postId) return;
    var postViewContent = document.getElementById("postViewContent");
    if (!postViewContent || postViewContent.children.length === 0) return;
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

  onChildRemoved(q, function (s: DataSnapshot) {
    if ((window as any)._viewingPostId !== postId) return;
    var postViewContent = document.getElementById("postViewContent");
    if (!postViewContent || postViewContent.children.length === 0) return;
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
}

/* ─────────────────── Yorum sayacını günceller ─────────────────── */

function _updatePostViewCommentCount(postId: string): void {
  var post = allPosts[postId];
  var count = getTotalCommentCount(post);
  document.querySelectorAll('[data-comment-count="' + postId + '"]').forEach(function (el) {
    el.textContent = String(count);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       SİLİNEN POST YÖNETİMİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _handleDeletedPostView(): void {
  sessionStorage.removeItem("_viewingPostId");
  sessionStorage.removeItem("_pvPreviousPage");
  sessionStorage.removeItem("_pvScrollTop");
  (window as any)._viewingPostId = null;
  _previousPage = null;
  _previousScrollTop = 0;

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


