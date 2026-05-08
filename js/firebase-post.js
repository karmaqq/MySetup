/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST SİSTEMİ FIREBASE                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post Referansları ─────────────────── */

const postsRef = database.ref("posts");
const userPostsRef = database.ref("userPosts");
const userLikesRef = database.ref("userLikes");

function getPostsRef() {
  return postsRef;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST CRUİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function addPostToFirebase(postData) {
  var newRef = postsRef.push();
  var updates = {};
  var newKey = newRef.key;
  updates["posts/" + newKey] = postData;
  if (postData.uid) {
    updates["userPosts/" + postData.uid + "/" + newKey] =
      firebase.database.ServerValue.TIMESTAMP;
  }
  return database
    .ref()
    .update(updates)
    .then(function () {
      return newRef;
    });
}

function deletePostFromFirebase(postId, postData) {
  var imageUrl = postData ? postData.imageUrl : null;
  var uid = postData ? postData.uid : null;

  var deletePromise = Promise.resolve();
  if (imageUrl) {
    deletePromise = firebase
      .storage()
      .refFromURL(imageUrl)
      .delete()
      .catch(function (e) {
        console.warn("Görsel silinemedi:", e);
      });
  }

  return postsRef
    .child(postId)
    .child("likes")
    .once("value")
    .then(function (likesSnap) {
      var likes = likesSnap.val() || {};
      var cleanupPromises = [];
      if (uid) {
        cleanupPromises.push(userPostsRef.child(uid).child(postId).remove());
      }
      Object.keys(likes).forEach(function (userId) {
        cleanupPromises.push(userLikesRef.child(userId).child(postId).remove());
      });

      return deletePromise.then(function () {
        return Promise.all([
          postsRef.child(postId).remove(),
          Promise.all(cleanupPromises),
        ]);
      });
    });
}

function togglePostLike(postId, userId) {
  var likeRef = postsRef.child(postId).child("likes").child(userId);
  var userLikeRef = userLikesRef.child(userId).child(postId);
  return likeRef
    .transaction(function (currentValue) {
      return currentValue ? null : true;
    })
    .then(function (result) {
      if (result.committed) {
        if (result.snapshot.val() === null) {
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

function getUserPostsOnce(userId, limit, endAt) {
  var ref = userPostsRef
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

function getUserLikesOnce(userId, limit, endAt) {
  var ref = userLikesRef
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

function getPostsByIds(postIds, existing) {
  if (!postIds || !postIds.length) return Promise.resolve({});
  var result = {};
  var missing = [];
  postIds.forEach(function (id) {
    if (existing && existing[id]) {
      result[id] = existing[id];
    } else {
      missing.push(id);
    }
  });
  if (!missing.length) return Promise.resolve(result);
  return Promise.all(
    missing.map(function (id) {
      return postsRef
        .child(id)
        .once("value")
        .then(function (s) {
          return s.exists() ? { id: id, data: s.val() } : null;
        });
    }),
  ).then(function (results) {
    results.forEach(function (r) {
      if (r) {
        r.data._id = r.id;
        result[r.id] = r.data;
      }
    });
    return result;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM SİSTEMİ                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function addCommentToFirebase(postId, commentData) {
  return postsRef.child(postId).child("comments").push(commentData);
}

function deleteCommentFromFirebase(postId, commentId) {
  return postsRef.child(postId).child("comments").child(commentId).remove();
}

function toggleCommentLike(postId, commentId, userId) {
  var likeRef = postsRef
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("likes")
    .child(userId);
  return likeRef.transaction(function (current) {
    return current ? null : true;
  });
}

function addReplyToFirebase(postId, commentId, replyData) {
  return postsRef
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .push(replyData);
}

function deleteReplyFromFirebase(postId, commentId, replyId) {
  return postsRef
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .child(replyId)
    .remove();
}

function toggleReplyLike(postId, commentId, replyId, userId) {
  var likeRef = postsRef
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

let _userLikesListener = null;

function initUserLikesListener(userId, onLikesChanged) {
  if (_userLikesListener) {
    _userLikesListener.off();
  }
  _userLikesListener = userLikesRef.child(userId);
  _userLikesListener.on("child_added", function (s) {
    onLikesChanged(s.key, s.val(), "added");
  });
  _userLikesListener.on("child_removed", function (s) {
    onLikesChanged(s.key, null, "removed");
  });
}

function removeUserLikesListener() {
  if (_userLikesListener) {
    _userLikesListener.off();
    _userLikesListener = null;
  }
}

let _userPostsListener = null;

function initUserPostsListener(userId, onPostsChanged) {
  if (_userPostsListener) {
    _userPostsListener.off();
  }
  _userPostsListener = userPostsRef.child(userId);
  _userPostsListener.on("child_added", function (s) {
    onPostsChanged(s.key, s.val(), "added");
  });
  _userPostsListener.on("child_removed", function (s) {
    onPostsChanged(s.key, null, "removed");
  });
}

function removeUserPostsListener() {
  if (_userPostsListener) {
    _userPostsListener.off();
    _userPostsListener = null;
  }
}
