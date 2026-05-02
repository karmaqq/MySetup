/* POST SISTEMI */

var postText = document.getElementById("postText");
var postImageInput = document.getElementById("postImageInput");
var postImageBtn = document.getElementById("postImageBtn");
var publishPostBtn = document.getElementById("publishPostBtn");
var postImagePreview = document.getElementById("postImagePreview");
var postsFeed = document.getElementById("postsFeed");

var allPosts = {};
var selectedPostImage = null;

/* POST OLUSTURMA */

function createPost() {
  var text = (postText ? postText.value : "").trim();
  if (!text && !selectedPostImage) {
    if (window.showToast)
      showToast("Lütfen bir metin yazın veya görsel seçin.");
    return;
  }

  var user = firebase.auth().currentUser;
  if (!user) return;

  if (publishPostBtn) {
    publishPostBtn.disabled = true;
    publishPostBtn.textContent = "Yayınlanıyor...";
  }

  var postData = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    content: text,
    imageUrl: null,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
    phraseIndex: Math.floor(Math.random() * POST_PHRASES.length),
  };

  if (selectedPostImage) {
    var storageRef = firebase.storage().ref();
    var imageRef = storageRef.child(
      "users/" + user.uid + "/posts/" + Date.now(),
    );
    var uploadTask = imageRef.put(selectedPostImage);

    uploadTask.on(
      "state_changed",
      null,
      function (error) {
        if (publishPostBtn) {
          publishPostBtn.disabled = false;
          publishPostBtn.textContent = "Yayınla";
        }
        if (window.showToast) showToast("Görsel yüklenemedi.");
      },
      function () {
        uploadTask.snapshot.ref.getDownloadURL().then(function (url) {
          postData.imageUrl = url;
          savePost(postData);
        });
      },
    );
  } else {
    savePost(postData);
  }
}

function savePost(postData) {
  addPostToFirebase(postData)
    .then(function () {
      if (postText) postText.value = "";
      selectedPostImage = null;
      if (postImagePreview) {
        postImagePreview.classList.add("hidden");
        postImagePreview.innerHTML = "";
      }
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayinla";
      }
       if (window.showToast) showToast("Gönderi yayınlandı!");
    })
    .catch(function () {
      if (publishPostBtn) {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Yayinla";
      }
       if (window.showToast) showToast("Gönderi yayınlanamadı.");
    });
}

/* GORSEL YUKLEME */

function handlePostImageUpload(e) {
  var file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    if (window.showToast) showToast("Lütfen geçerli bir görsel seçin.");
    return;
  }

  selectedPostImage = file;

  var reader = new FileReader();
  reader.onload = function (ev) {
    if (postImagePreview) {
      postImagePreview.innerHTML =
        '<div style="position:relative; display:inline-block;">' +
        '<img src="' +
        ev.target.result +
        '" style="max-width:100%; max-height:200px; border-radius:8px;" />' +
        '<button onclick="removePostImage()" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.7); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>' +
        "</div>";
      postImagePreview.classList.remove("hidden");
    }
  };
  reader.readAsDataURL(file);
}

function removePostImage() {
  selectedPostImage = null;
  if (postImagePreview) {
    postImagePreview.classList.add("hidden");
    postImagePreview.innerHTML = "";
  }
  if (postImageInput) postImageInput.value = "";
}

/* POST RENDER ETME */

function renderPost(postId, postData) {
  if (!postData) {
    var el = document.getElementById("post-" + postId);
    if (el) el.remove();
    return "";
  }

  var currentUser = firebase.auth().currentUser;
  var isOwnPost = currentUser && currentUser.uid === postData.uid;
  var liked =
    postData.likes && postData.likes[currentUser ? currentUser.uid : ""];

  var timeText = formatTimeAgo(postData.createdAt, postData.phraseIndex);
  var avatarUrl = postData.avatarUrl || "";
  var username = postData.username || "Kullanici";

  var escapedId = (postId + "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  var html = '<div class="post-card" id="post-' + escapedId + '">';
  html += '<div class="post-header">';
  html += '<div class="post-avatar">';
  if (avatarUrl) {
    html += '<img src="' + escAttr(postData.avatarUrl) + '" alt="" />';
  } else {
    html +=
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>' +
      '<circle cx="12" cy="7" r="4"></circle>' +
      "</svg>";
  }
  html += "</div>";
  html += '<div class="post-user-info">';
  html += '<span class="post-username">' + escHtml(username) + "</span>";
  html += '<span class="post-time"> ' + escHtml(timeText) + "</span>";
  html += "</div>";

  if (isOwnPost) {
    html +=
      '<button class="post-menu-btn" onclick="togglePostMenu(\'' +
      escapedId +
      "')\">⋮</button>";
    html += '<div class="post-dropdown" id="postDropdown-' + escapedId + '">';
    html +=
      '<button class="post-dropdown-item delete" onclick="confirmDeletePost(\'' +
      escapedId +
      "')\">";
    html +=
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">' +
      '<polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
      "</svg> Sil</button>";
    html += "</div>";
  }
  html += "</div>";

  html += '<div class="post-content">';
  if (postData.content) {
    html += '<div class="post-text">' + escHtml(postData.content) + "</div>";
  }
  if (postData.imageUrl) {
    html += '<div class="post-image">';
    html +=
      '<img src="' + escAttr(postData.imageUrl) + '" alt="Gonderi gorseli" />';
    html += "</div>";
  }
  html += "</div>";

  html += '<div class="post-actions">';
  html +=
    '<button class="post-action-btn ' +
    (liked ? "liked" : "") +
    '" onclick="toggleLike(\'' +
    escapedId +
    "')\">";
  html +=
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="' +
    (liked ? "currentColor" : "none") +
    '" stroke="currentColor" stroke-width="2">' +
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' +
    "</svg> ";
  html +=
    (postData.likes ? Object.keys(postData.likes).length : 0) +
    " Beğeni</button>";
  html += '<button class="post-action-btn">';
  html +=
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
    "</svg> Yorum</button>";
  html += '<span class="post-date">' + escHtml(formatDateTime(postData.createdAt)) + "</span>";
  html += "</div>";

  html += "</div>";

  return html;
}

/* POST AKISINI GUNCELLE */

function updatePostsFeed() {
  if (!postsFeed) return;

  var postsArray = Object.keys(allPosts)
    .map(function (id) {
      return { id: id, data: allPosts[id] };
    })
    .sort(function (a, b) {
      return (b.data.createdAt || 0) - (a.data.createdAt || 0);
    });

  if (postsArray.length === 0) {
    postsFeed.innerHTML =
      '<div class="posts-empty">Henüz hiç gönderin yok.<br>Akış sayfasından ilk gönderini yayınla.</div>';
    return;
  }

  var html = "";
  postsArray.forEach(function (p) {
    html += renderPost(p.id, p.data);
  });
  postsFeed.innerHTML = html;
}

/* POST BEGENI */

function toggleLike(postId) {
  var user = firebase.auth().currentUser;
  if (!user) return;
  togglePostLike(postId, user.uid)
    .then(function () {
      updatePostsFeed();
      updateProfilePosts();
    })
    .catch(function () {
      if (window.showToast) showToast("İşlem başarısız.");
    });
}

/* POST MENU */

function togglePostMenu(postId) {
  var dropdown = document.getElementById("postDropdown-" + postId);
  if (!dropdown) return;

  document.querySelectorAll(".post-dropdown.active").forEach(function (el) {
    if (el !== dropdown) el.classList.remove("active");
  });

  dropdown.classList.toggle("active");

  if (dropdown.classList.contains("active")) {
    setTimeout(function () {
      var close = function (e) {
        if (
          !dropdown.contains(e.target) &&
          !e.target.classList.contains("post-menu-btn")
        ) {
          dropdown.classList.remove("active");
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 10);
  }
}

/* POST SILME */

function confirmDeletePost(postId) {
  var dropdown = document.getElementById("postDropdown-" + postId);
  if (dropdown) dropdown.classList.remove("active");

  if (window.showConfirm) {
    showConfirm("Gönderi silinsin mi?", function () {
      deletePostFromFirebase(postId).then(function () {
        if (window.showToast) showToast("Gönderi silindi.");
      });
    });
  } else {
    if (confirm("Gönderi silinsin mi?")) {
      deletePostFromFirebase(postId).then(function () {
        if (window.showToast) showToast("Gönderi silindi.");
      });
    }
  }
}

/* POST DINLEYICISI */

function initPosts() {
  if (typeof initPostsListener !== "function") {
    setTimeout(initPosts, 500);
    return;
  }
  initPostsListener(function (postId, postData, type) {
    if (type === "removed") {
      delete allPosts[postId];
    } else {
      allPosts[postId] = postData;
      if (postData && postData.uid === firebase.auth().currentUser?.uid) {
        allPosts[postId].avatarUrl =
          firebase.auth().currentUser?.photoURL || "";
      }
    }
    updatePostsFeed();
    updateProfilePosts();
  });
}

/* EVENT LISTENERS */

if (publishPostBtn) {
  publishPostBtn.addEventListener("click", createPost);
}

if (postImageBtn) {
  postImageBtn.addEventListener("click", function () {
    if (postImageInput) postImageInput.click();
  });
}

if (postImageInput) {
  postImageInput.addEventListener("change", handlePostImageUpload);
}

/* SAYFA YUKLENDIGINDE POSTLARI BASLAT */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(initPosts, 500);
  });
} else {
  setTimeout(initPosts, 500);
}

/* PROFIL POST YONETIMI */

var userPostsTab = document.getElementById("userPostsTab");
var likedPostsTab = document.getElementById("likedPostsTab");
var profileTabs = document.querySelectorAll(".profile-tabs .tab-btn");
var currentProfileTab = "user-posts";

function switchProfileTab(tabName) {
  currentProfileTab = tabName;

  profileTabs.forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  var userTab = document.getElementById("userPostsTab");
  var likedTab = document.getElementById("likedPostsTab");

  if (userTab) userTab.classList.toggle("active", tabName === "user-posts");
  if (likedTab) likedTab.classList.toggle("active", tabName === "liked-posts");

  updateProfilePosts();
}

function updateProfilePosts() {
  var currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  var userTab = document.getElementById("userPostsTab");
  var likedTab = document.getElementById("likedPostsTab");

  if (currentProfileTab === "user-posts" && userTab) {
    var userPosts = Object.keys(allPosts)
      .filter(function (id) {
        return allPosts[id].uid === currentUser.uid;
      })
      .map(function (id) {
        return { id: id, data: allPosts[id] };
      })
      .sort(function (a, b) {
        return (b.data.createdAt || 0) - (a.data.createdAt || 0);
      });

    if (userPosts.length === 0) {
      userTab.innerHTML =
        '<div class="posts-empty">Henüz hiç gönderin yok.<br>Akış sayfasından ilk gönderini yayınla.</div>';
    } else {
      var html = "";
      userPosts.forEach(function (p) {
        html += renderPost(p.id, p.data);
      });
      userTab.innerHTML = html;
    }
  }

  if (currentProfileTab === "liked-posts" && likedTab) {
    var likedPosts = Object.keys(allPosts)
      .filter(function (id) {
        var post = allPosts[id];
        return post.likes && post.likes[currentUser.uid];
      })
      .map(function (id) {
        return { id: id, data: allPosts[id] };
      })
      .sort(function (a, b) {
        return (b.data.createdAt || 0) - (a.data.createdAt || 0);
      });

    if (likedPosts.length === 0) {
      likedTab.innerHTML =
        '<div class="posts-empty">Henüz beğendiğin gönderi yok.</div>';
    } else {
      var html = "";
      likedPosts.forEach(function (p) {
        html += renderPost(p.id, p.data);
      });
      likedTab.innerHTML = html;
    }
  }
}

profileTabs.forEach(function (btn) {
  btn.addEventListener("click", function () {
    switchProfileTab(btn.dataset.tab);
  });
});

var _origShowPage = window.showPage;
if (typeof _origShowPage === "function") {
  window.showPage = function (pageName) {
    _origShowPage(pageName);
    if (pageName === "profile") {
      setTimeout(updateProfilePosts, 300);
    }
  };
}
