/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL SEKMESİ YÜKLEME                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sabitler ─────────────────── */

const TAB = {
  USER_POSTS: "userPostsTab",
  LIKED_POSTS: "likedPostsTab",
};

const EMPTY_STATE = {
  userPostsTab: { emoji: "📰", text: "Henüz Gönderi Yayınlamadın" },
  likedPostsTab: { emoji: "💔", text: "Henüz Kimseyi Beğenmedin" },
};

/* ─────────────────── Profil Durum Yönetimi ─────────────────── */

let _profileTab = null;
let _userPostsVisible = new Set();
let _userPostsOldestTs = null;
let _hasMoreUserPosts = false;
let _loadingMoreUserPosts = false;

let _likedPostsVisible = new Set();
let _likedPostsOldestTs = null;
let _hasMoreLikedPosts = false;
let _loadingMoreLikedPosts = false;

function _showProfileLoading(tab) {
  tab.innerHTML = '<div class="posts-loading">Yükleniyor...</div>';
}

function _showProfileEmptyState(tab, tabId) {
  var s = EMPTY_STATE[tabId];
  tab.innerHTML =
    '<div class="empty-state profile-empty-state">' +
    '<div class="empty-icon">' +
    s.emoji +
    "</div>" +
    '<div class="empty-text">' +
    s.text +
    "</div>" +
    "</div>";
}

function _showProfileContent(tab) {
  var loading = tab.querySelector(".posts-loading");
  var empty = tab.querySelector(".profile-empty-state");
  if (loading) loading.remove();
  if (empty) empty.remove();
}

/* ─────────────────── Profil sekmesi değiştğinde çağrılır ─────────────────── */

function updateProfilePosts() {
  switchProfileTab("user-posts");
}

function switchProfileTab(tabName) {
  _profileTab = tabName;

  if (tabName === "user-posts") {
    _initUserPostsTab();
  } else if (tabName === "liked-posts") {
    _initLikedPostsTab();
  }
}

/* ─────────────────── Gönderilerim sekmesini başlatır ─────────────────── */

function _initUserPostsTab() {
  if (_userPostsVisible.size > 0) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  const tab = document.getElementById("userPostsTab");
  if (!tab) return;

  _showProfileLoading(tab);
  _userPostsVisible.clear();
  _userPostsOldestTs = null;
  _hasMoreUserPosts = false;
  _loadingMoreUserPosts = false;
  _removeProfileLoadMoreBtn("userPostsTab");

  _loadPostsChunk({
    fetcher: (uid, size, ts) => getUserPostsOnce(uid, size, ts),
    tabId: "userPostsTab",
    btnId: "loadMoreUserPostsBtn",
    getVisible: () => _userPostsVisible,
    setOldestTs: (ts) => {
      _userPostsOldestTs = ts;
    },
    getOldestTs: () => _userPostsOldestTs,
    setHasMore: (v) => {
      _hasMoreUserPosts = v;
    },
    getHasMore: () => _hasMoreUserPosts,
    setLoading: (v) => {
      _loadingMoreUserPosts = v;
    },
    getLoading: () => _loadingMoreUserPosts,
  });
}

/* ─────────────────── Beğenilerim sekmesini başlatır ─────────────────── */

function _initLikedPostsTab() {
  if (_likedPostsVisible.size > 0) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  const tab = document.getElementById("likedPostsTab");
  if (!tab) return;

  _showProfileLoading(tab);
  _likedPostsVisible.clear();
  _likedPostsOldestTs = null;
  _hasMoreLikedPosts = false;
  _loadingMoreLikedPosts = false;
  _removeProfileLoadMoreBtn("likedPostsTab");

  _loadPostsChunk({
    fetcher: (uid, size, ts) => getUserLikesOnce(uid, size, ts),
    tabId: "likedPostsTab",
    btnId: "loadMoreLikedPostsBtn",
    getVisible: () => _likedPostsVisible,
    setOldestTs: (ts) => {
      _likedPostsOldestTs = ts;
    },
    getOldestTs: () => _likedPostsOldestTs,
    setHasMore: (v) => {
      _hasMoreLikedPosts = v;
    },
    getHasMore: () => _hasMoreLikedPosts,
    setLoading: (v) => {
      _loadingMoreLikedPosts = v;
    },
    getLoading: () => _loadingMoreLikedPosts,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     BİRLEŞTİRİLMİŞ LOAD POSTS CHUNK                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ortak yükleme fonksiyonu  ─────────────────── */

function _loadPostsChunk(cfg) {
  if (cfg.getLoading()) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  cfg.setLoading(true);
  const tab = document.getElementById(cfg.tabId);
  const btn = document.getElementById(cfg.btnId);

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";
  }

  cfg
    .fetcher(user.uid, PAGE_SIZE, cfg.getOldestTs())
    .then(function (map) {
      const ids = Object.keys(map).sort(function (a, b) {
        return map[b] - map[a];
      });

      if (ids.length === 0) {
        if (tab) _showProfileEmptyState(tab, cfg.tabId);
        cfg.setHasMore(false);
        _removeProfileLoadMoreBtn(cfg.tabId);
        cfg.setLoading(false);
        return;
      }

      const postIds = ids
        .filter(function (id) {
          return !cfg.getVisible().has(id);
        })
        .slice(0, PAGE_SIZE);

      return getPostsByIds(postIds, allPosts).then(function (posts) {
        if (tab) _showProfileContent(tab);
        postIds.forEach(function (id) {
          if (posts[id]) {
            allPosts[id] = posts[id];
            cfg.getVisible().add(id);
            if (tab) {
              const wrapper = document.createElement("div");
              wrapper.innerHTML = _renderPostHTML(id, posts[id]);
              const el = wrapper.firstElementChild;
              tab.appendChild(el);
              _initPostImage(el.querySelector(".post-img-lazy"));
            }
          }
        });

        if (ids.length >= PAGE_SIZE) {
          cfg.setOldestTs(map[ids[ids.length - 1]]);
          cfg.setHasMore(true);
          _renderProfileLoadMoreBtn(cfg.tabId, function () {
            _loadPostsChunk(cfg);
          });
        } else {
          cfg.setHasMore(false);
          _removeProfileLoadMoreBtn(cfg.tabId);
        }

        cfg.setLoading(false);
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Daha Fazla Göster";
        }
      });
    })
    .catch(function () {
      cfg.setLoading(false);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Daha Fazla Göster";
      }
      if (typeof showToast === "function")
        showToast(
          cfg.tabId === "userPostsTab"
            ? "Gönderiler yüklenemedi, lütfen tekrar deneyin."
            : "Beğeniler yüklenemedi, lütfen tekrar deneyin.",
          "error",
        );
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       USER LIKES DEĞİŞİKLİĞİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── UserLikes Değişikliği Callback ─────────────────── */

function _onUserLikesChanged(postId, value, type) {
  if (type === "added") {
    if (!_likedPostsVisible.has(postId)) {
      _likedPostsVisible.add(postId);
    }
    if (_profileTab === "liked-posts" && _currentPage === "profile") {
      _appendOrPrependToProfileTab("likedPostsTab", postId);
    }
  } else if (type === "removed") {
    if (_likedPostsVisible.has(postId)) _likedPostsVisible.delete(postId);
    if (_profileTab === "liked-posts") {
      document
        .querySelectorAll('#likedPostsTab [data-post-id="' + postId + '"]')
        .forEach(function (el) {
          el.style.opacity = "0";
          el.style.transform = "translateY(4px)";
          setTimeout(function () {
            el.remove();
            const tab = document.getElementById("likedPostsTab");
            if (tab && tab.children.length === 0) {
              _showProfileEmptyState(tab, "likedPostsTab");
            }
          }, 320);
        });
    }
  }
}

function _onUserPostsChanged(postId, value, type) {
  if (type === "added") {
    if (!_userPostsVisible.has(postId)) {
      _userPostsVisible.add(postId);
    }
    if (_profileTab === "user-posts" && _currentPage === "profile") {
      _appendOrPrependToProfileTab("userPostsTab", postId);
    }
  } else if (type === "removed") {
    if (_userPostsVisible.has(postId)) _userPostsVisible.delete(postId);
    if (_profileTab === "user-posts") {
      document
        .querySelectorAll('#userPostsTab [data-post-id="' + postId + '"]')
        .forEach(function (el) {
          el.style.opacity = "0";
          el.style.transform = "translateY(4px)";
          setTimeout(function () {
            el.remove();
            const tab = document.getElementById("userPostsTab");
            if (tab && tab.children.length === 0) {
              _showProfileEmptyState(tab, "userPostsTab");
            }
          }, 320);
        });
    }
  }
}

function _appendOrPrependToProfileTab(tabId, postId) {
  const tab = document.getElementById(tabId);
  if (!tab) return;
  if (tab.querySelector('[data-post-id="' + postId + '"]')) return;
  if (allPosts[postId]) {
    _showProfileContent(tab);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = _renderPostHTML(postId, allPosts[postId]);
    const el = wrapper.firstElementChild;
    tab.appendChild(el);
    _initPostImage(el.querySelector(".post-img-lazy"));
    return;
  }
  getPostsByIds([postId], allPosts).then(function (posts) {
    if (posts[postId]) {
      allPosts[postId] = posts[postId];
      _showProfileContent(tab);
      const wrapper = document.createElement("div");
      wrapper.innerHTML = _renderPostHTML(postId, posts[postId]);
      const el = wrapper.firstElementChild;
      tab.appendChild(el);
      _initPostImage(el.querySelector(".post-img-lazy"));
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PROFİL LOAD MORE BUTONU                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Profil sekmesi için "Daha Fazla" butonu ─────────────────── */

function _renderProfileLoadMoreBtn(tabId, onClick) {
  const btnId =
    tabId === TAB.USER_POSTS ? "loadMoreUserPostsBtn" : "loadMoreLikedPostsBtn";
  const tab = document.getElementById(tabId);
  if (tab) renderLoadMoreBtn(tab, btnId, onClick);
}

function _removeProfileLoadMoreBtn(tabId) {
  const btnId =
    tabId === TAB.USER_POSTS ? "loadMoreUserPostsBtn" : "loadMoreLikedPostsBtn";
  removeLoadMoreBtn(btnId);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       SAYFA DEĞİŞİMİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa değiştğinde profil sekmelerini temizle ─────────────────── */

function _onPageChange(pageName) {
  if (pageName !== "profile") {
    _profileTab = null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PROFİL SEKME BUTONLARI                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const tab = this.dataset.tab;
    document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    this.classList.add("active");
    document
      .querySelectorAll("#profilePage .tab-content")
      .forEach(function (c) {
        c.classList.remove("active");
      });
    const target = document.getElementById(
      tab === "user-posts" ? TAB.USER_POSTS : TAB.LIKED_POSTS,
    );
    if (target) target.classList.add("active");
    switchProfileTab(tab);
  });
});
