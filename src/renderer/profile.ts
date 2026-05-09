/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL SEKMESİ YÜKLEME                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allPosts, _renderPostHTML, _initPostImage } from "./posts-render";
import { getUserPostsOnce, getUserLikesOnce, getPostsByIds } from "./firebase-post";
import { PAGE_SIZE, renderLoadMoreBtn, removeLoadMoreBtn, _currentPage } from "./utils";
import { showToast } from "./io";

/* ─────────────────── Sabitler ─────────────────── */

const TAB: Record<string, string> = {
  USER_POSTS: "userPostsTab",
  LIKED_POSTS: "likedPostsTab",
};

const EMPTY_STATE: Record<string, { emoji: string; text: string }> = {
  userPostsTab: { emoji: "📰", text: "Henüz Gönderi Yayınlamadın" },
  likedPostsTab: { emoji: "💔", text: "Henüz Kimseyi Beğenmedin" },
};

/* ─────────────────── Profil Durum Yönetimi ─────────────────── */

let _profileTab: string | null = null;
(window as any)._profileTab = _profileTab;
let _userPostsInitialized = false;
let _userPostsVisible = new Set<string>();
let _userPostsOldestTs: number | null = null;
let _hasMoreUserPosts = false;
let _loadingMoreUserPosts = false;

let _likedPostsInitialized = false;
let _likedPostsVisible = new Set<string>();
let _likedPostsOldestTs: number | null = null;
let _hasMoreLikedPosts = false;
let _loadingMoreLikedPosts = false;

function _showProfileLoading(tab: HTMLElement): void {
  tab.innerHTML = '<div class="posts-loading">Yükleniyor...</div>';
}

function _showProfileEmptyState(tab: HTMLElement, tabId: string): void {
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

function _showProfileContent(tab: HTMLElement): void {
  var loading = tab.querySelector(".posts-loading");
  var empty = tab.querySelector(".profile-empty-state");
  if (loading) loading.remove();
  if (empty) empty.remove();
}

/* ─────────────────── Profil sekmesi değiştğinde çağrılır ─────────────────── */

function updateProfilePosts(): void {
  if ((window as any)._pendingProfileTab) {
    switchProfileTab((window as any)._pendingProfileTab);
    (window as any)._pendingProfileTab = null;
  } else {
    switchProfileTab("user-posts");
  }
}
(window as any).updateProfilePosts = updateProfilePosts;

function _syncNewProfileItems(tab: HTMLElement, visibleSet: Set<string>): void {
  if (!tab) return;
  visibleSet.forEach(function (postId) {
    _appendOrPrependToProfileTab(tab.id, postId);
  });
}

function switchProfileTab(tabName: string): void {
  _profileTab = tabName;
  (window as any)._profileTab = tabName;

  if (tabName === "user-posts") {
    _initUserPostsTab();
  } else if (tabName === "liked-posts") {
    _initLikedPostsTab();
  }
}

/* ─────────────────── Gönderilerim sekmesini başlatır ─────────────────── */

function _initUserPostsTab(): void {
  const tab = document.getElementById("userPostsTab") as HTMLElement | null;
  if (!tab) return;

  if (_userPostsInitialized && tab.children.length > 0) {
    _syncNewProfileItems(tab, _userPostsVisible);
    return;
  }
  _userPostsInitialized = false;

  const user = firebase.auth().currentUser;
  if (!user) return;

  _showProfileLoading(tab);
  _userPostsVisible.clear();
  _userPostsOldestTs = null;
  _hasMoreUserPosts = false;
  _loadingMoreUserPosts = false;
  _removeProfileLoadMoreBtn("userPostsTab");

  _loadPostsChunk({
    fetcher: (uid: string, size?: number, ts?: number | null) => getUserPostsOnce(uid, size, ts),
    tabId: "userPostsTab",
    btnId: "loadMoreUserPostsBtn",
    getVisible: () => _userPostsVisible,
    setOldestTs: (ts: number | null) => {
      _userPostsOldestTs = ts;
    },
    getOldestTs: () => _userPostsOldestTs,
    setHasMore: (v: boolean) => {
      _hasMoreUserPosts = v;
    },
    getHasMore: () => _hasMoreUserPosts,
    setLoading: (v: boolean) => {
      _loadingMoreUserPosts = v;
    },
    getLoading: () => _loadingMoreUserPosts,
    onInitDone: function () {
      _userPostsInitialized = true;
    },
  });
}

/* ─────────────────── Beğenilerim sekmesini başlatır ─────────────────── */

function _initLikedPostsTab(): void {
  const tab = document.getElementById("likedPostsTab") as HTMLElement | null;
  if (!tab) return;

  if (_likedPostsInitialized && tab.children.length > 0) {
    _syncNewProfileItems(tab, _likedPostsVisible);
    return;
  }
  _likedPostsInitialized = false;

  const user = firebase.auth().currentUser;
  if (!user) return;

  _showProfileLoading(tab);
  _likedPostsVisible.clear();
  _likedPostsOldestTs = null;
  _hasMoreLikedPosts = false;
  _loadingMoreLikedPosts = false;
  _removeProfileLoadMoreBtn("likedPostsTab");

  _loadPostsChunk({
    fetcher: (uid: string, size?: number, ts?: number | null) => getUserLikesOnce(uid, size, ts),
    tabId: "likedPostsTab",
    btnId: "loadMoreLikedPostsBtn",
    getVisible: () => _likedPostsVisible,
    setOldestTs: (ts: number | null) => {
      _likedPostsOldestTs = ts;
    },
    getOldestTs: () => _likedPostsOldestTs,
    setHasMore: (v: boolean) => {
      _hasMoreLikedPosts = v;
    },
    getHasMore: () => _hasMoreLikedPosts,
    setLoading: (v: boolean) => {
      _loadingMoreLikedPosts = v;
    },
    getLoading: () => _loadingMoreLikedPosts,
    onInitDone: function () {
      _likedPostsInitialized = true;
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     BİRLEŞTİRİLMİŞ LOAD POSTS CHUNK                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ortak yükleme fonksiyonu  ─────────────────── */

interface PostsChunkConfig {
  fetcher: (uid: string, size?: number, ts?: number | null) => Promise<Record<string, any>>;
  tabId: string;
  btnId: string;
  getVisible: () => Set<string>;
  setOldestTs: (ts: number | null) => void;
  getOldestTs: () => number | null;
  setHasMore: (v: boolean) => void;
  getHasMore: () => boolean;
  setLoading: (v: boolean) => void;
  getLoading: () => boolean;
  onInitDone?: () => void;
}

function _loadPostsChunk(cfg: PostsChunkConfig): void {
  if (cfg.getLoading()) return;
  const user = firebase.auth().currentUser;
  if (!user) return;

  cfg.setLoading(true);
  const tab = document.getElementById(cfg.tabId) as HTMLElement | null;
  const btn = document.getElementById(cfg.btnId) as HTMLButtonElement | null;

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
              const el = wrapper.firstElementChild as HTMLElement;
              if (el) {
                tab.appendChild(el);
                _initPostImage(el.querySelector(".post-img-lazy") as HTMLImageElement | null);
              }
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
        if (typeof cfg.onInitDone === "function") cfg.onInitDone();
      });
    })
    .catch(function () {
      cfg.setLoading(false);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Daha Fazla Göster";
      }
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

function _onUserLikesChanged(postId: string, value: any, type: string): void {
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
          (el as HTMLElement).style.opacity = "0";
          (el as HTMLElement).style.transform = "translateY(4px)";
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
(window as any)._onUserLikesChanged = _onUserLikesChanged;

function _onUserPostsChanged(postId: string, value: any, type: string): void {
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
          (el as HTMLElement).style.opacity = "0";
          (el as HTMLElement).style.transform = "translateY(4px)";
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
(window as any)._onUserPostsChanged = _onUserPostsChanged;

function _appendOrPrependToProfileTab(tabId: string, postId: string): void {
  const tab = document.getElementById(tabId) as HTMLElement | null;
  if (!tab) return;
  if (tab.querySelector('[data-post-id="' + postId + '"]')) return;
  if (allPosts[postId]) {
    _showProfileContent(tab);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = _renderPostHTML(postId, allPosts[postId]);
    const el = wrapper.firstElementChild as HTMLElement;
    if (el) {
      tab.appendChild(el);
      _initPostImage(el.querySelector(".post-img-lazy") as HTMLImageElement | null);
    }
    return;
  }
  getPostsByIds([postId], allPosts).then(function (posts) {
    if (posts[postId]) {
      allPosts[postId] = posts[postId];
      _showProfileContent(tab);
      const wrapper = document.createElement("div");
      wrapper.innerHTML = _renderPostHTML(postId, posts[postId]);
      const el = wrapper.firstElementChild as HTMLElement;
      if (el) {
        tab.appendChild(el);
        _initPostImage(el.querySelector(".post-img-lazy") as HTMLImageElement | null);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PROFİL LOAD MORE BUTONU                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Profil sekmesi için "Daha Fazla" butonu ─────────────────── */

function _renderProfileLoadMoreBtn(tabId: string, onClick: () => void): void {
  const btnId: string =
    tabId === TAB.USER_POSTS ? "loadMoreUserPostsBtn" : "loadMoreLikedPostsBtn";
  const tab = document.getElementById(tabId) as HTMLElement | null;
  if (tab) renderLoadMoreBtn(tab, btnId, onClick);
}

function _removeProfileLoadMoreBtn(tabId: string): void {
  const btnId: string =
    tabId === TAB.USER_POSTS ? "loadMoreUserPostsBtn" : "loadMoreLikedPostsBtn";
  removeLoadMoreBtn(btnId);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       SAYFA DEĞİŞİMİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa değiştğinde profil sekmelerini temizle ─────────────────── */

function _onPageChange(pageName: string): void {
  if (pageName !== "profile") {
    _profileTab = null;
    (window as any)._profileTab = null;
  }
}
(window as any)._onPageChange = _onPageChange;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PROFİL SEKME BUTONLARI                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function (this: HTMLElement) {
    const tab = this.dataset.tab!;
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
