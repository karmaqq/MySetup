/*--- zorunlu - agents.md yorum kurallarına uy ---*/

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
    (postData.username || "?").charAt(0).toUpperCase() +
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

  html += '<div class="post-body">';
  if (postData.content)
    html += '<div class="post-text">' + escHtml(postData.content) + "</div>";
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
    '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>';
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
  html += (user ? (user.displayName || "?").charAt(0).toUpperCase() : "?");
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
    (commentData.username || "?").charAt(0).toUpperCase() +
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
    html += '<div class="comment-dropdown">';
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
    '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>';
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
    (replyData.username || "?").charAt(0).toUpperCase() +
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
    html += '<div class="comment-dropdown">';
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
    '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>';
  html += " <span>" + likeCount + "</span></button>";
  html += "</div>";
  html += "</div></div>";
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        FEED DOM İŞLEMLERİ                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Görsel yüklendiğinde aspect ratio ayarla ─────────────────── */

function _initPostImage(img) {
  if (!img) return;
  if (img.complete) {
    _handlePostImageLoad(img);
  } else {
    img.addEventListener("load", function () {
      _handlePostImageLoad(img);
    });
  }
}

function _handlePostImageLoad(img) {
  var r = img.naturalWidth / img.naturalHeight;
  var p = img.parentElement;
  if (!p) return;
  p.classList.toggle("landscape", r > 1.2);
  p.classList.toggle("portrait", r < 0.8);
  p.classList.toggle("square", r >= 0.8 && r <= 1.2);
}

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
  _initPostImage(el.querySelector(".post-img-lazy"));
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
  _initPostImage(el.querySelector(".post-img-lazy"));
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
  _initPostImage(newEl.querySelector(".post-img-lazy"));
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
