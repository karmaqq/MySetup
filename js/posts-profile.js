/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL SEKMESİ YÜKLEME                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Profil sekmesi değiştğinde çağrılır ─────────────────── */

function updateProfilePosts() {
  switchProfileTab("user-posts");
}

function switchProfileTab(tabName) {
  _profileTab = tabName;
  const userPostsTab = document.getElementById("userPostsTab");
  const likedPostsTab = document.getElementById("likedPostsTab");

  if (tabName === "user-posts") {
    _initUserPostsTab();
  } else if (tabName === "liked-posts") {
    _initLikedPostsTab();
  }
}

/* ─────────────────── Gönderilerim sekmesini başlatır ─────────────────── */

function _initUserPostsTab() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const tab = document.getElementById("userPostsTab");
  if (!tab) return;

  tab.innerHTML = '<div class="posts-empty">Yükleniyor...</div>';
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
    setOldestTs: (ts) => { _userPostsOldestTs = ts; },
    getOldestTs: () => _userPostsOldestTs,
    setHasMore: (v) => { _hasMoreUserPosts = v; },
    getHasMore: () => _hasMoreUserPosts,
    setLoading: (v) => { _loadingMoreUserPosts = v; },
    getLoading: () => _loadingMoreUserPosts,
  });
}

/* ─────────────────── Beğenilerim sekmesini başlatır ─────────────────── */

function _initLikedPostsTab() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const tab = document.getElementById("likedPostsTab");
  if (!tab) return;

  tab.innerHTML = '<div class="posts-empty">Yükleniyor...</div>';
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
    setOldestTs: (ts) => { _likedPostsOldestTs = ts; },
    getOldestTs: () => _likedPostsOldestTs,
    setHasMore: (v) => { _hasMoreLikedPosts = v; },
    getHasMore: () => _hasMoreLikedPosts,
    setLoading: (v) => { _loadingMoreLikedPosts = v; },
    getLoading: () => _loadingMoreLikedPosts,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     BİRLEŞTİRİLMİŞ LOAD POSTS CHUNK                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ortak yükleme fonksiyonu (BULGU-07 çözümü) ─────────────────── */

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

  cfg.fetcher(user.uid, PAGE_SIZE, cfg.getOldestTs())
    .then(function (map) {
      const ids = Object.keys(map).sort(function (a, b) {
        return map[b] - map[a];
      });

        if (ids.length === 0) {
          if (cfg.getVisible().size === 0 && tab) {
          tab.innerHTML =
            '<div class="posts-empty">' +
            (cfg.tabId === "userPostsTab"
              ? "Henüz gönderin yok."
              : "Henüz beğendiğin gönderi yok.") +
            "</div>";
        }
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

      return getPostsByIds(postIds).then(function (posts) {
        if (tab) tab.innerHTML = "";
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
          (cfg.tabId === "userPostsTab"
            ? "Gönderiler yüklenemedi, lütfen tekrar deneyin."
            : "Beğeniler yüklenemedi, lütfen tekrar deneyin."),
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
    if (_profileTab === "liked-posts") {
      _appendOrPrependToProfileTab("likedPostsTab", postId);
    }
  } else if (type === "removed") {
    if (_likedPostsVisible.has(postId)) _likedPostsVisible.delete(postId);
    if (_profileTab === "liked-posts") {
      const card = document.querySelector(
        '#likedPostsTab [data-post-id="' + postId + '"]',
      );
      if (card) card.remove();
    }
  }
}

function _appendOrPrependToProfileTab(tabId, postId) {
  const tab = document.getElementById(tabId);
  if (!tab) return;
  if (tab.querySelector('[data-post-id="' + postId + '"]')) return;
  getPostsByIds([postId]).then(function (posts) {
    if (posts[postId]) {
      allPosts[postId] = posts[postId];
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
    tabId === "userPostsTab"
      ? "loadMoreUserPostsBtn"
      : "loadMoreLikedPostsBtn";
  if (document.getElementById(btnId)) return;

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "load-more-btn";
  btn.textContent = "Daha Fazla Göster";
  btn.onclick = onClick;

  const tab = document.getElementById(tabId);
  if (tab && tab.parentNode) {
    tab.parentNode.insertBefore(btn, tab.nextSibling);
  }
}

function _removeProfileLoadMoreBtn(tabId) {
  const btnId =
    tabId === "userPostsTab"
      ? "loadMoreUserPostsBtn"
      : "loadMoreLikedPostsBtn";
  const btn = document.getElementById(btnId);
  if (btn) btn.remove();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       SAYFA DEĞİŞİMİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa değiştğinde profil sekmelerini temizle ─────────────────── */

function _onPageChange(pageName) {
  if (pageName !== "profile") {
    _profileTab = null;
    _userPostsVisible = new Set();
    _likedPostsVisible = new Set();
    const userPostsTab = document.getElementById("userPostsTab");
    const likedPostsTab = document.getElementById("likedPostsTab");
    if (userPostsTab) userPostsTab.innerHTML = "";
    if (likedPostsTab) likedPostsTab.innerHTML = "";
    _removeProfileLoadMoreBtn("userPostsTab");
    _removeProfileLoadMoreBtn("likedPostsTab");
    removeUserLikesListener();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PROFİL SEKME BUTONLARI                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const tab = this.dataset.tab;
    document
      .querySelectorAll(".profile-tabs .tab-btn")
      .forEach(function (b) {
        b.classList.remove("active");
      });
    this.classList.add("active");
    document
      .querySelectorAll("#profilePage .tab-content")
      .forEach(function (c) {
        c.classList.remove("active");
      });
    const target = document.getElementById(
      tab === "user-posts" ? "userPostsTab" : "likedPostsTab",
    );
    if (target) target.classList.add("active");
    switchProfileTab(tab);
  });
});
