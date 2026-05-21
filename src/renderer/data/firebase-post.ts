/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST SİSTEMİ FIREBASE                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { ref, child, get, update, set, push, remove, runTransaction, onChildAdded, onChildRemoved, off, query, orderByValue, limitToLast, endAt, serverTimestamp, DatabaseReference, Query, ThenableReference } from "firebase/database";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { db } from "../core/firebase-init";
import { extractPathFromUrl } from "../core/global-ut";

/* ─────────────────── Post/Yorum/Yanıt Alan Güncelleme (Ortak) ─────────────────── */

export async function _updateUserFieldInPosts(
  uid: string,
  field: string,
  value: string | null,
  posts: Record<string, any>,
): Promise<void> {
  var dbUpdates: Record<string, any> = {};
  var postKeys = Object.keys(posts);
  for (var pi = 0; pi < postKeys.length; pi++) {
    var pid = postKeys[pi];
    var postData = posts[pid];
    if (!postData) continue;
    if (postData.uid === uid) {
      dbUpdates["posts/" + pid + "/" + field] = value;
    }
    if (postData.comments) {
      var cids = Object.keys(postData.comments);
      for (var ci = 0; ci < cids.length; ci++) {
        var cid = cids[ci];
        var comment = postData.comments[cid];
        if (comment.uid === uid) {
          dbUpdates["posts/" + pid + "/comments/" + cid + "/" + field] = value;
        }
        if (comment.replies) {
          var rids = Object.keys(comment.replies);
          for (var ri = 0; ri < rids.length; ri++) {
            var rid = rids[ri];
            var reply = comment.replies[rid];
            if (reply.uid === uid) {
              dbUpdates["posts/" + pid + "/comments/" + cid + "/replies/" + rid + "/" + field] = value;
            }
          }
        }
      }
    }
  }
  var batchKeys = Object.keys(dbUpdates);
  if (batchKeys.length === 0) return;
  for (var bi = 0; bi < batchKeys.length; bi += 500) {
    var batchChunk: Record<string, any> = {};
    var chunkKeys = batchKeys.slice(bi, bi + 500);
    for (var cki = 0; cki < chunkKeys.length; cki++) {
      batchChunk[chunkKeys[cki]] = dbUpdates[chunkKeys[cki]];
    }
    await update(ref(db.database), batchChunk);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST CRUD                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post Oluşturma ─────────────────── */

export function addPostToFirebase(postData: any): Promise<DatabaseReference> {
  const newRef = push(db.postsRef!);
  const updates: Record<string, any> = {};
  const newKey = newRef.key;
  updates["posts/" + newKey] = postData;
  if (postData.uid) {
    updates["userPosts/" + postData.uid + "/" + newKey] = serverTimestamp();
  }
  return update(ref(db.database), updates).then(function () {
    return newRef;
  }) as Promise<DatabaseReference>;
}

/* ─────────────────── Post Silme ─────────────────── */

export function deletePostFromFirebase(postId: string, postData: any): Promise<any> {
  const uid = postData ? postData.uid : null;
  const imageUrl = postData ? postData.imageUrl : null;
  const imagePath = postData ? postData.imagePath : null;

  const imagePromise = imageUrl
    ? deleteObject(storageRef(getStorage(), imagePath || extractPathFromUrl(imageUrl) || imageUrl)).catch(function () {})
    : Promise.resolve();

  return get(child(child(db.postsRef!, postId), "likes")).then(function (likesSnap) {
    const likes = likesSnap.val() || {};
    const updates: Record<string, any> = {};

    updates["posts/" + postId] = null;
    if (uid) updates["userPosts/" + uid + "/" + postId] = null;
    Object.keys(likes).forEach(function (userId) {
      updates["userLikes/" + userId + "/" + postId] = null;
    });

    return imagePromise.then(function () {
      return update(ref(db.database), updates);
    });
  });
}

/* ─────────────────── Post Beğeni ─────────────────── */

export function togglePostLike(postId: string, userId: string): Promise<any> {
  const likeRef = child(child(child(db.postsRef!, postId), "likes"), userId);
  const userLikeRef = child(child(db.userLikesRef!, userId), postId);
  return runTransaction(likeRef, function (currentValue) {
    return currentValue ? null : true;
  }).then(function (result) {
    if (result.committed) {
      if (result.snapshot.val() === null) {
        return remove(userLikeRef);
      } else {
        return set(userLikeRef, serverTimestamp());
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       POST SORGULARI                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kullanıcı Gönderileri ─────────────────── */

export function getUserPostsOnce(userId: string, limit?: number, endAtVal?: number | null): Promise<Record<string, any>> {
  const baseRef = child(db.userPostsRef!, userId);
  const constraints: import("firebase/database").QueryConstraint[] = [orderByValue(), limitToLast(limit || 20)];
  if (endAtVal !== undefined && endAtVal !== null) {
    constraints.push(endAt(endAtVal));
  }
  return get(query(baseRef, ...constraints)).then(function (snap) {
    return snap.val() || {};
  });
}

/* ─────────────────── Kullanıcı Beğenileri ─────────────────── */

export function getUserLikesOnce(userId: string, limit?: number, endAtVal?: number | null): Promise<Record<string, any>> {
  const baseRef = child(db.userLikesRef!, userId);
  const constraints: import("firebase/database").QueryConstraint[] = [orderByValue(), limitToLast(limit || 20)];
  if (endAtVal !== undefined && endAtVal !== null) {
    constraints.push(endAt(endAtVal));
  }
  return get(query(baseRef, ...constraints)).then(function (snap) {
    return snap.val() || {};
  });
}

/* ─────────────────── ID ile Gönderi Getirme ─────────────────── */

export async function getPostsByIds(postIds: string[], existing: Record<string, any>): Promise<Record<string, any>> {
  if (!postIds || !postIds.length) return Promise.resolve({});
  const result: Record<string, any> = {};
  const missing: string[] = [];
  postIds.forEach(function (id) {
    if (existing && existing[id]) {
      result[id] = existing[id];
    } else {
      missing.push(id);
    }
  });
  if (!missing.length) return Promise.resolve(result);
  const BATCH = 10;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(function (id) {
        return get(child(db.postsRef!, id)).then(function (s) {
          return s.exists() ? { id: id, data: s.val() } : null;
        });
      }),
    );
    results.forEach(function (r) {
      if (r) {
        const d = r.data as any;
        d._id = r.id;
        result[r.id] = d;
      }
    });
  }
  return result;
}

/* ─────────────────── Posts Referansı ─────────────────── */

export function getPostsRef(): DatabaseReference {
  return db.postsRef!;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     USER LIKES / POSTS LİSTENER                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

let _userLikesListenerRef: DatabaseReference | null = null;

/* ─────────────────── Beğeni Dinleyici Başlat ─────────────────── */

export function initUserLikesListener(userId: string, onLikesChanged: (key: string, val: any, type: string) => void): void {
  if (_userLikesListenerRef) {
    off(_userLikesListenerRef);
  }
  _userLikesListenerRef = child(db.userLikesRef!, userId);
  onChildAdded(_userLikesListenerRef, function (s) {
    onLikesChanged(s.key!, s.val(), "added");
  });
  onChildRemoved(_userLikesListenerRef, function (s) {
    onLikesChanged(s.key!, null, "removed");
  });
}

/* ─────────────────── Beğeni Dinleyici Durdur ─────────────────── */

export function removeUserLikesListener(): void {
  if (_userLikesListenerRef) {
    off(_userLikesListenerRef);
    _userLikesListenerRef = null;
  }
}

let _userPostsListenerRef: DatabaseReference | null = null;

/* ─────────────────── Gönderi Dinleyici Başlat ─────────────────── */

export function initUserPostsListener(userId: string, onPostsChanged: (key: string, val: any, type: string) => void): void {
  if (_userPostsListenerRef) {
    off(_userPostsListenerRef);
  }
  _userPostsListenerRef = child(db.userPostsRef!, userId);
  onChildAdded(_userPostsListenerRef, function (s) {
    onPostsChanged(s.key!, s.val(), "added");
  });
  onChildRemoved(_userPostsListenerRef, function (s) {
    onPostsChanged(s.key!, null, "removed");
  });
}

/* ─────────────────── Gönderi Dinleyici Durdur ─────────────────── */

export function removeUserPostsListener(): void {
  if (_userPostsListenerRef) {
    off(_userPostsListenerRef);
    _userPostsListenerRef = null;
  }
}
