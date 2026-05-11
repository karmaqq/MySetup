/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        POST LİSTENER VE SAYFALAMA                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "./firebase-init";
import { postsFeed, _commentListenerRefs, _commentListenerOrder, PAGE_SIZE } from "./app-state";
import { renderLoadMoreBtn, removeLoadMoreBtn } from "./global-fn";
import {
  initUserLikesListener,
  initUserPostsListener,
  removeUserPostsListener,
  removeUserLikesListener,
} from "./firebase-post";
import {
  allPosts,
  _insertPostToFeed,
  _renderEmptyFeed,
  _patchPostCard,
  _patchPostLikes,
  _softRemovePost,
  _onlyLikesChanged,
} from "./posts-render";

/* ─────────────────── Feed Durum Değişkenleri ─────────────────── */

let _postsListenerActive = false;
(window as any)._postsListenerActive = _postsListenerActive;
let _postsQuery: firebase.database.Query | null = null;
let _oldestLoadedKey: string | null = null;
let _hasMorePosts = false;
let _loadingMore = false;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         POST SİSTEMİ BAŞLATMA                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Giriş yapıldığında çağrılır ─────────────────── */

export function initPosts(): void {
  _teardownPosts();
  Object.keys(allPosts).forEach(function (k) {
    delete allPosts[k];
  });
  _oldestLoadedKey = null;
  _hasMorePosts = false;
  _loadingMore = false;

  if (postsFeed) postsFeed.innerHTML = "";
  _removeLoadMoreBtn();
  (window as any)._postsListenerActive = false;
  _startPostsListener();

  if (typeof (window as any)._startTimeUpdateInterval === "function") {
    (window as any)._startTimeUpdateInterval();
  }

  const user = firebase.auth().currentUser;
  if (user) {
    initUserLikesListener(user.uid, (window as any)._onUserLikesChanged);
    initUserPostsListener(user.uid, (window as any)._onUserPostsChanged);
  }

  if (typeof (window as any)._restorePostViewOnLoad === "function") {
    (window as any)._restorePostViewOnLoad();
  }
}

/* ─────────────────── Çıkış yapıldığında çağrılır ─────────────────── */

export function _teardownPosts(): void {
  if (_postsQuery) {
    _postsQuery.off();
    _postsQuery = null;
  }
  _postsListenerActive = false;
  (window as any)._postsListenerActive = false;
  (window as any)._postsReadyFired = false;
  Object.keys(allPosts).forEach(function (k) {
    delete allPosts[k];
  });
  if (postsFeed) postsFeed.innerHTML = "";
  _removeLoadMoreBtn();

  Object.values(_commentListenerRefs).forEach(function (ref: any) {
    ref.off();
  });
  for (var k in _commentListenerRefs) delete _commentListenerRefs[k];
  _commentListenerOrder.length = 0;
  removeUserPostsListener();
  removeUserLikesListener();

  if (typeof (window as any)._stopTimeUpdateInterval === "function") {
    (window as any)._stopTimeUpdateInterval();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         SAYFALAMA VE LİSTENER                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İlk 20 postu yükler, listener başlatır ─────────────────── */

function _startPostsListener(): void {
  const ref = db.postsRef!.orderByChild("createdAt");

  ref
    .limitToLast(PAGE_SIZE)
    .once("value", function (snap: firebase.database.DataSnapshot) {
      const raw = (snap.val() || {}) as Record<string, any>;
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

      if (keys.length >= PAGE_SIZE) {
        _checkHasMorePosts(
          raw[_oldestLoadedKey!] ? raw[_oldestLoadedKey!].createdAt : null,
        );
      } else {
        _hasMorePosts = false;
        _removeLoadMoreBtn();
      }

      _listenForNewPosts(ref);
      (window as any)._postsReadyFired = true;
      document.dispatchEvent(new CustomEvent("postsReady"));
    });
}

/* ─────────────────── Veritabanında daha fazla post var mı kontrol eder ─────────────────── */

function _checkHasMorePosts(oldestTs: number | null): void {
  if (!oldestTs) {
    _hasMorePosts = false;
    _removeLoadMoreBtn();
    return;
  }
  db.postsRef!.orderByChild("createdAt")
    .endAt(oldestTs - 1)
    .limitToLast(1)
    .once("value", function (snap: firebase.database.DataSnapshot) {
      _hasMorePosts = snap.exists();
      if (_hasMorePosts) {
        _renderLoadMoreBtn();
      } else {
        _removeLoadMoreBtn();
      }
    });
}

/* ─────────────────── Yeni gelen postları gerçek zamanlı dinler ─────────────────── */

function _onPostChanged(s: firebase.database.DataSnapshot): void {
  const id = s.key;
  if (!id || !allPosts[id]) return;
  const oldData = allPosts[id];
  allPosts[id] = s.val();
  const user = firebase.auth().currentUser;
  const newVal = s.val() as any;
  if (_onlyLikesChanged(oldData, newVal)) {
    _patchPostLikes(id, newVal.likes, user);
  } else {
    _patchPostCard(id, s.val());
  }
}

function _onPostRemoved(s: firebase.database.DataSnapshot): void {
  const id = s.key;
  if (!id) return;
  if (_commentListenerRefs[id]) {
    (_commentListenerRefs[id] as any).off();
    delete _commentListenerRefs[id];
  }
  delete allPosts[id];
  _softRemovePost(id);
  if ((window as any)._viewingPostId === id) {
    if (typeof (window as any)._handleDeletedPostView === "function") {
      (window as any)._handleDeletedPostView();
    }
  }
}

function _listenForNewPosts(ref: firebase.database.Query): void {
  if (_postsListenerActive) return;
  _postsListenerActive = true;
  (window as any)._postsListenerActive = true;

  const newestTs = _getNewestTimestamp();
  const liveQuery = ref.startAt(newestTs + 1);
  _postsQuery = liveQuery;

  liveQuery.on("child_added", function (s) {
    const id = s.key;
    const data = s.val();
    if (!id) return;
    allPosts[id] = data;
    const empty = postsFeed && postsFeed.querySelector(".posts-empty");
    if (empty) empty.remove();
    _insertPostToFeed(id, data, true);
  });

  liveQuery.on("child_changed", _onPostChanged);
  liveQuery.on("child_removed", _onPostRemoved);
}

/* ─────────────────── En yeni yüklü postun timestamp'i ─────────────────── */

function _getNewestTimestamp(): number {
  let max = 0;
  Object.values(allPosts).forEach(function (p: any) {
    if ((p.createdAt || 0) > max) max = p.createdAt;
  });
  return max;
}

/* ─────────────────── Daha fazla post yükle (sayfalama) ─────────────────── */

function _loadMorePosts(): void {
  if (_loadingMore || !_hasMorePosts || !_oldestLoadedKey) return;
  _loadingMore = true;

  const btn = document.getElementById(
    "loadMoreBtn",
  ) as HTMLButtonElement | null;
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

  db.postsRef!.orderByChild("createdAt")
    .endAt(oldestTs - 1)
    .limitToLast(PAGE_SIZE)
    .once("value", function (snap: firebase.database.DataSnapshot) {
      const raw = (snap.val() || {}) as Record<string, any>;
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

function _renderLoadMoreBtn(): void {
  if (!postsFeed) return;
  renderLoadMoreBtn(postsFeed, "loadMoreBtn", _loadMorePosts);
}

function _removeLoadMoreBtn(): void {
  removeLoadMoreBtn("loadMoreBtn");
}
