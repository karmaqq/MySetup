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
/*                           SİLME İŞLEMLERİ                                */
/* ═════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post silme onayı ─────────────────── */

function _confirmDeletePost(postId) {
  var postData = allPosts[postId];
  showConfirm("Bu gönderiyi silmek istediğine emin misin?", function () {
    deletePostFromFirebase(postId, postData)
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
    const thread = document.getElementById(
      "commentThread-" + postId + "-" + commentId,
    );
    if (thread) {
      thread.style.transition = "opacity 0.3s, transform 0.3s";
      thread.style.opacity = "0";
      thread.style.transform = "translateY(4px)";
      setTimeout(function () {
        thread.remove();
      }, 320);
    }
    deleteCommentFromFirebase(postId, commentId)
      .then(function () {
        showToast("Yorum silindi.", "success");
      })
      .catch(function () {
        showToast("Yorum silinemedi.", "error");
        if (thread) {
          thread.style.opacity = "1";
          thread.style.transform = "translateY(0)";
        }
      });
  });
}

/* ─────────────────── Yanıt silme onayı ─────────────────── */

function _confirmDeleteReply(postId, commentId, replyId) {
  showConfirm("Yanıt silinsin mi?", function () {
    const replyEl = document.querySelector(
      '[data-reply-id="' + replyId + '"]',
    );
    if (replyEl) {
      replyEl.style.transition = "opacity 0.3s, transform 0.3s";
      replyEl.style.opacity = "0";
      replyEl.style.transform = "translateY(4px)";
      setTimeout(function () {
        replyEl.remove();
      }, 320);
    }
    deleteReplyFromFirebase(postId, commentId, replyId)
      .then(function () {
        showToast("Yanıt silindi.", "success");
      })
      .catch(function () {
        showToast("Yanıt silinemedi.", "error");
        if (replyEl) {
          replyEl.style.opacity = "1";
          replyEl.style.transform = "translateY(0)";
        }
      });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       YORUM / YANIT GÖNDERİMİ                         */
/* ═════════════════════════════════════════════════════════════════════════ */

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
/* ═════════════════════════════════════════════════════════════════════════ */

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
/* ═════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yorum bölümü açıldığında Firebase'i dinler ─────────────────── */

function _initCommentListener(postId) {
  if (_commentListenerRefs[postId]) return;
  const ref = postsRef
    .child(postId)
    .child("comments")
    .orderByChild("createdAt");
  _commentListenerRefs[postId] = ref;

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
/* ═════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sadece beğeni değişimi mi kontrol et ─────────────────── */

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
/* ═════════════════════════════════════════════════════════════════════════ */

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

  if (action === "toggle-comments") {
    _toggleCommentSection(btn.dataset.id);
    return;
  }

  if (action === "submit-comment") {
    _submitComposer(btn);
    return;
  }

  if (action === "cancel-reply") {
    const postCard = btn.closest(".post-card");
    if (postCard) {
      _cancelReplyMode(postCard.dataset.postId);
      const input = postCard.querySelector(".comment-input-field");
      if (input) input.value = "";
    }
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           ZAMAN GÜNCELLEMESİ                             */
/* ═════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Her dakika zaman etiketlerini günceller ─────────────────── */

setInterval(function () {
  if (
    typeof _currentPage !== "undefined" &&
    _currentPage !== "home" &&
    _currentPage !== "profile"
  )
    return;

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
