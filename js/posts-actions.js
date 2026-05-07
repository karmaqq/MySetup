/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BEĞENİ İŞLEMLERİ                              */
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       YORUM / YANIT GÖNDERİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Composer Durum Değişkenleri ─────────────────── */

let _composerTargetPostId = null;
let _composerReplyCommentId = null;
let _composerReplyUsername = null;

/* ─────────────────── Composer'daki mesajı gönderir ─────────────────── */

function _submitComposer(btn) {
  const postCard = btn.closest(".post-card");
  if (!postCard) return;
  const postId = postCard.dataset.postId;
  const input = postCard.querySelector(".comment-input-field");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  const baseData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  const isReply = _composerTargetPostId === postId && _composerReplyCommentId;

  if (isReply) {
    const targetCommentId = _composerReplyCommentId;
    addReplyToFirebase(postId, targetCommentId, baseData)
      .then(function () {
        input.value = "";
        _cancelReplyMode(postId);
        showToast("Yanıt eklendi", "success");
        _openRepliesSection(postId, targetCommentId);
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

  var activePage = document.querySelector(".page-content.active");
  var card = activePage
    ? activePage.querySelector('[data-post-id="' + postId + '"]')
    : document.querySelector('[data-post-id="' + postId + '"]');
  if (!card) return;

  const target = card.querySelector("#replyTarget-" + postId);
  const targetText = card.querySelector("#replyTargetText-" + postId);
  if (target && targetText) {
    targetText.textContent = "@" + username + " yanıtlanıyor";
    target.classList.add("visible");
  }

  const input = card.querySelector("#commentInput-" + postId);
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

  var activePage = document.querySelector(".page-content.active");
  var card = activePage
    ? activePage.querySelector('[data-post-id="' + postId + '"]')
    : document.querySelector('[data-post-id="' + postId + '"]');
  if (!card) return;

  const target = card.querySelector("#replyTarget-" + postId);
  if (target) target.classList.remove("visible");

  const input = card.querySelector("#commentInput-" + postId);
  if (input) input.placeholder = "Yorum yaz...";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         YORUM BÖLÜMÜ AÇ / KAPAT                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yanıtlar bölümünü aç/kapat ─────────────────── */

function _openRepliesSection(postId, commentId) {
  var activePage = document.querySelector(".page-content.active");
  var card = activePage
    ? activePage.querySelector('[data-post-id="' + postId + '"]')
    : document.querySelector('[data-post-id="' + postId + '"]');
  if (!card) return;
  const sec = card.querySelector("#replies-" + postId + "-" + commentId);
  const btn = card.querySelector("#toggleReplies-" + postId + "-" + commentId);
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
  if (_viewingPostId === postId) return;
  if (_commentListenerRefs[postId]) return;
  const ref = postsRef
    .child(postId)
    .child("comments")
    .orderByChild("createdAt");
  _commentListenerRefs[postId] = ref;

  ref.on("child_added", function (s) {
    const cid = s.key;
    const data = s.val();
    const post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    if (post.comments[cid]) return;
    post.comments[cid] = data;

    getPostCards(postId).forEach(function (card) {
      const list = card.querySelector("#commentList-" + postId);
      if (list) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = _renderCommentThreadHTML(postId, cid, data);
        list.appendChild(wrapper.firstElementChild);
      }
    });
    _updateCommentCount(postId);
  });

  ref.on("child_changed", function (s) {
    const cid = s.key;
    const data = s.val();
    const post = allPosts[postId];
    if (!post) return;
    if (!post.comments) post.comments = {};
    post.comments[cid] = data;
    const threads = document.querySelectorAll(
      '[data-post-id="' + postId + '"] [id="commentThread-' + postId + "-" + cid + '"]',
    );
    threads.forEach(function (thread) {
      _refreshCommentThread(postId, cid, data, thread);
    });
  });

  ref.on("child_removed", function (s) {
    const cid = s.key;
    const post = allPosts[postId];
    if (post && post.comments) delete post.comments[cid];
    const threads = document.querySelectorAll(
      '[data-post-id="' + postId + '"] [id="commentThread-' + postId + "-" + cid + '"]',
    );
    threads.forEach(function (thread) {
      thread.remove();
    });
    _updateCommentCount(postId);
  });
}

/* ─────────────────── Yorum thread'ini günceller ─────────────────── */

function _refreshCommentThread(postId, commentId, commentData, existingEl) {
  if (!existingEl || !existingEl.isConnected) return;
  const card = existingEl.closest(".post-card");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderCommentThreadHTML(postId, commentId, commentData);
  const newEl = wrapper.firstElementChild;
  const repliesSec = existingEl.querySelector(".replies-section");
  const wasOpen = repliesSec && !repliesSec.classList.contains("hidden");
  existingEl.replaceWith(newEl);
  if (wasOpen && card) {
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
  const count = post && post.comments ? Object.keys(post.comments).length :0;
  getPostCards(postId).forEach(function (card) {
    const spans = card.querySelectorAll('[class*="comment-count-"]');
    spans.forEach(function (s) {
      s.textContent = count;
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            BEĞENİ İŞLEMLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sadece beğeni değişimi mi kontrol et ─────────────────── */

function _onlyLikesChanged(oldPost, newPost) {
  const primitiveFields = [
    "content",
    "imageUrl",
    "username",
    "uid",
    "createdAt",
  ];
  for (let i = 0; i < primitiveFields.length; i++) {
    if (oldPost[primitiveFields[i]] !== newPost[primitiveFields[i]])
      return false;
  }
  const oldCC = oldPost.comments ? Object.keys(oldPost.comments).length : 0;
  const newCC = newPost.comments ? Object.keys(newPost.comments).length : 0;
  return oldCC === newCC;
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
  if (e.target.closest(".remove-post-image-btn")) {
    _removePostImage();
    return;
  }

  const btn = e.target.closest("[data-action]");
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
    const dd = btn.nextElementSibling;
    if (dd && dd.classList.contains("post-dropdown")) {
      dd.classList.toggle("active");
    }
    return;
  }

  if (action === "comment-menu") {
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    const commentItem = btn.closest(".comment-item");
    const dd = commentItem ? commentItem.querySelector(".comment-dropdown") : null;
    if (dd) {
      dd.classList.toggle("active");
    }
    return;
  }

  if (action === "reply-menu") {
    document.querySelectorAll(".comment-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    const replyItem = btn.closest(".reply-item");
    const dd = replyItem ? replyItem.querySelector(".comment-dropdown") : null;
    if (dd) {
      dd.classList.toggle("active");
    }
    return;
  }

  if (action === "delete-post") {
    const postCard = btn.closest(".post-card");
    if (postCard) _confirmDeletePost(postCard.dataset.postId);
    return;
  }

  if (action === "like-post") {
    const postCard = btn.closest(".post-card");
    if (postCard) _togglePostLike(postCard.dataset.postId);
    return;
  }

  if (action === "open-post-view") {
    const fromComment = btn.classList.contains("comment-btn");
    if (typeof openPostView === "function")
      openPostView(btn.dataset.id, fromComment);
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

  if (action === "like-reply") {
    _toggleReplyLike(
      btn.dataset.postId,
      btn.dataset.commentId,
      btn.dataset.replyId,
    );
    return;
  }

  if (action === "delete-comment") {
    _confirmDeleteComment(btn.dataset.postId, btn.dataset.commentId);
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
  const postCard = target.closest(".post-card");
  if (!postCard) return;
  e.preventDefault();
  const btn = postCard.querySelector(".comment-send-btn");
  if (btn) _submitComposer(btn);
});

/* ─────────────────── Textarea içeriğine göre gönder butonu göster/gizle ─────────────────── */

document.addEventListener("input", function (e) {
  const target = e.target;
  if (!target.classList.contains("comment-input-field")) return;
  const postCard = target.closest(".post-card");
  if (!postCard) return;
  const btn = postCard.querySelector(".comment-send-btn");
  if (btn) btn.classList.toggle("visible", target.value.trim().length > 0);
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           ZAMAN GÜNCELLEMESİ                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Zaman güncelleme interval kontrolü ─────────────────── */

let _timeUpdateInterval = null;

function _startTimeUpdateInterval() {
  if (_timeUpdateInterval) clearInterval(_timeUpdateInterval);
  _timeUpdateInterval = setInterval(function () {
    if (
      typeof _currentPage !== "undefined" &&
      _currentPage !== "home" &&
      _currentPage !== "profile" &&
      _currentPage !== "postView"
    )
      return;

    if (document.hidden) return;

    const postCards = document.querySelectorAll("[data-post-id]");
    if (!postCards.length) return;
    postCards.forEach(function (card) {
      const post = allPosts[card.dataset.postId];
      if (!post) return;

      // Post zamanı
      const postTimeEl = card.querySelector(":scope > .post-header .post-time");
      if (postTimeEl) {
        postTimeEl.textContent = formatTimeAgo(post.createdAt, post.phraseIndex);
      }

      // Yorumlar ve yanıtlar
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
          const replyTimeEl = commentEl.querySelector(`[data-reply-id="${rid}"] .reply-time`);
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
  }, 5 * 60 * 1000);
}

function _stopTimeUpdateInterval() {
  if (_timeUpdateInterval) {
    clearInterval(_timeUpdateInterval);
    _timeUpdateInterval = null;
  }
}
