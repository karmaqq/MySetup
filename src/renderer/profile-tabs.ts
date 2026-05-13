/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL SEKMELERİ YÜKLEME                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allPosts, _renderPostHTML, _initPostImage } from "./posts-render";
import {
  getUserPostsOnce,
  getUserLikesOnce,
  getPostsByIds,
} from "./firebase-post";
import { PAGE_SIZE, _currentPage, currentUser } from "./app-state";
import { renderLoadMoreBtn, removeLoadMoreBtn, showToast } from "./global-fn";
import { escHtml } from "./global-ut";

/* ─────────────────── Sabitler ─────────────────── */

export const TAB: Record<string, string> = {
  USER_POSTS: "userPostsTab",
  LIKED_POSTS: "likedPostsTab",
};

const EMPTY_STATE: Record<string, { emoji: string; text: string }> = {
  userPostsTab: { emoji: "📰", text: "Henüz Gönderi Yayınlamadın" },
  likedPostsTab: { emoji: "💔", text: "Henüz Kimseyi Beğenmedin" },
};

/* ─────────────────── Tarih Yardımcıları ─────────────────── */

const _MONTHS_TR: string[] = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function _getDateKey(ts: number): string {
  const d = new Date(ts);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function _formatDateTR(ts: number): string {
  const d = new Date(ts);
  return d.getDate() + " " + _MONTHS_TR[d.getMonth()] + " " + d.getFullYear();
}

function _renderDateSep(ts: number): HTMLElement {
  const div = document.createElement("div");
  div.className = "profile-date-sep";
  div.setAttribute("data-date-key", _getDateKey(ts));
  div.innerHTML = "<span>" + escHtml(_formatDateTR(ts)) + "</span>";
  return div;
}

/* ─────────────────── Profil Durum Yönetimi ─────────────────── */

interface TabState {
  initialized: boolean;
  visible: Set<string>;
  oldestTs: number | null;
  hasMore: boolean;
  loading: boolean;
  timestamps: Map<string, number>;
}

function _emptyTabState(): TabState {
  return {
    initialized: false,
    visible: new Set(),
    oldestTs: null,
    hasMore: false,
    loading: false,
    timestamps: new Map(),
  };
}

let _profileTab: string | null = sessionStorage.getItem("_profileTab");
(window as any)._profileTab = _profileTab;
const _tabStates: Record<string, TabState> = {
  userPostsTab: _emptyTabState(),
  likedPostsTab: _emptyTabState(),
};

/* ─────────────────── Yetim Tarih Ayracı Temizleyici ─────────────────── */

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

function _syncNewProfileItems(
  tab: HTMLElement,
  visibleSet: Set<string>,
  tsMap: Map<string, number>,
): void {
  if (!tab) return;
  visibleSet.forEach(function (postId) {
    _prependToProfileTab(tab.id, postId, tsMap.get(postId));
  });
}

/* ─────────────────── Gönderilerim sekmesini başlatır ─────────────────── */

export function _initUserPostsTab(): void {
  const tab = document.getElementById("userPostsTab") as HTMLElement | null;
  if (!tab) return;
  const st = _tabStates["userPostsTab"];

  if (st.initialized && tab.children.length > 0) {
    _syncNewProfileItems(tab, st.visible, st.timestamps);
    return;
  }
  st.initialized = false;

  const user = currentUser;
  if (!user) return;

  _showProfileLoading(tab);
  st.visible.clear();
  st.timestamps.clear();
  st.oldestTs = null;
  st.hasMore = false;
  st.loading = false;
  _removeProfileLoadMoreBtn("userPostsTab");

  _loadPostsChunk({
    fetcher: (uid: string, size?: number, ts?: number | null) =>
      getUserPostsOnce(uid, size, ts),
    tabId: "userPostsTab",
    btnId: "loadMoreUserPostsBtn",
    getVisible: () => st.visible,
    setOldestTs: (ts: number | null) => { st.oldestTs = ts; },
    getOldestTs: () => st.oldestTs,
    setHasMore: (v: boolean) => { st.hasMore = v; },
    getHasMore: () => st.hasMore,
    setLoading: (v: boolean) => { st.loading = v; },
    getLoading: () => st.loading,
    onInitDone: function () { st.initialized = true; },
  });
}

/* ─────────────────── Beğenilerim sekmesini başlatır ─────────────────── */

export function _initLikedPostsTab(): void {
  const tab = document.getElementById("likedPostsTab") as HTMLElement | null;
  if (!tab) return;
  const st = _tabStates["likedPostsTab"];

  if (st.initialized && tab.children.length > 0) {
    _syncNewProfileItems(tab, st.visible, st.timestamps);
    return;
  }
  st.initialized = false;

  const user = currentUser;
  if (!user) return;

  _showProfileLoading(tab);
  st.visible.clear();
  st.timestamps.clear();
  st.oldestTs = null;
  st.hasMore = false;
  st.loading = false;
  _removeProfileLoadMoreBtn("likedPostsTab");

  _loadPostsChunk({
    fetcher: (uid: string, size?: number, ts?: number | null) =>
      getUserLikesOnce(uid, size, ts),
    tabId: "likedPostsTab",
    btnId: "loadMoreLikedPostsBtn",
    getVisible: () => st.visible,
    setOldestTs: (ts: number | null) => { st.oldestTs = ts; },
    getOldestTs: () => st.oldestTs,
    setHasMore: (v: boolean) => { st.hasMore = v; },
    getHasMore: () => st.hasMore,
    setLoading: (v: boolean) => { st.loading = v; },
    getLoading: () => st.loading,
    onInitDone: function () { st.initialized = true; },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     BİRLEŞTİRİLMİŞ LOAD POSTS CHUNK                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ortak yükleme fonksiyonu ─────────────────── */

interface PostsChunkConfig {
  fetcher: (
    uid: string,
    size?: number,
    ts?: number | null,
  ) => Promise<Record<string, any>>;
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
  const user = currentUser;
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
        let lastDateKey: string | null = null;
        if (tab) {
          const seps = tab.querySelectorAll(".profile-date-sep");
          if (seps.length > 0)
            lastDateKey = seps[seps.length - 1].getAttribute("data-date-key");
        }
        postIds.forEach(function (id) {
          if (posts[id]) {
            allPosts[id] = posts[id];
            cfg.getVisible().add(id);
            const ts = map[id];
            if (ts) {
              _tabStates[cfg.tabId].timestamps.set(id, ts);
            }
            if (tab) {
              if (tab.querySelector('[data-post-id="' + id + '"]')) return;
              if (ts) {
                const dateKey = _getDateKey(ts);
                if (dateKey !== lastDateKey) {
                  tab.appendChild(_renderDateSep(ts));
                  lastDateKey = dateKey;
                }
              }
              const wrapper = document.createElement("div");
              wrapper.innerHTML = _renderPostHTML(id, posts[id]);
              const el = wrapper.firstElementChild as HTMLElement;
              if (el) {
                tab.appendChild(el);
                _initPostImage(
                  el.querySelector(".post-img-lazy") as HTMLImageElement | null,
                );
              }
            }
          }
        });

        if (postIds.length >= PAGE_SIZE) {
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

export function _onUserLikesChanged(
  postId: string,
  value: any,
  type: string,
): void {
  var st = _tabStates["likedPostsTab"];
  if (type === "added") {
    st.timestamps.set(postId, value as number);
    if (!st.visible.has(postId)) {
      st.visible.add(postId);
    }
    if (_profileTab === "liked-posts" && _currentPage === "profile") {
      _prependToProfileTab("likedPostsTab", postId, value as number);
    }
  } else if (type === "removed") {
    st.timestamps.delete(postId);
    if (st.visible.has(postId)) st.visible.delete(postId);
    const likePost = allPosts[postId];
    if (likePost && likePost.likes) {
      if (currentUser) delete likePost.likes[currentUser.uid];
    }
    if (_profileTab === "liked-posts") {
      document
        .querySelectorAll('#likedPostsTab [data-post-id="' + postId + '"]')
        .forEach(function (el) {
          (el as HTMLElement).style.opacity = "0";
          (el as HTMLElement).style.transform = "translateY(4px)";
          setTimeout(function () {
            const prev = el.previousElementSibling;
            el.remove();
            const tab = document.getElementById("likedPostsTab");

            if (tab && prev && prev.classList.contains("profile-date-sep")) {
              let cursor = prev.nextElementSibling;
              let hasPost = false;
              while (cursor) {
                if (cursor.classList.contains("profile-date-sep")) break;
                if (cursor.classList.contains("post-card")) {
                  hasPost = true;
                  break;
                }
                cursor = cursor.nextElementSibling;
              }
              if (!hasPost) prev.remove();
            }
            if (tab && tab.children.length === 0) {
              _showProfileEmptyState(tab, "likedPostsTab");
            }
          }, 320);
        });
    }
  }
}
(window as any)._onUserLikesChanged = _onUserLikesChanged;

/* ─────────────────── UserPosts Değişikliği ─────────────────── */

export function _onUserPostsChanged(
  postId: string,
  value: any,
  type: string,
): void {
  var st = _tabStates["userPostsTab"];
  if (type === "added") {
    st.timestamps.set(postId, value as number);
    if (!st.visible.has(postId)) {
      st.visible.add(postId);
    }
    if (_profileTab === "user-posts" && _currentPage === "profile") {
      _prependToProfileTab("userPostsTab", postId, value as number);
    }
  } else if (type === "removed") {
    st.timestamps.delete(postId);
    if (st.visible.has(postId)) st.visible.delete(postId);
    if (_profileTab === "user-posts") {
      document
        .querySelectorAll('#userPostsTab [data-post-id="' + postId + '"]')
        .forEach(function (el) {
          (el as HTMLElement).style.opacity = "0";
          (el as HTMLElement).style.transform = "translateY(4px)";
          setTimeout(function () {
            const prev = el.previousElementSibling;
            el.remove();
            const tab = document.getElementById("userPostsTab");
            if (tab && prev && prev.classList.contains("profile-date-sep")) {
              let cursor = prev.nextElementSibling;
              let hasPost = false;
              while (cursor) {
                if (cursor.classList.contains("profile-date-sep")) break;
                if (cursor.classList.contains("post-card")) {
                  hasPost = true;
                  break;
                }
                cursor = cursor.nextElementSibling;
              }
              if (!hasPost) prev.remove();
            }
            if (tab && tab.children.length === 0) {
              _showProfileEmptyState(tab, "userPostsTab");
            }
          }, 320);
        });
    }
  }
}
(window as any)._onUserPostsChanged = _onUserPostsChanged;

/* ─────────────────── Profile Ekleme ─────────────────── */

export function _prependToProfileTab(
  tabId: string,
  postId: string,
  ts?: number,
): void {
  const tab = document.getElementById(tabId) as HTMLElement | null;
  if (!tab) return;
  if (tab.querySelector('[data-post-id="' + postId + '"]')) return;

  const _insertPost = function (postData: any): void {
    if (tab.querySelector('[data-post-id="' + postId + '"]')) return;
    allPosts[postId] = postData;
    _showProfileContent(tab);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = _renderPostHTML(postId, postData);
    const el = wrapper.firstElementChild as HTMLElement;
    if (!el) return;

    if (ts) {
      const dateKey = _getDateKey(ts);
      const first = tab.firstElementChild;

      if (first && first.classList.contains("profile-date-sep")) {
        if (first.getAttribute("data-date-key") === dateKey) {
          const ref = first.nextElementSibling;
          if (ref) tab.insertBefore(el, ref);
          else tab.appendChild(el);
        } else {
          tab.insertBefore(_renderDateSep(ts), first);
          tab.insertBefore(el, first);
        }
      } else if (first) {
        tab.insertBefore(_renderDateSep(ts), first);
        tab.insertBefore(el, first);
      } else {
        tab.appendChild(_renderDateSep(ts));
        tab.appendChild(el);
      }
    } else {
      tab.prepend(el);
    }

    _initPostImage(
      el.querySelector(".post-img-lazy") as HTMLImageElement | null,
    );
  };

  if (allPosts[postId]) {
    _insertPost(allPosts[postId]);
    return;
  }
  getPostsByIds([postId], allPosts).then(function (posts) {
    if (posts[postId]) _insertPost(posts[postId]);
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
