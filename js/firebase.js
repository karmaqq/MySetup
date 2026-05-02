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

/* Enrich Item */
function enrichItem(item) {
  var searchRaw = (
    item.component +
    " " +
    item.brand +
    " " +
    item.specs +
    " " +
    item.vendor
  ).toLowerCase();
  return Object.assign({}, item, {
    _searchTag: normalizeTr(searchRaw),
    _statusNorm: normalizeTr(item.status),
  });
}

/* Init User Data */
function initUserDataRef(userId) {
  if (userDataRef) {
    userDataRef.off();
    userDataRef = null;
  }

  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  if (!userId) {
    activeBasePath = null;
    allData = {};
    if (typeof renderAll === "function") renderAll();
    return;
  }

  activeBasePath = "users/" + userId + "/components";
  userDataRef = database.ref(activeBasePath);

  var firstLoad = true;

  userDataRef.once("value").then(function (snapshot) {
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
      if (firstLoad) return;
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
      console.error("child_added error:", err);
    },
  );

  userDataRef.on(
    "child_changed",
    function (snapshot) {
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
      console.error("child_changed error:", err);
    },
  );

  userDataRef.on(
    "child_removed",
    function (snapshot) {
      var id = snapshot.key;
      var oldItem = allData[id];
      delete allData[id];
      if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
      if (typeof removeTableRow === "function") removeTableRow(id);
    },
    function (err) {
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

/* --- POST SYSTEM --- */

postsRef = database.ref("posts");

function addPostToFirebase(postData) {
  return postsRef.push(postData);
}

function deletePostFromFirebase(postId) {
  var postData = allPosts[postId];
  var imageUrl = postData ? postData.imageUrl : null;

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

  return deletePromise.then(function () {
    return postsRef.child(postId).remove();
  });
}

function togglePostLike(postId, userId) {
  var likeRef = postsRef.child(postId).child("likes").child(userId);
  return likeRef.once("value").then(function (snapshot) {
    if (snapshot.exists()) {
      return likeRef.remove();
    } else {
      return likeRef.set(true);
    }
  });
}

function initPostsListener(callback) {
  var query = postsRef.orderByChild("createdAt");
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
