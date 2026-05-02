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
        '<button class="remove-post-image-btn" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.7); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>' +
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

/* POST HELPER FONKSIYONLARI */

function _createPostElement(postId, postData) {
  var wrapper = document.createElement("div");
  wrapper.innerHTML = renderPost(postId, postData);
  return wrapper.firstElementChild;
}

function _prependPostToFeed(postId, postData) {
  var feed = document.getElementById("postsFeed");
  if (!feed) return;
  var empty = feed.querySelector(".posts-empty");
  if (empty) empty.remove();
  var el = _createPostElement(postId, postData);
  el.style.opacity = "0";
  el.style.transform = "translateY(-8px)";
  el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  feed.insertBefore(el, feed.firstChild);
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

function _patchPostCard(postId, postData) {
  var existing = document.querySelector('[data-post-id="' + postId + '"]');
  if (!existing) return;
  var newEl = _createPostElement(postId, postData);
  existing.replaceWith(newEl);
}

function _softRemovePost(postId) {
  document
    .querySelectorAll('[data-post-id="' + postId + '"]')
    .forEach(function (el) {
      el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      setTimeout(function () {
        el.remove();
      }, 320);
    });
}

function _onlyLikesChanged(oldPost, newPost) {
  var fields = ["content", "imageUrl", "username", "uid", "createdAt"];
  for (var i = 0; i < fields.length; i++) {
    if (oldPost[fields[i]] !== newPost[fields[i]]) return false;
  }
  return true;
}

function _patchPostLikes(postId, likes) {
  var currentUser = firebase.auth().currentUser;
  var likeCount = likes ? Object.keys(likes).length : 0;
  var liked = currentUser && likes && likes[currentUser.uid];

  document.querySelectorAll('[data-post-id="' + postId + '"]').forEach(function (card) {
    var btn = card.querySelector(".post-action-btn");
    if (!btn) return;
    btn.classList.toggle("liked", !!liked);
    var svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
    var textNodes = Array.from(btn.childNodes).filter(function (n) {
      return n.nodeType === 3;
    });
    if (textNodes.length) {
      textNodes[textNodes.length - 1].textContent =
        " " + likeCount + " Beğeni";
    }
  });
}

/* POST RENDER ETME */

function renderPost(postId, postData) {
  if (!postData) {
    var el = document.querySelector('[data-post-id="' + postId + '"]');
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

  var html = '<div class="post-card" data-post-id="' + escapedId + '">';
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
      '<button class="post-menu-btn">⋮</button>';
    html += '<div class="post-dropdown" id="postDropdown-' + escapedId + '">';
    html +=
      '<button class="post-dropdown-item delete">';
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
    '<button class="post-action-btn like-btn ' +
    (liked ? "liked" : "") +
    '">';
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
  var feed = document.getElementById("postsFeed");
  if (!feed) return;

  var targetOrder = Object.keys(allPosts).sort(function (a, b) {
    return (allPosts[b].createdAt || 0) - (allPosts[a].createdAt || 0);
  });

  if (!targetOrder.length) {
    feed.innerHTML = '<div class="posts-empty">Henüz hiç gönderin yok.<br>Akış sayfasından ilk gönderini yayınla.</div>';
    return;
  }

  // Silinmiş kartları kaldır
  feed.querySelectorAll("[data-post-id]").forEach(function (card) {
    var id = card.dataset.postId;
    if (!allPosts[id]) _softRemovePost(id);
  });

  // Eksik kartları ekle (scroll bozmadan)
  var prev = null;
  targetOrder.forEach(function (postId) {
    var existing = feed.querySelector('[data-post-id="' + postId + '"]');
    if (!existing) {
      var el = _createPostElement(postId, allPosts[postId]);
      if (prev) {
        prev.after(el);
      } else {
        feed.insertBefore(el, feed.firstChild);
      }
      prev = el;
    } else {
      prev = existing;
    }
  });
}

/* POST BEGENI */

function toggleLike(postId) {
  var user = firebase.auth().currentUser;
  if (!user) return;
  var post = allPosts[postId];
  if (!post) return;

  // 1. Optimistik: hafızayı ve DOM'u anında güncelle
  var alreadyLiked = post.likes && post.likes[user.uid];
  if (!post.likes) post.likes = {};
  if (alreadyLiked) {
    delete post.likes[user.uid];
  } else {
    post.likes[user.uid] = true;
  }
  _patchPostLikes(postId, post.likes);

  // 2. Firebase'e yaz — .then() YOK
  togglePostLike(postId, user.uid).catch(function () {
    // Başarısız: optimistiği geri al
    if (alreadyLiked) {
      post.likes[user.uid] = true;
    } else {
      delete post.likes[user.uid];
    }
    _patchPostLikes(postId, post.likes);
    if (window.showToast) showToast("Beğeni kaydedilemedi.", "error");
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
      deletePostFromFirebase(postId)
        .then(function () {
          // Firebase confirm gelince DOM'dan kaldır
          var el = document.querySelector('[data-post-id="' + postId + '"]');
          if (el) el.remove();
          delete allPosts[postId];
          if (window.showToast) showToast("Gönderi silindi.");
        })
        .catch(function () {
          if (window.showToast) showToast("Gönderi silinemedi.", "error");
        });
    });
  } else {
    if (confirm("Gönderi silinsin mi?")) {
      deletePostFromFirebase(postId)
        .then(function () {
          var el = document.querySelector('[data-post-id="' + postId + '"]');
          if (el) el.remove();
          delete allPosts[postId];
          if (window.showToast) showToast("Gönderi silindi.");
        })
        .catch(function () {
          if (window.showToast) showToast("Gönderi silinemedi.", "error");
        });
    }
  }
}

/* POST DINLEYICISI */

var _pendingNewPosts = {};
var _bannerEl = null;

function _showPendingBanner() {
  var count = Object.keys(_pendingNewPosts).length;
  if (!count) return;
  if (!_bannerEl) {
    _bannerEl = document.createElement("div");
    _bannerEl.className = "pending-posts-banner";
    _bannerEl.onclick = _flushPendingPosts;
    var feed = document.getElementById("postsFeed");
    if (feed && feed.parentNode) {
      feed.parentNode.insertBefore(_bannerEl, feed);
    }
  }
  _bannerEl.textContent = count + " yeni gönderi — görmek için tıkla";
  _bannerEl.style.display = "block";
}

function _flushPendingPosts() {
  Object.assign(allPosts, _pendingNewPosts);
  _pendingNewPosts = {};
  if (_bannerEl) _bannerEl.style.display = "none";
  updatePostsFeed();
}

function initPosts() {
  if (typeof initPostsListener !== "function") {
    setTimeout(initPosts, 500);
    return;
  }
  initPostsListener(function (postId, postData, type) {
    var currentUser = firebase.auth().currentUser;
    var isOwnAction =
      postData && currentUser && postData.uid === currentUser.uid;

    if (type === "removed") {
      delete allPosts[postId];
      if (document.querySelector('[data-post-id="' + postId + '"]')) {
        _softRemovePost(postId);
      }
      return;
    }

    if (type === "added") {
      if (isOwnAction) {
        allPosts[postId] = postData;
        if (postData && currentUser) {
          allPosts[postId].avatarUrl = currentUser.photoURL || "";
        }
        _prependPostToFeed(postId, postData);
      } else {
        _pendingNewPosts[postId] = postData;
        _showPendingBanner();
      }
      return;
    }

    if (type === "changed") {
      var oldPost = allPosts[postId];
      allPosts[postId] = postData;
      if (oldPost && _onlyLikesChanged(oldPost, postData)) {
        _patchPostLikes(postId, postData.likes);
      } else if (document.querySelector('[data-post-id="' + postId + '"]')) {
        _patchPostCard(postId, postData);
      }
    }
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
    // initPosts artık auth.js tarafından çağrılıyor
  });
} else {
  // initPosts artık auth.js tarafından çağrılıyor
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

  // Guard 1: Profil sayfası aktif mi?
  if (typeof _currentPage !== "undefined" && _currentPage !== "profile")
    return;

  var userTab = document.getElementById("userPostsTab");
  var likedTab = document.getElementById("likedPostsTab");

  // Guard 2 + 3: Sadece aktif ve görünür sekmeyi güncelle
  if (currentProfileTab === "user-posts" && userTab) {
    if (!userTab.classList.contains("active")) return;
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
    if (!likedTab.classList.contains("active")) return;
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
      var html2 = "";
      likedPosts.forEach(function (p) {
        html2 += renderPost(p.id, p.data);
      });
      likedTab.innerHTML = html2;
    }
  }
}

profileTabs.forEach(function (btn) {
  btn.addEventListener("click", function () {
    switchProfileTab(btn.dataset.tab);
  });
});

/* POST EVENT DELEGATION */

document.addEventListener("click", function (e) {
  // Like butonu
  var likeBtn = e.target.closest(".post-action-btn.like-btn");
  if (likeBtn) {
    var postCard = likeBtn.closest("[data-post-id]");
    if (postCard) toggleLike(postCard.dataset.postId);
    return;
  }

  // Menu butonu
  var menuBtn = e.target.closest(".post-menu-btn");
  if (menuBtn) {
    var postCard2 = menuBtn.closest("[data-post-id]");
    if (postCard2) togglePostMenu(postCard2.dataset.postId);
    return;
  }

  // Delete butonu
  var deleteBtn = e.target.closest(".post-dropdown-item.delete");
  if (deleteBtn) {
    var postCard3 = deleteBtn.closest("[data-post-id]");
    if (postCard3) confirmDeletePost(postCard3.dataset.postId);
    return;
  }

  // Remove post image butonu
  if (e.target.closest(".remove-post-image-btn")) {
    removePostImage();
    return;
  }
});
