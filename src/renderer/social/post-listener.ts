/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        POST LİSTENER VE SAYFALAMA                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { query, Query, DataSnapshot, DatabaseReference, off, onChildAdded, onChildChanged, onChildRemoved, get, orderByChild, limitToLast, startAt, endAt } from "firebase/database";
import { db } from "../core/firebase-init";
import { postsFeed, _commentListenerRefs, _commentListenerOrder, PAGE_SIZE, currentUser } from "../core/app-state";
import { renderLoadMoreBtn, removeLoadMoreBtn } from "../core/global-fn";
import {
  initUserLikesListener,
  initUserPostsListener,
  removeUserPostsListener,
  removeUserLikesListener,
} from "../data/firebase-post";
import {
  allPosts,
  _insertPostToFeed,
  _renderEmptyFeed,
  _patchPostCard,
  _patchPostLikes,
  _softRemovePost,
  _onlyLikesChanged,
  _evictOldPostsIfNeeded,
} from "./post-render";

/* ─────────────────── Feed Durum Değişkenleri ─────────────────── */

let _postsListenerActive = false;
(window as any)._postsListenerActive = _postsListenerActive;
let _postsQuery: Query | null = null;
let _oldestLoadedKey: string | null = null;
let _newestLoadedTs = 0;
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

  const user = currentUser;
  if (user) {
    initUserLikesListener(user.uid, (window as any)._onUserLikesChanged);
    initUserPostsListener(user.uid, (window as any)._onUserPostsChanged);
  }

}

/* ─────────────────── Çıkış yapıldığında çağrılır ─────────────────── */

let _fullRemovedRef: DatabaseReference | null = null;
let _postsChangedRef: Query | null = null;

export function _teardownPosts(): void {
  if (_postsQuery) {
    off(_postsQuery);
    _postsQuery = null;
  }
  if (_postsChangedRef) {
    off(_postsChangedRef, "child_changed");
    _postsChangedRef = null;
  }
  if (_fullRemovedRef) {
    off(_fullRemovedRef, "child_removed", _onPostRemoved);
    _fullRemovedRef = null;
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
    off(ref);
  });
  for (var k in _commentListenerRefs) delete _commentListenerRefs[k];
  _commentListenerOrder.length = 0;
  removeUserPostsListener();
  removeUserLikesListener();

  if (typeof (window as any)._resetTabStates === "function") {
    (window as any)._resetTabStates();
  }

  if (typeof (window as any)._stopTimeUpdateInterval === "function") {
    (window as any)._stopTimeUpdateInterval();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         SAYFALAMA VE LİSTENER                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İlk 20 postu yükler, listener başlatır ─────────────────── */

function _startPostsListener(): void {
  const orderedRef = query(db.postsRef!, orderByChild("createdAt"));
  const limitedQuery = query(orderedRef, limitToLast(PAGE_SIZE));

  get(limitedQuery).then(function (snap: DataSnapshot) {
    const raw = (snap.val() || {}) as Record<string, any>;
    const keys = Object.keys(raw).sort(function (a, b) {
      return (raw[b].createdAt || 0) - (raw[a].createdAt || 0);
    });

    keys.forEach(function (id) {
      allPosts[id] = raw[id];
      if ((raw[id].createdAt || 0) > _newestLoadedTs) {
        _newestLoadedTs = raw[id].createdAt;
      }
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
      _hasMorePosts = true;
      _renderLoadMoreBtn();
    } else {
      _hasMorePosts = false;
      _removeLoadMoreBtn();
    }

    _listenForNewPosts(orderedRef);
    _listenForPostChanges();
    _evictOldPostsIfNeeded();
    (window as any)._postsReadyFired = true;
    document.dispatchEvent(new CustomEvent("postsReady"));
  });
}



/* ─────────────────── Feed seviyesinde post değişim dinleyicisi (tek listener) ─────────────────── */

function _listenForPostChanges(): void {
  _postsChangedRef = db.postsRef!;
  onChildChanged(_postsChangedRef, function (s) {
    var id = s.key;
    if (!id || !allPosts[id]) return;
    var oldData = allPosts[id];
    allPosts[id] = s.val();
    var user = currentUser;
    var newVal = s.val() as any;
    if (_onlyLikesChanged(oldData, newVal)) {
      _patchPostLikes(id, newVal.likes, user);
    } else {
      _patchPostCard(id, s.val());
    }
  });
}

/* ─────────────────── Post silindiğinde ─────────────────── */

function _onPostRemoved(s: DataSnapshot): void {
  const id = s.key;
  if (!id) return;
  if (_commentListenerRefs[id]) {
    off(_commentListenerRefs[id]);
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

/* ─────────────────── Yeni gelen postları gerçek zamanlı dinler ─────────────────── */

function _listenForNewPosts(orderedRef: Query): void {
  if (_postsListenerActive) return;
  _postsListenerActive = true;
  (window as any)._postsListenerActive = true;

  const liveQuery = query(orderedRef, startAt(_newestLoadedTs + 1));
  _postsQuery = liveQuery;

  onChildAdded(liveQuery, function (s) {
    const id = s.key;
    const data = s.val() as any;
    if (!id) return;
    allPosts[id] = data;
    if ((data.createdAt || 0) > _newestLoadedTs) {
      _newestLoadedTs = data.createdAt;
    }
    const empty = postsFeed && postsFeed.querySelector(".posts-empty");
    if (empty) empty.remove();
    _insertPostToFeed(id, data, true);
  });

  _fullRemovedRef = db.postsRef!;
  onChildRemoved(_fullRemovedRef, _onPostRemoved);
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

  const q = query(db.postsRef!, orderByChild("createdAt"), endAt(oldestTs - 1), limitToLast(PAGE_SIZE));
  get(q).then(function (snap: DataSnapshot) {
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
        _hasMorePosts = true;
        _renderLoadMoreBtn();
      }
    } else {
      _hasMorePosts = false;
      _removeLoadMoreBtn();
    }

    _evictOldPostsIfNeeded();
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
