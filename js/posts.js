/* POST SISTEMI */

const postText = document.getElementById("postText");
const postImageInput = document.getElementById("postImageInput");
const postImageBtn = document.getElementById("postImageBtn");
const publishPostBtn = document.getElementById("publishPostBtn");
const postImagePreview = document.getElementById("postImagePreview");
const postsFeed = document.getElementById("postsFeed");

let allPosts = {};
let selectedPostImage = null;

/* POST OLUSTURMA */

function createPost() {
  const text = (postText ? postText.value : "").trim();
  if (!text && !selectedPostImage) {
    if (window.showToast) showToast("Lütfen bir metin yazın veya görsel seçin.");
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
    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child("users/" + user.uid + "/posts/" + Date.now());
    const uploadTask = imageRef.put(selectedPostImage);

    uploadTask.on(
      "state_changed",
      null,
      function (error) {
        if (publishPostBtn) {
          publishPostBtn.disabled = false;
          publishPostBtn.textContent = "Yayınla";
        }
        if (window.showToast) showToast("Görsel yüklenemedi.");
      },
      function () {
        uploadTask.snapshot.ref.getDownloadURL().then(function (url) {
          postData.imageUrl = url;
          savePost(postData);
        });
      },
    );
  } else {
    savePost(postData);
  }
}

function savePost(postData) {
  addPostToFirebase(postData)
    .then(function () {
      if (postText) postText.value = "";
      selectedPostImage = null;
      if (postImagePreview) {
        postImagePreview.classList.add("hidden");
        postImagePreview.innerHTML = "";
      }
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      if (window.showToast) showToast("Gönderi yayınlandı!");
    })
    .catch(function () {
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayınla";
      }
      if (window.showToast) showToast("Gönderi yayınlanamadı.");
    });
}

/* GORSEL YUKLEME */

function handlePostImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    if (window.showToast) showToast("Lütfen geçerli bir görsel seçin.");
    return;
  }

  selectedPostImage = file;

  const reader = new FileReader();
  reader.onload = function (ev) {
    if (postImagePreview) {
      postImagePreview.innerHTML =
        '<div style="position:relative; display:inline-block;">' +
        '<img src="' + ev.target.result + '" style="max-width:100%; max-height:200px; border-radius:8px;" />' +
        '<button class="remove-post-image-btn" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.7); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>' +
        "</div>";
      postImagePreview.classList.remove("hidden");
    }
  };
  reader.readAsDataURL(file);
}

function removePostImage() {
  selectedPostImage = null;
  if (postImagePreview) {
    postImagePreview.classList.add("hidden");
    postImagePreview.innerHTML = "";
  }
  if (postImageInput) postImageInput.value = "";
}

/* POST HELPER FONKSIYONLARI */

function _createPostElement(postId, postData) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderPost(postId, postData);
  return wrapper.firstElementChild;
}

function _prependPostToFeed(postId, postData) {
  const feed = document.getElementById("postsFeed");
  if (!feed) return;
  const empty = feed.querySelector(".posts-empty");
  if (empty) empty.remove();
  const el = _createPostElement(postId, postData);
  el.style.opacity = "0";
  el.style.transform = "translateY(-8px)";
  el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  feed.insertBefore(el, feed.firstChild);
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

function _patchPostCard(postId, postData) {
  const existing = document.querySelector('[data-post-id="' + postId + '"]');
  if (!existing) return;
  const newEl = _createPostElement(postId, postData);
  existing.replaceWith(newEl);
}

function _softRemovePost(postId) {
  document.querySelectorAll('[data-post-id="' + postId + '"]').forEach(function (el) {
    el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(4px)";
    setTimeout(function () {
      el.remove();
    }, 320);
  });
}

function _onlyLikesChanged(oldPost, newPost) {
  const fields = ["content", "imageUrl", "username", "uid", "createdAt"];
  for (let i = 0; i < fields.length; i++) {
    if (oldPost[fields[i]] !== newPost[fields[i]]) return false;
  }
  return true;
}

function _patchPostLikes(postId, likes) {
  const currentUser = firebase.auth().currentUser;
  const likeCount = likes ? Object.keys(likes).length : 0;
  const liked = currentUser && likes && likes[currentUser.uid];

  document.querySelectorAll('[data-post-id="' + postId + '"]').forEach(function (card) {
    const btn = card.querySelector(".like-btn");
    if (!btn) return;
    btn.classList.toggle("liked", !!liked);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
    const textNodes = Array.from(btn.childNodes).filter(function (n) {
      return n.nodeType === 3;
    });
    if (textNodes.length) {
      textNodes[textNodes.length - 1].textContent = " " + likeCount;
    }
  });
}

/* POST RENDER ETME */

function renderPost(postId, postData) {
  if (!postData) {
    const el = document.querySelector('[data-post-id="' + postId + '"]');
    if (el) el.remove();
    return "";
  }

  const currentUser = firebase.auth().currentUser;
  const isOwnPost = currentUser && currentUser.uid === postData.uid;
  const liked = postData.likes && postData.likes[currentUser ? currentUser.uid : ""];

  const timeText = formatTimeAgo(postData.createdAt, postData.phraseIndex);
  const avatarUrl = postData.avatarUrl || "";
  const username = postData.username || "Kullanici";

  const escapedId = escAttr(postId + "");
  const commentCount = postData.comments ? Object.keys(postData.comments).length : 0;

  let html = '<div class="post-card" data-post-id="' + escapedId + '">';
  html += '<div class="post-header">';
  html += '<div class="post-avatar">';
  if (avatarUrl) {
    html += '<img src="' + escAttr(postData.avatarUrl) + '" alt="" />';
  } else {
    html +=
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>' +
      '<circle cx="12" cy="7" r="4"></circle>' +
      "</svg>";
  }
  html += "</div>";
  html += '<div class="post-user-info">';
  html += '<span class="post-username">' + escHtml(username) + "</span>";
  html += '<span class="post-time"> ' + escHtml(timeText) + "</span>";
  html += "</div>";

  if (isOwnPost) {
    html += '<button class="post-menu-btn">⋮</button>';
    html += '<div class="post-dropdown" id="postDropdown-' + escapedId + '">';
    html +=
      '<button class="post-dropdown-item delete">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">' +
      '<polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
      "</svg> Sil</button>";
    html += "</div>";
  }
  html += "</div>";

  html += '<div class="post-content">';
  if (postData.content) {
    html += '<div class="post-text">' + escHtml(postData.content) + "</div>";
  }
  if (postData.imageUrl) {
    html += '<div class="post-image">';
    html += '<img src="' + escAttr(postData.imageUrl) + '" alt="Gonderi gorseli" />';
    html += "</div>";
  }
  html += "</div>";

  html += '<div class="post-actions">';
  html += '<button class="post-action-btn like-btn ' + (liked ? "liked" : "") + '">';
  html +=
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (liked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2">' +
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  html += " " + (postData.likes ? Object.keys(postData.likes).length : 0) + "</button>";
  html += '<span class="post-actions-sep">|</span>';
  html += '<button class="post-action-btn comment-btn" data-post-id="' + escapedId + '">';
  html +=
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  html += " " + commentCount + "</button>";
  html += '<span class="post-date">' + escHtml(formatDateTime(postData.createdAt)) + "</span>";
  html += "</div>";

  /* ─────────────────── Yorum Bölümü ─────────────────── */
  html += '<div class="comment-section" id="commentSection-' + escapedId + '">';
  html += '<div class="comment-list" id="commentList-' + escapedId + '">';
  if (postData.comments) {
    const sortedCommentIds = Object.keys(postData.comments).sort(function (a, b) {
      return (postData.comments[b].createdAt || 0) - (postData.comments[a].createdAt || 0);
    });
    sortedCommentIds.forEach(function (cid) {
      html += renderComment(postId, cid, postData.comments[cid]);
    });
  }
  html += "</div>";
  html += '<div class="comment-input-area" id="commentInputArea-' + escapedId + '">';
  html += '<textarea class="comment-input" id="commentInput-' + escapedId + '" placeholder="Yorum yaz..." maxlength="280"></textarea>';
  html += '<button class="comment-send-btn" data-post-id="' + escapedId + '">Gönder</button>';
  html += "</div>";
  html += "</div>";

  html += "</div>";

  return html;
}

/* ─────────────────── Yorum HTML Oluştur ─────────────────── */

function renderComment(postId, commentId, commentData) {
  const escapedPostId = escAttr(postId);
  const escapedCommentId = escAttr(commentId);
  const escapedUsername = escAttr(commentData.username || "Kullanici");
  const escapedText = escHtml(commentData.text || "");
  const timeAgo = commentData.createdAt ? formatTimeAgo(commentData.createdAt, undefined, true) : "";

  const currentUser = firebase.auth().currentUser;
  const isOwner = currentUser && currentUser.uid === commentData.uid;
  const likeCount = commentData.likes ? Object.keys(commentData.likes).length : 0;
  const isLiked = currentUser && commentData.likes && commentData.likes[currentUser.uid];

  let html = '<div class="comment-item" data-comment-id="' + escapedCommentId + '">';
  html += '<div class="comment-body">';
  html += '<div class="comment-meta">';
  html += '<span class="comment-username">' + escapedUsername + "</span>";
  html += '<span class="comment-time">' + timeAgo + "</span>";
  if (isOwner) {
    html += '<button class="comment-delete-btn" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '" title="Sil">';
    html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    html += "</button>";
  }
  html += "</div>";
  html += '<div class="comment-text">' + escapedText + "</div>";
  html += '<div class="comment-actions">';
  html += '<button class="comment-action-btn like-comment-btn ' + (isLiked ? "liked" : "") + '" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="' + (isLiked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  html += " " + likeCount + "</button>";
  html += '<button class="comment-action-btn reply-btn" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '">Yanıtla</button>';

  const replyCount = commentData.replies ? Object.keys(commentData.replies).length : 0;
  if (replyCount > 0) {
    html += '<button class="toggle-replies-btn" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '">Yanıtları gör</button>';
  }
  html += "</div>";
  html += "</div>";
  html += "</div>";

  html += '<div class="replies-section" id="replies-' + escapedPostId + "-" + escapedCommentId + '">';
  if (commentData.replies) {
    const sortedReplyIds = Object.keys(commentData.replies).sort(function (a, b) {
      return (commentData.replies[a].createdAt || 0) - (commentData.replies[b].createdAt || 0);
    });
    sortedReplyIds.forEach(function (rid) {
      html += renderReply(postId, commentId, rid, commentData.replies[rid]);
    });
  }
  html += "</div>";

  html += '<div class="reply-input-inline" id="replyInput-' + escapedPostId + "-" + escapedCommentId + '">';
  html += '<div class="reply-input-area">';
  html += '<textarea class="reply-textarea" id="replyText-' + escapedPostId + "-" + escapedCommentId + '" placeholder="Yanıt yaz..." maxlength="280"></textarea>';
  html += '<div class="reply-input-actions">';
  html += '<button class="reply-cancel-btn" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '">İptal</button>';
  html += '<button class="reply-send-btn" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '">Yanıtla</button>';
  html += "</div></div></div>";

  html += "</div>";

  return html;
}

/* ─────────────────── Yanıt HTML Oluştur ─────────────────── */

function renderReply(postId, commentId, replyId, replyData) {
  const escapedPostId = escAttr(postId);
  const escapedCommentId = escAttr(commentId);
  const escapedReplyId = escAttr(replyId);
  const escapedUsername = escAttr(replyData.username || "Kullanici");
  const escapedText = escHtml(replyData.text || "");
  const timeAgo = replyData.createdAt ? formatTimeAgo(replyData.createdAt, undefined, true) : "";

  const currentUser = firebase.auth().currentUser;
  const isOwner = currentUser && currentUser.uid === replyData.uid;
  const likeCount = replyData.likes ? Object.keys(replyData.likes).length : 0;
  const isLiked = currentUser && replyData.likes && replyData.likes[currentUser.uid];

  let html = '<div class="reply-item" data-reply-id="' + escapedReplyId + '">';
  html += '<div class="reply-line"></div>';
  html += '<div class="reply-body">';
  html += '<div class="reply-meta">';
  html += '<span class="reply-username">' + escapedUsername + "</span>";
  html += '<span class="reply-time">' + timeAgo + "</span>";
  if (isOwner) {
    html += '<button class="comment-delete-btn delete-reply-btn" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '" data-reply-id="' + escapedReplyId + '" title="Sil">';
    html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    html += "</button>";
  }
  html += "</div>";
  html += '<div class="reply-text">' + escapedText + "</div>";
  html += '<button class="comment-action-btn like-reply-btn ' + (isLiked ? "liked" : "") + '" data-post-id="' + escapedPostId + '" data-comment-id="' + escapedCommentId + '" data-reply-id="' + escapedReplyId + '">';
  html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="' + (isLiked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  html += " " + likeCount + "</button>";
  html += "</div></div>";

  return html;
}

/* YORUM SISTEMI FONKSIYONLARI */

/* ─────────────────── Yorum Bölümünü Aç/Kapat ─────────────────── */

function toggleCommentSection(postId) {
  const section = document.getElementById("commentSection-" + postId);
  if (!section) return;
  section.classList.toggle("visible");

  if (section.classList.contains("visible") && !section.dataset.listenerInit) {
    initCommentsForPost(postId);
    section.dataset.listenerInit = "true";
  }
}

/* ─────────────────── Yorum Beğen/Beğenme ─────────────────── */

function toggleCommentLike(postId, commentId) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const post = allPosts[postId];
  if (!post || !post.comments || !post.comments[commentId]) return;

  const comment = post.comments[commentId];
  const alreadyLiked = comment.likes && comment.likes[user.uid];

  if (!comment.likes) comment.likes = {};
  if (alreadyLiked) {
    delete comment.likes[user.uid];
  } else {
    comment.likes[user.uid] = true;
  }

  _patchCommentLikes(postId, commentId, comment.likes);

  toggleCommentLike(postId, commentId, user.uid).catch(function () {
    if (alreadyLiked) {
      comment.likes[user.uid] = true;
    } else {
      delete comment.likes[user.uid];
    }
    _patchCommentLikes(postId, commentId, comment.likes);
    if (window.showToast) showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yorum Silme Onayı ─────────────────── */

function confirmDeleteComment(postId, commentId) {
  if (window.showConfirm) {
    showConfirm("Yorum silinsin mi?", function () {
      deleteCommentFromFirebase(postId, commentId)
        .then(function () {
          if (window.showToast) showToast("Yorum silindi.");
        })
        .catch(function () {
          if (window.showToast) showToast("Yorum silinemedi.", "error");
        });
    });
  }
}

/* ─────────────────── Yanıt Yazma Alanını Aç/Kapat ─────────────────── */

function toggleReplyInput(postId, commentId) {
  const replyInput = document.getElementById("replyInput-" + postId + "-" + commentId);
  if (!replyInput) return;
  const isVisible = replyInput.classList.contains("visible");

  document.querySelectorAll(".reply-input-inline.visible").forEach(function (el) {
    if (el !== replyInput) el.classList.remove("visible");
  });

  replyInput.classList.toggle("visible");
  if (!isVisible) {
    const textarea = replyInput.querySelector("textarea");
    if (textarea) textarea.focus();
  }
}

/* ─────────────────── Yanıt Beğen/Beğenme ─────────────────── */

function toggleReplyLike(postId, commentId, replyId) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const post = allPosts[postId];
  if (!post || !post.comments || !post.comments[commentId] || !post.comments[commentId].replies || !post.comments[commentId].replies[replyId]) return;

  const reply = post.comments[commentId].replies[replyId];
  const alreadyLiked = reply.likes && reply.likes[user.uid];

  if (!reply.likes) reply.likes = {};
  if (alreadyLiked) {
    delete reply.likes[user.uid];
  } else {
    reply.likes[user.uid] = true;
  }

  _patchReplyLikes(postId, commentId, replyId, reply.likes);

  toggleReplyLike(postId, commentId, replyId, user.uid).catch(function () {
    if (alreadyLiked) {
      reply.likes[user.uid] = true;
    } else {
      delete reply.likes[user.uid];
    }
    _patchReplyLikes(postId, commentId, replyId, reply.likes);
    if (window.showToast) showToast("Beğeni kaydedilemedi.", "error");
  });
}

/* ─────────────────── Yanıt Silme Onayı ─────────────────── */

function confirmDeleteReply(postId, commentId, replyId) {
  if (window.showConfirm) {
    showConfirm("Yanıt silinsin mi?", function () {
      deleteReplyFromFirebase(postId, commentId, replyId)
        .then(function () {
          if (window.showToast) showToast("Yanıt silindi.");
        })
        .catch(function () {
          if (window.showToast) showToast("Yanıt silinemedi.", "error");
        });
    });
  }
}

/* ─────────────────── Yanıtları Göster ─────────────────── */

function toggleRepliesSection(postId, commentId) {
  const repliesSection = document.getElementById("replies-" + postId + "-" + commentId);
  if (!repliesSection) return;
  repliesSection.classList.add("visible");

  const commentItem = document.querySelector('[data-comment-id="' + commentId + '"]');
  if (!commentItem) return;
  const toggleBtn = commentItem.querySelector(".toggle-replies-btn");
  if (toggleBtn) toggleBtn.style.display = "none";
}

/* ─────────────────── Yorum Beğeni DOM Güncellemesi ─────────────────── */

function _patchCommentLikes(postId, commentId, likes) {
  const likeCount = likes ? Object.keys(likes).length : 0;
  document.querySelectorAll('[data-post-id="' + postId + '"][data-comment-id="' + commentId + '"]').forEach(function (el) {
    const btn = el.querySelector(".like-comment-btn");
    if (!btn) return;
    btn.classList.toggle("liked", !!likeCount);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", likeCount ? "currentColor" : "none");
    const textNodes = Array.from(btn.childNodes).filter(function (n) {
      return n.nodeType === 3;
    });
    if (textNodes.length) {
      textNodes[textNodes.length - 1].textContent = " " + likeCount;
    }
  });
}

/* ─────────────────── Yanıt Beğeni DOM Güncellemesi ─────────────────── */

function _patchReplyLikes(postId, commentId, replyId, likes) {
  const likeCount = likes ? Object.keys(likes).length : 0;
  document.querySelectorAll('[data-post-id="' + postId + '"][data-comment-id="' + commentId + '"][data-reply-id="' + replyId + '"]').forEach(function (el) {
    const btn = el.querySelector(".like-reply-btn");
    if (!btn) return;
    btn.classList.toggle("liked", !!likeCount);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", likeCount ? "currentColor" : "none");
    const textNodes = Array.from(btn.childNodes).filter(function (n) {
      return n.nodeType === 3;
    });
    if (textNodes.length) {
      textNodes[textNodes.length - 1].textContent = " " + likeCount;
    }
  });
}

/* ─────────────────── Yorumları Firebaseden Dinle ─────────────────── */

function initCommentsForPost(postId) {
  const currentUser = firebase.auth().currentUser;
  const userAvatar = currentUser ? currentUser.photoURL || "" : "";

  initCommentsListener(postId, function (commentId, commentData, type) {
    const post = allPosts[postId];
    if (!post) return;

    if (type === "removed") {
      if (!post.comments) post.comments = {};
      delete post.comments[commentId];
      const commentEl = document.querySelector('[data-comment-id="' + commentId + '"]');
      if (commentEl) commentEl.remove();
      updateCommentCount(postId);
      return;
    }

    if (!post.comments) post.comments = {};
    post.comments[commentId] = commentData;

    if (!commentData.avatarUrl && commentData.uid === currentUser?.uid) {
      commentData.avatarUrl = userAvatar;
    }

    const commentList = document.getElementById("commentList-" + postId);
    if (!commentList) return;

    if (type === "added") {
      const postEl = document.getElementById("commentSection-" + postId);
      if (!postEl || !postEl.classList.contains("visible")) {
        updateCommentCount(postId);
        return;
      }
      const existing = commentList.querySelector('[data-comment-id="' + commentId + '"]');
      if (!existing) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderComment(postId, commentId, commentData);
        commentList.appendChild(wrapper.firstElementChild);
        updateCommentCount(postId);
      }
    } else if (type === "changed") {
      const existing = commentList.querySelector('[data-comment-id="' + commentId + '"]');
      if (existing) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderComment(postId, commentId, commentData);
        existing.replaceWith(wrapper.firstElementChild);
      }
    }
  });
}

/* ─────────────────── Yorum Sayısını Güncelle ─────────────────── */

function updateCommentCount(postId) {
  const post = allPosts[postId];
  if (!post) return;
  const count = post.comments ? Object.keys(post.comments).length : 0;

  const commentBtn = document.querySelector('[data-post-id="' + postId + '"] .comment-btn');
  if (commentBtn) {
    commentBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ' +
      count;
  }
}

/* ─────────────────── Yeni Yorum Gönder ─────────────────── */

function submitComment(postId) {
  const input = document.getElementById("commentInput-" + postId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  const commentData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    avatarUrl: user.photoURL || "",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  addCommentToFirebase(postId, commentData)
    .then(function () {
      input.value = "";
      if (window.showToast) showToast("Yorum eklendi", "success");
    })
    .catch(function () {
      if (window.showToast) showToast("Yorum eklenemedi", "error");
    });
}

/* ─────────────────── Yanıt Gönder ─────────────────── */

function submitReply(postId, commentId) {
  const input = document.getElementById("replyText-" + postId + "-" + commentId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  const replyData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    avatarUrl: user.photoURL || "",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  addReplyToFirebase(postId, commentId, replyData)
    .then(function () {
      input.value = "";
      const replyInput = document.getElementById("replyInput-" + postId + "-" + commentId);
      if (replyInput) replyInput.classList.remove("visible");
      if (window.showToast) showToast("Yanıt eklendi", "success");
    })
    .catch(function () {
      if (window.showToast) showToast("Yanıt eklenemedi", "error");
    });
}

/* POST EVENT DELEGATION */

document.addEventListener("click", function (e) {
  // Like butonu
  const likeBtn = e.target.closest(".post-action-btn.like-btn");
  if (likeBtn) {
    const postCard = likeBtn.closest("[data-post-id]");
    if (postCard) toggleLike(postCard.dataset.postId);
    return;
  }

  // Menu butonu
  const menuBtn = e.target.closest(".post-menu-btn");
  if (menuBtn) {
    const postCard2 = menuBtn.closest("[data-post-id]");
    if (postCard2) togglePostMenu(postCard2.dataset.postId);
    return;
  }

  // Delete butonu
  const deleteBtn = e.target.closest(".post-dropdown-item.delete");
  if (deleteBtn) {
    const postCard3 = deleteBtn.closest("[data-post-id]");
    if (postCard3) confirmDeletePost(postCard3.dataset.postId);
    return;
  }

  // Remove post image butonu
  if (e.target.closest(".remove-post-image-btn")) {
    removePostImage();
    return;
  }

  // Yorumlar butonu (post altında yorum bölümünü aç/kapat)
  const commentBtn = e.target.closest(".post-action-btn.comment-btn");
  if (commentBtn) {
    const postId = commentBtn.dataset.postId || commentBtn.getAttribute("data-post-id");
    toggleCommentSection(postId);
    return;
  }

  // Yorum beğen butonu
  const likeCommentBtn = e.target.closest(".comment-action-btn.like-comment-btn");
  if (likeCommentBtn) {
    const postId = likeCommentBtn.dataset.postId;
    const commentId = likeCommentBtn.dataset.commentId;
    toggleCommentLike(postId, commentId);
    return;
  }

  // Yorum sil butonu
  const deleteCommentBtn = e.target.closest(".comment-delete-btn");
  if (deleteCommentBtn) {
    const postId = deleteCommentBtn.dataset.postId;
    const commentId = deleteCommentBtn.dataset.commentId;
    confirmDeleteComment(postId, commentId);
    return;
  }

  // Yanıtla butonu (yorum altında yanıt yazma alanını aç)
  const replyBtn = e.target.closest(".comment-action-btn.reply-btn");
  if (replyBtn) {
    const postId = replyBtn.dataset.postId;
    const commentId = replyBtn.dataset.commentId;
    toggleReplyInput(postId, commentId);
    return;
  }

  // Yanıt beğen butonu
  const likeReplyBtn = e.target.closest(".comment-action-btn.like-reply-btn");
  if (likeReplyBtn) {
    const postId = likeReplyBtn.dataset.postId;
    const commentId = likeReplyBtn.dataset.commentId;
    const replyId = likeReplyBtn.dataset.replyId;
    toggleReplyLike(postId, commentId, replyId);
    return;
  }

  // Yanıt sil butonu
  const deleteReplyBtn = e.target.closest(".comment-delete-btn.delete-reply-btn");
  if (deleteReplyBtn) {
    const postId = deleteReplyBtn.dataset.postId;
    const commentId = deleteReplyBtn.dataset.commentId;
    const replyId = deleteReplyBtn.dataset.replyId;
    confirmDeleteReply(postId, commentId, replyId);
    return;
  }

  // Yanıtları göster
  const toggleRepliesBtn = e.target.closest(".toggle-replies-btn");
  if (toggleRepliesBtn) {
    const postId = toggleRepliesBtn.dataset.postId;
    const commentId = toggleRepliesBtn.dataset.commentId;
    toggleRepliesSection(postId, commentId);
    return;
  }

  // Yeni yorum gönder
  const commentSendBtn = e.target.closest(".comment-send-btn");
  if (commentSendBtn) {
    const postId = commentSendBtn.dataset.postId;
    submitComment(postId);
    return;
  }

  // Yorum input alanında Enter ile gönder
  const commentInput = e.target.closest(".comment-input");
  if (commentInput && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const postId = commentInput.id.replace("commentInput-", "");
    submitComment(postId);
    return;
  }

  // Yanıt gönder
  const replySendBtn = e.target.closest(".reply-send-btn");
  if (replySendBtn) {
    const postId = replySendBtn.dataset.postId;
    const commentId = replySendBtn.dataset.commentId;
    submitReply(postId, commentId);
    return;
  }

  // Yanıt iptal
  const replyCancelBtn = e.target.closest(".reply-cancel-btn");
  if (replyCancelBtn) {
    const postId = replyCancelBtn.dataset.postId;
    const commentId = replyCancelBtn.dataset.commentId;
    const replyInput = document.getElementById("replyInput-" + postId + "-" + commentId);
    if (replyInput) replyInput.classList.remove("visible");
    return;
  }

  // Yanıt input alanında Enter ile gönder
  const replyTextarea = e.target.closest(".reply-textarea");
  if (replyTextarea && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const ids = replyTextarea.id.replace("replyText-", "").split("-");
    if (ids.length === 2) {
      submitReply(ids[0], ids[1]);
    }
    return;
  }
});

/* YORUM ZAMAN GUNCELLEME */

setInterval(function () {
  document.querySelectorAll(".comment-time").forEach(function (el) {
    const commentItem = el.closest(".comment-item");
    if (!commentItem) return;
    const postCard = commentItem.closest("[data-post-id]");
    if (!postCard) return;
    const postId = postCard.dataset.postId;
    const commentId = commentItem.dataset.commentId;
    const post = allPosts[postId];
    if (!post || !post.comments || !post.comments[commentId]) return;
    el.textContent = " " + formatTimeAgo(post.comments[commentId].createdAt, undefined, true);
  });

  document.querySelectorAll(".reply-time").forEach(function (el) {
    const replyItem = el.closest(".reply-item");
    if (!replyItem) return;
    const commentItem = replyItem.closest(".comment-item");
    if (!commentItem) return;
    const postCard = commentItem.closest("[data-post-id]");
    if (!postCard) return;
    const postId = postCard.dataset.postId;
    const commentId = commentItem.dataset.commentId;
    const replyId = replyItem.dataset.replyId;
    const post = allPosts[postId];
    if (!post || !post.comments || !post.comments[commentId] || !post.comments[commentId].replies || !post.comments[commentId].replies[replyId]) return;
    el.textContent = " " + formatTimeAgo(post.comments[commentId].replies[replyId].createdAt, undefined, true);
  });
}, 60 * 1000);

/* POST ZAMAN GUNCELLEME */

setInterval(function () {
  document.querySelectorAll(".post-time").forEach(function (el) {
    const card = el.closest("[data-post-id]");
    if (!card) return;
    const postId = card.dataset.postId;
    const post = allPosts[postId];
    if (!post) return;
    el.textContent = " " + formatTimeAgo(post.createdAt, post.phraseIndex);
  });
}, 60 * 1000);

/* ─────────────────── Giriş Yapıldığında ─────────────────── */

function initPosts() {
  initPostsListener(function (postId, postData, type) {
    const currentUser = firebase.auth().currentUser;

    if (type === "removed") {
      delete allPosts[postId];
      if (document.querySelector('[data-post-id="' + postId + '"]')) {
        _softRemovePost(postId);
      }
      return;
    }

    if (type === "added") {
      allPosts[postId] = postData;
      if (postData && currentUser && postData.uid === currentUser.uid) {
        allPosts[postId].avatarUrl = currentUser.photoURL || "";
      }
      _prependPostToFeed(postId, postData);
      return;
    }

    if (type === "changed") {
      const oldPost = allPosts[postId];
      allPosts[postId] = postData;
      if (oldPost && _onlyLikesChanged(oldPost, postData)) {
        _patchPostLikes(postId, postData.likes);
      } else if (document.querySelector('[data-post-id="' + postId + '"]')) {
        _patchPostCard(postId, postData);
      }

      // Yorum sayısını güncelle
      const commentCount = postData.comments ? Object.keys(postData.comments).length : 0;
      const commentBtn = document.querySelector('[data-post-id="' + postId + '"] .comment-btn');
      if (commentBtn) {
        commentBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ' +
          commentCount;
      }
    }
  });
}
