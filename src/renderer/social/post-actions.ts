/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BEĞENİ İŞLEMLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { query, Query, DataSnapshot, off, onChildAdded, onChildChanged, onChildRemoved, get, orderByChild, child } from "firebase/database";
import { User } from "firebase/auth";
import { allPosts } from "./post-render";
import { db } from "../core/firebase-init";
import { showToast } from "../core/global-fn";
import {
  _confirmDeletePost,
  _confirmDeleteComment,
  _confirmDeleteReply,
} from "../inventory/io";
import { togglePostLike } from "../data/firebase-post";
import { toggleCommentLike, toggleReplyLike } from "../data/firebase-comment";
import { _patchPostLikes } from "./post-render";
import {
  _patchCommentLikeBtn,
  _patchReplyLikeBtn,
  _renderCommentThreadHTML,
} from "./post-comment";
import {
  _commentListenerRefs,
  _commentListenerOrder,
  currentUser,
} from "../core/app-state";
import { _onlyCommentLikesChanged } from "../core/global-ut";
import { getPostCards, getTotalCommentCount } from "../core/global-fn";
import { _removePostImage } from "./post-create";

/* ─────────────────── Post beğeni toggle ─────────────────── */

function _togglePostLike(postId: string): void {
  const user = currentUser;
  if (!user) return;
  const post = allPosts[postId];
  if (!post) return;
  if (!post.likes) post.likes = {};
  const had = !!post.likes[user.uid];
  if (had) {
    delete post.likes[user.uid];
  } else {
    post.likes[user.uid] = true;
  }
  _patchPostLikes(postId, post.likes, user);
  togglePostLike(postId, user.uid).catch(function () {
    get(child(child(child(db.postsRef!, postId), "likes"), user.uid))
      .then(function (snap) {
        if (snap.val() === null) {
          delete post.likes[user.uid];
        } else {
          post.likes[user.uid] = true;
        }
        _patchPostLikes(postId, post.likes, user);
      });
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yorum beğeni toggle (optimistic) ─────────────────── */

function _toggleCommentLike(postId: string, commentId: string): void {
  const user = currentUser;
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

  _patchCommentLikeBtn(postId, commentId, comment.likes, user);

  toggleCommentLike(postId, commentId, user.uid).catch(function () {
    if (had) {
      comment.likes[user.uid] = true;
    } else {
      delete comment.likes[user.uid];
    }
    _patchCommentLikeBtn(postId, commentId, comment.likes, user);
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yanıt beğeni toggle (optimistic) ─────────────────── */

function _toggleReplyLike(
  postId: string,
  commentId: string,
  replyId: string,
): void {
  const user = currentUser;
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

  _patchReplyLikeBtn(postId, commentId, replyId, reply.likes, user);

  toggleReplyLike(postId, commentId, replyId, user.uid).catch(function () {
    if (had) {
      reply.likes[user.uid] = true;
    } else {
      delete reply.likes[user.uid];
    }
    _patchReplyLikeBtn(postId, commentId, replyId, reply.likes, user);
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         YORUM BÖLÜMÜ AÇ / KAPAT                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yanıtlar bölümünü aç/kapat ─────────────────── */

function _openRepliesSection(postId: string, commentId: string): void {
  const sec = document.getElementById(
    "replies-" + postId + "-" + commentId,
  ) as HTMLElement | null;
  const btn = document.getElementById(
    "toggleReplies-" + postId + "-" + commentId,
  ) as HTMLElement | null;
  if (!sec || !btn) return;

  const isOpen = !sec.classList.contains("hidden");
  sec.classList.toggle("hidden");
  btn.textContent = isOpen ? "yanıtları gör" : "yanıtları gizle";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    GERÇEK ZAMANLI YORUM LİSTENER                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum bölümü açıldığında Firebase'i dinler ─────────────────── */

function _touchListener(postId: string): void {
  var idx = _commentListenerOrder.indexOf(postId);
  if (idx > -1) _commentListenerOrder.splice(idx, 1);
  _commentListenerOrder.push(postId);
}

function _initCommentListener(postId: string): void {
  if ((window as any)._viewingPostId === postId) return;
  if (_commentListenerRefs[postId]) {
    _touchListener(postId);
    return;
  }
  if (_commentListenerOrder.length >= 5) {
    var lru = _commentListenerOrder.shift();
    if (lru && _commentListenerRefs[lru]) {
      off(_commentListenerRefs[lru]);
      delete _commentListenerRefs[lru];
      getPostCards(lru).forEach(function (card) {
        var sec = card.querySelector(".comment-section");
        if (sec) sec.classList.remove("visible");
        var list = card.querySelector('[id="commentList-' + lru + '"]');
        if (list) list.innerHTML = "";
        var btn = card.querySelector(".comment-btn");
        if (btn) btn.classList.remove("active");
      });
    }
  }
  _touchListener(postId);
  const q: Query = query(child(child(db.postsRef!, postId), "comments"), orderByChild("createdAt"));
  _commentListenerRefs[postId] = q;
  const _currentUser = currentUser;

  onChildAdded(q, function (s) {
    const cid = s.key;
    const data = s.val() as any;
    if (!cid) return;
    const post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    if (post.comments[cid]) return;

    post.comments[cid] = data;

    const isPostOwner = _currentUser && post && _currentUser.uid === post.uid;
    getPostCards(postId).forEach(function (card) {
      const list = card.querySelector(
        "#commentList-" + postId,
      ) as HTMLElement | null;
      if (list) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = _renderCommentThreadHTML(
          postId,
          cid,
          data,
          _currentUser,
          isPostOwner,
        );
        const child = wrapper.firstElementChild;
        if (child) list.appendChild(child);
      }
    });
    _updateCommentCount(postId);
  });

  onChildChanged(q, function (s) {
    const cid = s.key;
    const data = s.val() as any;
    if (!cid) return;
    const post = allPosts[postId];
    if (!post) return;
    const oldData = post.comments ? post.comments[cid] : null;
    if (!post.comments) post.comments = {};
    post.comments[cid] = data;
    if (oldData && _onlyCommentLikesChanged(oldData, data)) {
      getPostCards(postId).forEach(function (card) {
        _patchCommentLikeBtn(postId, cid, data.likes, _currentUser);
      });
      return;
    }
    const threads = document.querySelectorAll(
      '[data-post-id="' +
        postId +
        '"] [id="commentThread-' +
        postId +
        "-" +
        cid +
        '"]',
    );
    threads.forEach(function (thread) {
      _refreshCommentThread(postId, cid, data, thread, _currentUser);
    });
    _updateCommentCount(postId);
  });

  onChildRemoved(q, function (s: DataSnapshot) {
    const cid = s.key;
    if (!cid) return;
    const post = allPosts[postId];
    if (post && post.comments) {
      delete post.comments[cid];
    }
    const threads = document.querySelectorAll(
      '[data-post-id="' +
        postId +
        '"] [id="commentThread-' +
        postId +
        "-" +
        cid +
        '"]',
    );
    threads.forEach(function (thread) {
      thread.remove();
    });
    _updateCommentCount(postId);
  });
}

/* ─────────────────── Yorum thread'ini günceller ─────────────────── */

function _refreshCommentThread(
  postId: string,
  commentId: string,
  commentData: any,
  existingEl: Element,
  user: User | null,
): void {
  if (!existingEl || !existingEl.isConnected) return;
  const wrapper = document.createElement("div");
  const post = allPosts[postId];
  const isPostOwner = user && post && user.uid === post.uid;
  wrapper.innerHTML = _renderCommentThreadHTML(
    postId,
    commentId,
    commentData,
    user,
    isPostOwner,
  );
  const newEl = wrapper.firstElementChild;
  if (!newEl) return;
  const card = existingEl.closest(".post-card");
  const repliesSec = existingEl.querySelector(".replies-section");
  const wasOpen = repliesSec && !repliesSec.classList.contains("hidden");
  existingEl.replaceWith(newEl);
  if (wasOpen && card) {
    const newRepliesSec = newEl.querySelector(
      ".replies-section",
    ) as HTMLElement | null;
    if (newRepliesSec) newRepliesSec.classList.remove("hidden");
    const btn = newEl.querySelector(
      ".toggle-replies-btn",
    ) as HTMLElement | null;
    if (btn) {
      btn.style.display = "inline-flex";
      btn.textContent = "yanıtları gizle";
    }
  }
}

/* ─────────────────── Yorum sayısını günceller ─────────────────── */

function _updateCommentCount(postId: string): void {
  const post = allPosts[postId];
  const count = getTotalCommentCount(post);
  getPostCards(postId).forEach(function (card) {
    const spans = card.querySelectorAll(
      '[data-comment-count="' + postId + '"]',
    );
    spans.forEach(function (s) {
      s.textContent = String(count);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         OLAY DİNLEYİCİLERİ KURULUMU                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Tek delegasyon noktası: tüm post/yorum eylemleri ─────────────────── */

document.addEventListener("click", function (e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".remove-post-image-btn")) {
    _removePostImage();
    return;
  }

  const btn = target.closest("[data-action]") as HTMLElement | null;
  const action = btn ? btn.dataset.action : null;

  if (!btn) {
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    return;
  }

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
    document.querySelectorAll(".post-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    const dd = btn.nextElementSibling as HTMLElement | null;
    if (dd && dd.classList.contains("post-dropdown")) {
      dd.classList.toggle("active");
    }
    return;
  }

  if (action === "comment-menu") {
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    const commentItem = btn.closest(".comment-item") as HTMLElement | null;
    const dd = commentItem
      ? commentItem.querySelector(".comment-dropdown")
      : null;
    if (dd) {
      dd.classList.toggle("active");
    }
    return;
  }

  if (action === "reply-menu") {
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    const replyItem = btn.closest(".reply-item") as HTMLElement | null;
    const dd = replyItem ? replyItem.querySelector(".comment-dropdown") : null;
    if (dd) {
      dd.classList.toggle("active");
    }
    return;
  }

  if (action === "delete-post") {
    const postCard = btn.closest(".post-card") as HTMLElement | null;
    if (postCard && postCard.dataset.postId)
      _confirmDeletePost(postCard.dataset.postId);
    return;
  }

  if (action === "like-post") {
    const postCard = btn.closest(".post-card") as HTMLElement | null;
    if (postCard && postCard.dataset.postId)
      _togglePostLike(postCard.dataset.postId);
    return;
  }

  if (action === "view-profile") {
    if (typeof (window as any).openUserProfile === "function")
      (window as any).openUserProfile(btn.dataset.uid!);
    return;
  }

  if (action === "open-post-view") {
    const fromComment = btn.classList.contains("comment-btn");
    if (typeof (window as any).openPostView === "function")
      (window as any).openPostView(btn.dataset.id, fromComment);
    return;
  }

  if (action === "toggle-replies") {
    _openRepliesSection(btn.dataset.postId!, btn.dataset.commentId!);
    return;
  }

  if (action === "like-comment") {
    _toggleCommentLike(btn.dataset.postId!, btn.dataset.commentId!);
    return;
  }

  if (action === "like-reply") {
    _toggleReplyLike(
      btn.dataset.postId!,
      btn.dataset.commentId!,
      btn.dataset.replyId!,
    );
    return;
  }

  if (action === "delete-comment") {
    _confirmDeleteComment(btn.dataset.postId!, btn.dataset.commentId!);
    return;
  }

  if (action === "delete-reply") {
    _confirmDeleteReply(
      btn.dataset.postId!,
      btn.dataset.commentId!,
      btn.dataset.replyId!,
    );
    return;
  }
});
