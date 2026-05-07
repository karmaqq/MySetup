/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            POST RENDER + FEED YÖNETİMİ                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Feed Durum Değişkenleri ─────────────────── */

let allPosts = {};
let _postsListenerActive = false;
let _postsQuery = null;

let _oldestLoadedKey = null;
let _hasMorePosts = false;
let _loadingMore = false;

/* ─────────────────── Post Kartı HTML Döndürür ─────────────────── */

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         POST SİSTEMİ BAŞLATMA                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Giriş yapıldığında çağrılır ─────────────────── */

function initPosts() {
  _teardownPosts();
  allPosts = {};
  _oldestLoadedKey = null;
  _hasMorePosts = false;
  _loadingMore = false;

  if (postsFeed) postsFeed.innerHTML = "";
  _removeLoadMoreBtn();
  _startPostsListener();

  if (typeof _startTimeUpdateInterval === "function") {
    _startTimeUpdateInterval();
  }

  const user = firebase.auth().currentUser;
  if (user) {
    initUserLikesListener(user.uid, _onUserLikesChanged);
    initUserPostsListener(user.uid, _onUserPostsChanged);
  }
}

/* ─────────────────── Çıkış yapıldığında çağrılır ─────────────────── */

function _teardownPosts() {
  if (_postsQuery) {
    _postsQuery.off();
    _postsQuery = null;
  }
  if (postsRef) postsRef.off();
  _postsListenerActive = false;
  allPosts = {};
  if (postsFeed) postsFeed.innerHTML = "";
  _removeLoadMoreBtn();

  Object.values(_commentListenerRefs).forEach(function (ref) { ref.off(); });
  for (var k in _commentListenerRefs) delete _commentListenerRefs[k];
  removeUserPostsListener();
  removeUserLikesListener();

  if (typeof _stopTimeUpdateInterval === "function") {
    _stopTimeUpdateInterval();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         SAYFALAMA VE LİSTENER                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İlk 20 postu yükler, listener başlatır ─────────────────── */

function _startPostsListener() {
  const ref = postsRef.orderByChild("createdAt");

  ref.limitToLast(PAGE_SIZE).once("value", function (snap) {

    const raw = snap.val() || {};
    const keys = Object.keys(raw).sort(function (a, b) {
      return (raw[b].createdAt || 0) - (raw[a].createdAt || 0);
    });

    keys.forEach(function (id) {
      allPosts[id] = raw[id];
    });

    if (keys.length > 0) {
      _oldestLoadedKey = keys[keys.length - 1];
    }

    if (postsFeed) postsFeed.innerHTML = "";
    keys.forEach(function (id) {
      _appendPostToFeed(id, raw[id]);
    });

    if (keys.length === 0) {
      _renderEmptyFeed();
    }

    _checkHasMorePosts(
      raw[_oldestLoadedKey] ? raw[_oldestLoadedKey].createdAt : null,
    );

    _listenForNewPosts(ref);
  });
}

/* ─────────────────── Veritabanında daha fazla post var mı kontrol eder ─────────────────── */

function _checkHasMorePosts(oldestTs) {
  if (!oldestTs) {
    _hasMorePosts = false;
    _removeLoadMoreBtn();
    return;
  }
  postsRef
    .orderByChild("createdAt")
    .endAt(oldestTs - 1)
    .limitToLast(1)
    .once("value", function (snap) {
      _hasMorePosts = snap.exists();
      if (_hasMorePosts) {
        _renderLoadMoreBtn();
      } else {
        _removeLoadMoreBtn();
      }
    });
}

/* ─────────────────── Yeni gelen postları gerçek zamanlı dinler ─────────────────── */

function _listenForNewPosts(ref) {
  if (_postsListenerActive) return;
  _postsListenerActive = true;

  const newestTs = _getNewestTimestamp();
  const liveQuery = ref.startAt(newestTs + 1);
  _postsQuery = liveQuery;

  liveQuery.on("child_added", function (s) {
    const id = s.key;
    const data = s.val();
    allPosts[id] = data;
    const empty = postsFeed && postsFeed.querySelector(".posts-empty");
    if (empty) empty.remove();
    _prependPostToFeed(id, data);
  });

  postsRef.on("child_changed", function (s) {
    const id = s.key;
    if (!allPosts[id]) return;
    const oldData = allPosts[id];
    allPosts[id] = s.val();
    if (_onlyLikesChanged(oldData, s.val())) {
      _patchPostLikes(id, s.val().likes);
    } else {
      _patchPostCard(id, s.val());
    }
  });

  postsRef.on("child_removed", function (s) {
    const id = s.key;
    if (_commentListenerRefs[id]) {
      _commentListenerRefs[id].off();
      delete _commentListenerRefs[id];
    }
    delete allPosts[id];
    _softRemovePost(id);
  });
}

/* ─────────────────── En yeni yüklü postun timestamp'i ─────────────────── */

function _getNewestTimestamp() {
  let max = 0;
  Object.values(allPosts).forEach(function (p) {
    if ((p.createdAt || 0) > max) max = p.createdAt;
  });
  return max;
}

/* ─────────────────── Daha fazla post yükle (sayfalama) ─────────────────── */

function _loadMorePosts() {
  if (_loadingMore || !_hasMorePosts || !_oldestLoadedKey) return;
  _loadingMore = true;

  const btn = document.getElementById("loadMoreBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";
  }

  const oldestData = allPosts[_oldestLoadedKey];
  const oldestTs = oldestData ? oldestData.createdAt : null;
  if (!oldestTs) {
    _loadingMore = false;
    return;
  }

  postsRef
    .orderByChild("createdAt")
    .endAt(oldestTs - 1)
    .limitToLast(PAGE_SIZE)
    .once("value", function (snap) {

      const raw = snap.val() || {};
      const keys = Object.keys(raw).sort(function (a, b) {
        return (raw[b].createdAt || 0) - (raw[a].createdAt || 0);
      });

      keys.forEach(function (id) {
        allPosts[id] = raw[id];
        _appendPostToFeed(id, raw[id]);
      });

      if (keys.length > 0) {
        _oldestLoadedKey = keys[keys.length - 1];
        const newOldestTs = raw[_oldestLoadedKey].createdAt;
        _checkHasMorePosts(newOldestTs);
      } else {
        _hasMorePosts = false;
        _removeLoadMoreBtn();
      }

      _loadingMore = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Daha Fazla Göster";
      }
    });
}

/* ─────────────────── Daha fazla yükle butonunu render eder ─────────────────── */

function _renderLoadMoreBtn() {
  if (document.getElementById("loadMoreBtn")) return;
  const btn = document.createElement("button");
  btn.id = "loadMoreBtn";
  btn.className = "load-more-btn";
  btn.textContent = "Daha Fazla Göster";
  btn.onclick = _loadMorePosts;
  postsFeed &&
    postsFeed.parentNode &&
    postsFeed.parentNode.insertBefore(btn, postsFeed.nextSibling);
}

function _removeLoadMoreBtn() {
  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.remove();
}
