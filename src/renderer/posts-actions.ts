/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BEĞENİ İŞLEMLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allPosts } from "./posts-render";
import { showToast } from "./io";
import {
  _confirmDeletePost,
  _confirmDeleteComment,
  _confirmDeleteReply,
} from "./io";
import {
  togglePostLike,
  addCommentToFirebase,
  toggleCommentLike,
  toggleReplyLike,
} from "./firebase-post";
import { _patchPostLikes } from "./posts-render";
import {
  _patchCommentLikeBtn,
  _patchReplyLikeBtn,
  _renderCommentThreadHTML,
} from "./post-comment";
import {
  getPostCards,
  _commentListenerRefs,
  _currentPage,
  escHtml,
  formatTimeAgo,
  _onlyCommentLikesChanged,
  getTotalCommentCount,
} from "./utils";
import { _removePostImage } from "./posts-create";

/* ─────────────────── Post beğeni toggle ─────────────────── */

function _togglePostLike(postId: string): void {
  const user = firebase.auth().currentUser;
  if (!user) return;
  togglePostLike(postId, user.uid).catch(function () {
    showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yorum beğeni toggle (optimistic) ─────────────────── */

function _toggleCommentLike(postId: string, commentId: string): void {
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
/*                       YORUM / YANIT GÖNDERİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Composer'daki mesajı gönderir ─────────────────── */

function _submitComposer(btn: HTMLElement): void {
  const postCard = btn.closest(".post-card") as HTMLElement | null;
  if (!postCard) return;
  const postId = postCard.dataset.postId;
  if (!postId) return;
  const input = postCard.querySelector(
    ".comment-input-field",
  ) as HTMLTextAreaElement | null;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  const baseData: Record<string, any> = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  addCommentToFirebase(postId, baseData)
    .then(function () {
      input.value = "";
      showToast("Yorum eklendi", "success");
    })
    .catch(function () {
      showToast("Yorum eklenemedi", "error");
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         YORUM BÖLÜMÜ AÇ / KAPAT                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yanıtlar bölümünü aç/kapat ─────────────────── */

function _openRepliesSection(postId: string, commentId: string): void {
  var activePage = document.querySelector(
    ".page-content.active",
  ) as HTMLElement | null;
  var card = activePage
    ? activePage.querySelector('[data-post-id="' + postId + '"]')
    : document.querySelector('[data-post-id="' + postId + '"]');
  if (!card) return;
  const sec = card.querySelector(
    "#replies-" + postId + "-" + commentId,
  ) as HTMLElement | null;
  const btn = card.querySelector(
    "#toggleReplies-" + postId + "-" + commentId,
  ) as HTMLElement | null;
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

function _initCommentListener(postId: string): void {
  if ((window as any)._viewingPostId === postId) return;
  if (_commentListenerRefs[postId]) return;
  const keys = Object.keys(_commentListenerRefs);
  if (keys.length >= 10) {
    const oldest = keys[0];
    (_commentListenerRefs[oldest] as any).off();
    delete _commentListenerRefs[oldest];
  }
  const postsRef = firebase.database().ref("posts");
  const q = postsRef.child(postId).child("comments").orderByChild("createdAt");
  _commentListenerRefs[postId] = q as any;
  const _currentUser = firebase.auth().currentUser;

  q.on("child_added", function (s) {
    const cid = s.key;
    const data = s.val() as any;
    if (!cid) return;
    const post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    if (post.comments[cid]) return;
    post.comments[cid] = data;

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
        );
        const child = wrapper.firstElementChild;
        if (child) list.appendChild(child);
      }
    });
    _updateCommentCount(postId);
  });

  q.on("child_changed", function (s) {
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
  });

  q.on("child_removed", function (s: firebase.database.DataSnapshot) {
    const cid = s.key;
    if (!cid) return;
    const post = allPosts[postId];
    if (post && post.comments) delete post.comments[cid];
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
  user: firebase.User | null,
): void {
  if (!existingEl || !existingEl.isConnected) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderCommentThreadHTML(
    postId,
    commentId,
    commentData,
    user,
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
    const spans = card.querySelectorAll('[class*="comment-count-"]');
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

/* ─────────────────── Textarea Enter ile gönder ─────────────────── */

document.addEventListener("keydown", function (e: KeyboardEvent) {
  if (e.key !== "Enter" || e.shiftKey) return;
  const target = e.target as HTMLElement;
  if (!target.classList.contains("comment-input-field")) return;
  const postCard = target.closest(".post-card") as HTMLElement | null;
  if (!postCard) return;
  e.preventDefault();
  const btn = postCard.querySelector(".comment-send-btn") as HTMLElement | null;
  if (btn) _submitComposer(btn);
});

/* ─────────────────── Textarea içeriğine göre gönder butonu göster/gizle ─────────────────── */

document.addEventListener("input", function (e: Event) {
  const target = e.target as HTMLElement;
  if (!target.classList.contains("comment-input-field")) return;
  const postCard = target.closest(".post-card") as HTMLElement | null;
  if (!postCard) return;
  const btn = postCard.querySelector(".comment-send-btn") as HTMLElement | null;
  if (btn)
    btn.classList.toggle(
      "visible",
      (target as HTMLTextAreaElement).value.trim().length > 0,
    );
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           ZAMAN GÜNCELLEMESİ                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Zaman güncelleme interval kontrolü ─────────────────── */

let _timeUpdateInterval: number | null = null;
let _visibilityListenerRegistered = false;

function _startTimeUpdateInterval(): void {
  if (_timeUpdateInterval) clearInterval(_timeUpdateInterval);
  _timeUpdateInterval = window.setInterval(
    function () {
      if (
        _currentPage !== "home" &&
        _currentPage !== "profile" &&
        _currentPage !== "postView"
      )
        return;

      if (document.hidden) return;

      const postCards = document.querySelectorAll("[data-post-id]");
      if (!postCards.length) return;
      postCards.forEach(function (card) {
        const post = allPosts[(card as HTMLElement).dataset.postId!];
        if (!post) return;

        const postTimeEl = card.querySelector(
          ":scope > .post-header .post-time",
        );
        if (postTimeEl) {
          postTimeEl.textContent = formatTimeAgo(
            post.createdAt,
            post.phraseIndex,
          );
        }

        const comments = post.comments || {};
        Object.keys(comments).forEach(function (cid) {
          const commentEl = card.querySelector(`[data-comment-id="${cid}"]`);
          if (!commentEl) return;
          const commentTimeEl = commentEl.querySelector(".comment-time");
          if (commentTimeEl) {
            commentTimeEl.textContent = formatTimeAgo(
              comments[cid].createdAt,
              undefined,
              true,
            );
          }
          const replies = comments[cid].replies || {};
          Object.keys(replies).forEach(function (rid) {
            const replyTimeEl = commentEl.querySelector(
              `[data-reply-id="${rid}"] .reply-time`,
            );
            if (replyTimeEl) {
              replyTimeEl.textContent = formatTimeAgo(
                replies[rid].createdAt,
                undefined,
                true,
              );
            }
          });
        });
      });
    },
    5 * 60 * 1000,
  );
}

function _stopTimeUpdateInterval(): void {
  if (_timeUpdateInterval) {
    clearInterval(_timeUpdateInterval);
    _timeUpdateInterval = null;
  }
}

/* ─── Window'a ata (posts-render.ts'den typeof kontrolü ile erişilir) ─── */

(window as any)._startTimeUpdateInterval = _startTimeUpdateInterval;
(window as any)._stopTimeUpdateInterval = _stopTimeUpdateInterval;

if (!_visibilityListenerRegistered) {
  _visibilityListenerRegistered = true;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      _stopTimeUpdateInterval();
    } else if ((window as any)._postsListenerActive) {
      _startTimeUpdateInterval();
    }
  });
}
