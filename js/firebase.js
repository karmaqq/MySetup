/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FIREBASE AYARLARI                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyDINeXkzy4JCwt9cSjII5Icm-x_NpmtmK4",
  authDomain: "mysetup-8dcd5.firebaseapp.com",
  databaseURL: "https://mysetup-8dcd5-default-rtdb.firebaseio.com",
  projectId: "mysetup-8dcd5",
  storageBucket: "mysetup-8dcd5.firebasestorage.app",
  messagingSenderId: "888468129237",
  appId: "1:888468129237:web:9374ae62de891d7013295c",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let userDataRef = null;
let activeBasePath = null;
let postsRef = null;
window._isLoggingOut = false;

/* Enrich Item */
function enrichItem(item) {
  var searchRaw = (
    (item.component || "") + " " +
    (item.brand || "") + " " +
    (item.specs || "") + " " +
    (item.vendor || "")
  ).toLowerCase();
  return Object.assign({}, item, {
    _searchTag: normalizeTr(searchRaw),
    _statusNorm: normalizeTr(item.status || ""),
  });
}

/* Init User Data */
function initUserDataRef(userId) {
  if (userDataRef) {
    userDataRef.off();
    userDataRef = null;
    _isLoggingOut = true;
  }

  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  if (!userId) {
    activeBasePath = null;
    allData = {};
    _isLoggingOut = false;
    if (typeof renderAll === "function") renderAll();
    return;
  }

  _isLoggingOut = false;
  activeBasePath = "users/" + userId + "/components";
  userDataRef = database.ref(activeBasePath);

  var firstLoad = true;

  userDataRef.once("value").then(function (snapshot) {
    if (_isLoggingOut) return;
    var rawData = snapshot.val() || {};
    allData = {};
    Object.keys(rawData).forEach(function (id) {
      var item = enrichItem(rawData[id]);
      item.id = id;
      allData[id] = item;
    });
    if (typeof rebuildStatsCache === "function") rebuildStatsCache();
    if (typeof renderAll === "function") renderAll();
    firstLoad = false;
  });

  userDataRef.on(
    "child_added",
    function (snapshot) {
      if (firstLoad || _isLoggingOut) return;
      var id = snapshot.key;
      var item = enrichItem(snapshot.val());
      item.id = id;
      var oldItem = allData[id];
      allData[id] = item;
      updateStatsCacheOnChange(item, oldItem, false);
      if (typeof addOrUpdateTableRow === "function")
        addOrUpdateTableRow(id, item);
    },
    function (err) {
      if (_isLoggingOut) return;
      if (!userDataRef) return;
      if (err && err.toString().includes("permission_denied")) return;
      console.error("child_added error:", err);
    },
  );

  userDataRef.on(
    "child_changed",
    function (snapshot) {
      if (_isLoggingOut) return;
      var id = snapshot.key;
      var item = enrichItem(snapshot.val());
      item.id = id;
      var oldItem = allData[id];
      allData[id] = item;
      updateStatsCacheOnChange(item, oldItem, false);
      if (typeof addOrUpdateTableRow === "function")
        addOrUpdateTableRow(id, item);
    },
    function (err) {
      if (_isLoggingOut) return;
      if (!userDataRef) return;
      if (err && err.toString().includes("permission_denied")) return;
      console.error("child_changed error:", err);
    },
  );

  userDataRef.on(
    "child_removed",
    function (snapshot) {
      if (_isLoggingOut) return;
      var id = snapshot.key;
      var oldItem = allData[id];
      delete allData[id];
      if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
      if (typeof removeTableRow === "function") removeTableRow(id);
    },
    function (err) {
      if (_isLoggingOut) return;
      if (!userDataRef) return;
      if (err && err.toString().includes("permission_denied")) return;
      console.error("child_removed error:", err);
    },
  );
}

/* Component CRUD */
function addComponentToFirebase(itemData) {
  return userDataRef.push(itemData);
}

function replaceUserDataInFirebase(itemsMap) {
  return userDataRef.set(itemsMap || {});
}

function updateComponentInFirebase(id, itemData) {
  return database.ref(activeBasePath + "/" + id).update(itemData);
}

function updateComponentStatusInFirebase(id, newStatus) {
  return database.ref(activeBasePath + "/" + id).update({ status: newStatus });
}

function deleteComponentFromFirebase(id) {
  return database.ref(activeBasePath + "/" + id).remove();
}

/* Storage */
function uploadImageToFirebase(file, itemId) {
  return new Promise(function (resolve, reject) {
    var user = firebase.auth().currentUser;
    if (!user) return reject("Kullanıcı yok");
    var storageRef = firebase.storage().ref();
    var imageRef = storageRef.child(
      "users/" + user.uid + "/components/" + itemId + "/image",
    );
    var uploadTask = imageRef.put(file);
    uploadTask.on(
      "state_changed",
      null,
      function (error) {
        reject(error);
      },
      function () {
        uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
      },
    );
  });
}

async function deleteAllInFolder(ref) {
  var list = await ref.listAll();
  await Promise.all(
    list.items.map(function (item) {
      return item.delete();
    }),
  );
  await Promise.all(list.prefixes.map(deleteAllInFolder));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST SİSTEMİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

postsRef = database.ref("posts");
const userPostsRef = database.ref("userPosts");
const userLikesRef = database.ref("userLikes");

function addPostToFirebase(postData) {
  var newRef = postsRef.push();
  var updates = {};
  var newKey = newRef.key;
  updates["posts/" + newKey] = postData;
  if (postData.uid) {
    updates["userPosts/" + postData.uid + "/" + newKey] =
      firebase.database.ServerValue.TIMESTAMP;
  }
  return database.ref().update(updates).then(function () {
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

  var cleanupPromises = [];
  if (uid) {
    cleanupPromises.push(userPostsRef.child(uid).child(postId).remove());
  }
  if (postData && postData.likes) {
    Object.keys(postData.likes).forEach(function (userId) {
      cleanupPromises.push(
        userLikesRef.child(userId).child(postId).remove()
      );
    });
  }

  return deletePromise.then(function () {
    return Promise.all([
      postsRef.child(postId).remove(),
      Promise.all(cleanupPromises),
    ]);
  });
}

function togglePostLike(postId, userId) {
  var likeRef = postsRef.child(postId).child("likes").child(userId);
  var userLikeRef = userLikesRef.child(userId).child(postId);
  return likeRef.once("value").then(function (snapshot) {
    if (snapshot.exists()) {
      return Promise.all([
        likeRef.remove(),
        userLikeRef.remove(),
      ]);
    } else {
      return Promise.all([
        likeRef.set(true),
        userLikeRef.set(firebase.database.ServerValue.TIMESTAMP),
      ]);
    }
  });
}

function getUserPostsOnce(userId, limit, endAt) {
  var ref = userPostsRef.child(userId).orderByValue().limitToLast(limit || 20);
  if (endAt !== undefined && endAt !== null) {
    ref = ref.endAt(endAt);
  }
  return ref.once("value").then(function (snap) {
    var result = snap.val() || {};
    if (Object.keys(result).length > 0) return result;
    return postsRef
      .orderByChild("uid")
      .equalTo(userId)
      .once("value")
      .then(function (snap2) {
        var posts = snap2.val() || {};
        var map = {};
        Object.keys(posts).forEach(function (id) {
          map[id] = posts[id].createdAt || 0;
        });
        return map;
      });
  });
}

function getUserLikesOnce(userId, limit, endAt) {
  var ref = userLikesRef.child(userId).orderByValue().limitToLast(limit || 20);
  if (endAt !== undefined && endAt !== null) {
    ref = ref.endAt(endAt);
  }
  return ref.once("value").then(function (snap) {
    return snap.val() || {};
  });
}

function getPostsByIds(postIds) {
  if (!postIds || !postIds.length) return Promise.resolve({});
  var promises = postIds.map(function (id) {
    return postsRef.child(id).once("value").then(function (s) {
      var val = s.val();
      if (val) val._id = s.key;
      return val;
    });
  });
  return Promise.all(promises).then(function (results) {
    var map = {};
    results.forEach(function (r) {
      if (r && r._id) map[r._id] = r;
    });
    return map;
  });
}

function getPostById(postId) {
  return postsRef.child(postId).once("value").then(function (s) {
    var val = s.val();
    if (val) val._id = s.key;
    return val;
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
  return likeRef.once("value").then(function (snapshot) {
    if (snapshot.exists()) {
      return likeRef.remove();
    } else {
      return likeRef.set(true);
    }
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
  return likeRef.once("value").then(function (snapshot) {
    if (snapshot.exists()) {
      return likeRef.remove();
    } else {
      return likeRef.set(true);
    }
  });
}

function initCommentsListener(postId, callback) {
  var ref = postsRef.child(postId).child("comments");
  var query = ref.orderByChild("createdAt");

  query.on("child_added", function (s) {
    callback(s.key, s.val(), "added");
  });
  query.on("child_changed", function (s) {
    callback(s.key, s.val(), "changed");
  });
  query.on("child_removed", function (s) {
    callback(s.key, null, "removed");
  });
}

/* UserLikes değişikliklerini dinle */

let _userLikesListener = null;

function initUserLikesListener(userId, onLikesChanged) {
  if (_userLikesListener) {
    _userLikesListener.off();
  }
  _userLikesListener = userLikesRef.child(userId);
  _userLikesListener.on("child_added", function (s) {
    if (window._isLoggingOut) return;
    onLikesChanged(s.key, s.val(), "added");
  });
  _userLikesListener.on("child_removed", function (s) {
    if (window._isLoggingOut) return;
    onLikesChanged(s.key, null, "removed");
  });
}

function removeUserLikesListener() {
  if (_userLikesListener) {
    _userLikesListener.off();
    _userLikesListener = null;
  }
}
