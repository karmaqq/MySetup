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

  let html = `<div class="post-card" data-post-id="${pid}">`;

  html += `<div class="post-header post-header-link" data-action="open-post-view" data-id="${pid}">`;
  html += buildAvatarHTML(postData.username, "post-avatar");
  html += '<div class="post-user-info">';
  html += `<span class="post-username">${escHtml(postData.username || "Kullanici")}</span>`;
  html += `<span class="post-time">${escHtml(timeText)}</span>`;
  html += "</div>";

  html += buildPostMenuHTML(pid, isOwn);
  html += "</div>";

  html += `<div class="post-body post-body-link" data-action="open-post-view" data-id="${pid}">`;
  if (postData.content)
    html += `<div class="post-text">${escHtml(postData.content)}</div>`;
  if (postData.imageUrl) {
    html += `<div class="post-image"><img src="${escUrl(postData.imageUrl)}" alt="" class="post-img-lazy"></div>`;
  }
  html += "</div>";

  html += '<div class="post-actions">';
  html += `<button class="post-action-btn like-btn${liked ? " liked" : ""}" data-action="like-post" data-id="${pid}">`;
  html += `<svg viewBox="0 0 24 24" width="15" height="15" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>`;
  html += ` <span class="post-like-count-${pid}">${likeCount}</span></button>`;
  html += `<button class="post-action-btn comment-btn" data-action="open-post-view" data-id="${pid}">`;
  html += `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  html += ` <span class="comment-count-${pid}">${commentCount}</span></button>`;
  html += `<span class="post-date">${escHtml(formatDateTime(postData.createdAt))}</span>`;
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

/* ─────────────────── Post ekle (prepend/append, animasyonlu) ─────────────────── */

function _insertPostToFeed(postId, postData, prepend) {
  if (!postsFeed) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderPostHTML(postId, postData);
  const el = wrapper.firstElementChild;
  el.style.cssText = "opacity:0;transform:translateY(" + (prepend ? "-" : "") + "8px);transition:opacity 0.25s ease,transform 0.25s ease";
  if (prepend) {
    postsFeed.insertBefore(el, postsFeed.firstChild);
  } else {
    postsFeed.appendChild(el);
  }
  _initPostImage(el.querySelector(".post-img-lazy"));
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
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

function _patchPostLikes(postId, likes, user) {
  const likeCount = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const cards = getPostCards(postId);
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
  getPostCards(postId).forEach(function (el) {
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

  if (typeof _restorePostViewOnLoad === "function") {
    _restorePostViewOnLoad();
  }
}

/* ─────────────────── Çıkış yapıldığında çağrılır ─────────────────── */

function _teardownPosts() {
  if (_postsQuery) {
    _postsQuery.off();
    _postsQuery = null;
  }
  if (postsRef) {
    postsRef.off("child_changed", _onPostChanged);
    postsRef.off("child_removed", _onPostRemoved);
  }
  _postsListenerActive = false;
  window._postsReadyFired = false;
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
  if (postsRef) postsRef.off();
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
      _insertPostToFeed(id, raw[id], false);
    });

    if (keys.length === 0) {
      _renderEmptyFeed();
    }

    _checkHasMorePosts(
      raw[_oldestLoadedKey] ? raw[_oldestLoadedKey].createdAt : null,
    );

    _listenForNewPosts(ref);
    window._postsReadyFired = true;
    document.dispatchEvent(new CustomEvent("postsReady"));
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

function _onPostChanged(s) {
  const id = s.key;
  if (!allPosts[id]) return;
  const oldData = allPosts[id];
  allPosts[id] = s.val();
  const user = firebase.auth().currentUser;
  if (_onlyLikesChanged(oldData, s.val())) {
    _patchPostLikes(id, s.val().likes, user);
  } else {
    _patchPostCard(id, s.val());
  }
}

function _onPostRemoved(s) {
  const id = s.key;
  if (_commentListenerRefs[id]) {
    _commentListenerRefs[id].off();
    delete _commentListenerRefs[id];
  }
  delete allPosts[id];
  _softRemovePost(id);
}

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
    _insertPostToFeed(id, data, true);
  });

  postsRef.on("child_changed", _onPostChanged);
  postsRef.on("child_removed", _onPostRemoved);
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
        _insertPostToFeed(id, raw[id], false);
      });

      if (keys.length > 0) {
        _oldestLoadedKey = keys[keys.length - 1];
        if (keys.length < PAGE_SIZE) {
          _hasMorePosts = false;
          _removeLoadMoreBtn();
        } else {
          const newOldestTs = raw[_oldestLoadedKey].createdAt;
          _checkHasMorePosts(newOldestTs);
        }
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
  if (!postsFeed) return;
  renderLoadMoreBtn(postsFeed, "loadMoreBtn", _loadMorePosts);
}

function _removeLoadMoreBtn() {
  removeLoadMoreBtn("loadMoreBtn");
}
