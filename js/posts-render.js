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

  html += '<div class="post-header post-header-link" data-action="open-post-view" data-id="' + pid + '">';
  html +=
    '<div class="post-avatar">' +
    getAvatarLetter(postData.username) +
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

  html += '<div class="post-body post-body-link" data-action="open-post-view" data-id="' + pid + '">';
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
  html += ' <span class="post-like-count-' + pid + '">' + likeCount + '</span></button>';
  html +=
    '<button class="post-action-btn comment-btn" data-action="open-post-view" data-id="' +
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

  html += "</div>";
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
    const span = btn.querySelector(".post-like-count-" + postId);
    if (span) span.textContent = likeCount;
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
