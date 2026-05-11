/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST SİSTEMİ FIREBASE                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "./firebase-init";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST CRUD                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function addPostToFirebase(postData: any): Promise<firebase.database.Reference> {
  const newRef = db.postsRef!.push();
  const updates: Record<string, any> = {};
  const newKey = newRef.key;
  updates["posts/" + newKey] = postData;
  if (postData.uid) {
    updates["userPosts/" + postData.uid + "/" + newKey] =
      firebase.database.ServerValue.TIMESTAMP;
  }
  return db
    .database!
    .ref()
    .update(updates)
    .then(function () {
      return newRef;
    }) as Promise<firebase.database.Reference>;
}

export function deletePostFromFirebase(postId: string, postData: any): Promise<any> {
  const uid = postData ? postData.uid : null;
  const imageUrl = postData ? postData.imageUrl : null;

  const imagePromise = imageUrl
    ? firebase.storage().refFromURL(imageUrl).delete().catch(function () {})
    : Promise.resolve();

  return db.postsRef!.child(postId).child("likes").once("value").then(function (likesSnap) {
    const likes = likesSnap.val() || {};
    const updates: Record<string, any> = {};

    updates["posts/" + postId] = null;
    if (uid) updates["userPosts/" + uid + "/" + postId] = null;
    Object.keys(likes).forEach(function (userId) {
      updates["userLikes/" + userId + "/" + postId] = null;
    });

    return imagePromise.then(function () {
      return db.database!.ref().update(updates);
    });
  });
}

export function togglePostLike(postId: string, userId: string): Promise<any> {
  const likeRef = db.postsRef!.child(postId).child("likes").child(userId);
  const userLikeRef = db.userLikesRef!.child(userId).child(postId);
  return likeRef
    .transaction(function (currentValue) {
      return currentValue ? null : true;
    })
    .then(function (result) {
      if (result.committed) {
        if (result.snapshot!.val() === null) {
          return userLikeRef.remove();
        } else {
          return userLikeRef.set(firebase.database.ServerValue.TIMESTAMP);
        }
      }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       POST SORGULARI                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function getUserPostsOnce(userId: string, limit?: number, endAt?: number | null): Promise<Record<string, any>> {
  let ref = db.userPostsRef!
    .child(userId)
    .orderByValue()
    .limitToLast(limit || 20);
  if (endAt !== undefined && endAt !== null) {
    ref = ref.endAt(endAt);
  }
  return ref.once("value").then(function (snap) {
    return snap.val() || {};
  });
}

export function getUserLikesOnce(userId: string, limit?: number, endAt?: number | null): Promise<Record<string, any>> {
  let ref = db.userLikesRef!
    .child(userId)
    .orderByValue()
    .limitToLast(limit || 20);
  if (endAt !== undefined && endAt !== null) {
    ref = ref.endAt(endAt);
  }
  return ref.once("value").then(function (snap) {
    return snap.val() || {};
  });
}

export function getPostsByIds(postIds: string[], existing: Record<string, any>): Promise<Record<string, any>> {
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
  if (missing.length > 3) {
    var sorted = [...missing].sort();
    return db
      .postsRef!
      .orderByKey()
      .startAt(sorted[0])
      .endAt(sorted[sorted.length - 1])
      .once("value")
      .then(function (snap) {
        var all = (snap.val() || {}) as Record<string, any>;
        missing.forEach(function (id) {
          if (all[id]) {
            var d = all[id];
            d._id = id;
            result[id] = d;
          }
        });
        return result;
      });
  }
  return Promise.all(
    missing.map(function (id) {
      return db
        .postsRef!
        .child(id)
        .once("value")
        .then(function (s) {
          return s.exists() ? { id: id, data: s.val() } : null;
        });
    }),
  ).then(function (results) {
    results.forEach(function (r) {
      if (r) {
        const d = r.data as any;
        d._id = r.id;
        result[r.id] = d;
      }
    });
    return result;
  });
}

export function getPostsRef(): firebase.database.Reference {
  return db.postsRef!;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM SİSTEMİ                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function addCommentToFirebase(postId: string, commentData: any): firebase.database.ThenableReference {
  return db.postsRef!.child(postId).child("comments").push(commentData);
}

export function deleteCommentFromFirebase(postId: string, commentId: string): Promise<void> {
  return db.postsRef!.child(postId).child("comments").child(commentId).remove();
}

export function toggleCommentLike(postId: string, commentId: string, userId: string): Promise<any> {
  const likeRef = db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("likes")
    .child(userId);
  return likeRef.transaction(function (current) {
    return current ? null : true;
  });
}

export function addReplyToFirebase(postId: string, commentId: string, replyData: any): firebase.database.ThenableReference {
  return db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .push(replyData);
}

export function deleteReplyFromFirebase(postId: string, commentId: string, replyId: string): Promise<void> {
  return db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .child(replyId)
    .remove();
}

export function toggleReplyLike(postId: string, commentId: string, replyId: string, userId: string): Promise<any> {
  const likeRef = db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .child(replyId)
    .child("likes")
    .child(userId);
  return likeRef.transaction(function (current) {
    return current ? null : true;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     USER LIKES / POSTS LİSTENER                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

let _userLikesListener: firebase.database.Reference | null = null;

export function initUserLikesListener(userId: string, onLikesChanged: (key: string, val: any, type: string) => void): void {
  if (_userLikesListener) {
    _userLikesListener.off();
  }
  _userLikesListener = db.userLikesRef!.child(userId);
  _userLikesListener.on("child_added", function (s) {
    onLikesChanged(s.key!, s.val(), "added");
  });
  _userLikesListener.on("child_removed", function (s) {
    onLikesChanged(s.key!, null, "removed");
  });
}

export function removeUserLikesListener(): void {
  if (_userLikesListener) {
    _userLikesListener.off();
    _userLikesListener = null;
  }
}

let _userPostsListener: firebase.database.Reference | null = null;

export function initUserPostsListener(userId: string, onPostsChanged: (key: string, val: any, type: string) => void): void {
  if (_userPostsListener) {
    _userPostsListener.off();
  }
  _userPostsListener = db.userPostsRef!.child(userId);
  _userPostsListener.on("child_added", function (s) {
    onPostsChanged(s.key!, s.val(), "added");
  });
  _userPostsListener.on("child_removed", function (s) {
    onPostsChanged(s.key!, null, "removed");
  });
}

export function removeUserPostsListener(): void {
  if (_userPostsListener) {
    _userPostsListener.off();
    _userPostsListener = null;
  }
}
