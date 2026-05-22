/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL ZİYARET YÖNETİMİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  _viewingUserId,
  _viewingUserData,
  _isViewingProfile,
  currentUser,
  setViewingState,
  showPage,
  mainScroll,
  registerPageChangeHandler,
} from "../core/app-state";
import {
  getUserPublicData,
  getUserPrivacySettings,
} from "../data/firebase-user";
import { initUserDataRef } from "../data/firebase-core";
import { refreshAllAvatars, showToast, updateAvatarImage } from "../core/global-fn";
import { getFromAvatarCache } from "../core/global-ut";
import { db } from "../core/firebase-init";

/* ─────────────────── Kilit SVG Sabiti ─────────────────── */

/* ─────────────────── Ziyaret Edilen Kullanıcı Önbelleği ─────────────────── */

interface CachedUserData {
  publicData: { username: string; avatarUrl?: string | null };
  privacy: { inventoryPrivacy: boolean; likesPrivacy: boolean };
  fetchedAt: number;
}

var _visitedUsersCache: Record<string, CachedUserData> = {};
var _CACHE_TTL = 5 * 60 * 1000;

function _applyViewingState(uid: string, publicData: { username: string; avatarUrl?: string | null }, privacy: { inventoryPrivacy: boolean; likesPrivacy: boolean }): void {
  var userData = {
    uid: uid,
    username: publicData.username,
    avatarUrl: publicData.avatarUrl,
    inventoryPrivacy: privacy.inventoryPrivacy,
    likesPrivacy: privacy.likesPrivacy,
  };
  setViewingState(uid, userData);
  _updateProfileUIForViewing();
  showPage("profile");
}

/* ─────────────────── Profil Ziyareti Aç ─────────────────── */

var _openProfileToken = 0;

export function openUserProfile(uid: string): void {
  var user = currentUser;
  if (!user) return;
  if (uid === user.uid) {
    exitViewingProfile();
    showPage("profile");
    return;
  }
  if (_isViewingProfile && _viewingUserId === uid) {
    showPage("profile");
    return;
  }

  var cached = _visitedUsersCache[uid];
  var now = Date.now();
  if (cached && now - cached.fetchedAt < _CACHE_TTL) {
    _applyViewingState(uid, cached.publicData, cached.privacy);
    return;
  }

  var token = ++_openProfileToken;

  Promise.all([getUserPublicData(uid), getUserPrivacySettings(uid)])
    .then(function ([publicData, privacy]) {
      if (token !== _openProfileToken) return;
      _visitedUsersCache[uid] = { publicData, privacy, fetchedAt: Date.now() };
      _applyViewingState(uid, publicData, privacy);
    })
    .catch(function () {
      if (token !== _openProfileToken) return;
      showPage("profile");
    });
}
(window as any).openUserProfile = openUserProfile;

/* ─────────────────── Ziyaretten Çık ─────────────────── */

export function exitViewingProfile(): void {
  if (!_isViewingProfile) return;
  setViewingState(null);
  _restoreOwnProfileUI();
  var user = currentUser;
  if (user) {
    var ownPath = "users/" + user.uid + "/components";
    if (db.activeBasePath !== ownPath) {
      initUserDataRef(user.uid);
    }
  }
}
(window as any).exitViewingProfile = exitViewingProfile;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          UI GÜNCELLEME                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ziyaret Modu Profil UI ─────────────────── */

var _prevViewingUid: string | null = null;

function _updateProfileUIForViewing(): void {
  var data = _viewingUserData;
  if (data && _prevViewingUid !== data.uid) {
    if (typeof (window as any)._resetTabStates === "function") {
      (window as any)._resetTabStates();
    }
    _prevViewingUid = data.uid;
  }
  var settingsBtn = document.getElementById("profileSettingsBtn");
  var avatarBtn = document.getElementById("profileAvatarBtn");
  var invBtn = document.getElementById("viewInventoryBtn");
  var profileUsername = document.getElementById("profileUsername");
  var profileEmail = document.getElementById("profileEmail");

  if (settingsBtn) settingsBtn.style.display = "none";
  if (avatarBtn) avatarBtn.style.display = "none";
  if (profileUsername) profileUsername.textContent = data ? data.username : "Kullanıcı";
  if (profileEmail) profileEmail.textContent = "";

  updateAvatarImage("profileAvatarContainer", data ? data.avatarUrl || null : null, data ? data.username : "Kullanıcı");

  /* ─── Sekme butonları: class toggle ile kilit ─── */
  document.querySelectorAll(".profile-tabs .tab-btn[data-tab]").forEach(function (b) {
    var el = b as HTMLElement;
    var tab = el.dataset.tab;
    el.classList.toggle("tab-disabled", tab === "liked-posts" && !!(data && data.likesPrivacy));
    el.classList.toggle("has-lock", tab === "liked-posts" && !!(data && data.likesPrivacy));
  });

  /* ─── Envanter butonuna kilit ─── */
  if (invBtn) {
    invBtn.classList.toggle("has-lock", !!(data && data.inventoryPrivacy));
  }

  var _pendingTab = (window as any)._pendingProfileTab;
  if (!_pendingTab) {
    sessionStorage.removeItem("_profileTab");
    (window as any)._profileTab = null;
  }

  document.body.classList.add("viewing-profile");
}

/* ─────────────────── Kendi Profiline Dön ─────────────────── */

function _restoreOwnProfileUI(): void {
  var settingsBtn = document.getElementById("profileSettingsBtn");
  var avatarBtn = document.getElementById("profileAvatarBtn");
  var invBtn = document.getElementById("viewInventoryBtn");
  var profileEmail = document.getElementById("profileEmail");
  var user = currentUser;

  if (settingsBtn) settingsBtn.style.display = "";
  if (avatarBtn) avatarBtn.style.display = "";

  if (user) {
    var profileUsername = document.getElementById("profileUsername");
    if (profileUsername) profileUsername.textContent = user.displayName || "Kullanıcı";
  }

  if (profileEmail) profileEmail.textContent = user ? user.email || "E-posta yok" : "";

  /* ─── Sekme butonlarını temizle ─── */
  document.querySelectorAll(".profile-tabs .tab-btn[data-tab]").forEach(function (b) {
    var el = b as HTMLElement;
    el.classList.remove("tab-disabled", "has-lock");
  });

  /* ─── Envanter butonundan kilit ikonunu temizle ─── */
  if (invBtn) {
    invBtn.classList.remove("has-lock");
  }

  var ownAvatar = user ? getFromAvatarCache(user.uid) || undefined : undefined;
  refreshAllAvatars(user ? user.displayName || "Kullanıcı" : "Kullanıcı", ownAvatar);

  sessionStorage.removeItem("_profileTab");
  (window as any)._profileTab = null;

  document.body.classList.remove("viewing-profile");
  _prevViewingUid = null;

  if (typeof (window as any)._resetTabStates === "function") {
    (window as any)._resetTabStates();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        ENVANTER GEÇİŞİ                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ziyaret Edilen Envanteri Aç ─────────────────── */

export function openViewingInventory(): void {
  if (_isViewingProfile) {
    var data = _viewingUserData;
    if (data && data.inventoryPrivacy) {
      showToast("Bu kullanıcı envanterini gizlemiş", "warn");
      return;
    }
    var expectedPath = "users/" + _viewingUserId + "/components";
    if (db.activeBasePath !== expectedPath) {
      initUserDataRef(_viewingUserId, true);
    }
  }
  showPage("inventory");
}
(window as any).openViewingInventory = openViewingInventory;

/* ─────────────────── Envanterden Profil'e Dön ─────────────────── */

export function backToProfileFromInventory(): void {
  if (_isViewingProfile) exitViewingProfile();
  showPage("profile");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        SİDEBAR DİNLEME                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Profil butonuna tıklanınca ziyaretten çık ─────────────────── */

function _initSidebarProfileNav(): void {
  var profileBtn = document.querySelector('.sidebar-nav-btn[data-page="profile"]');
  if (!profileBtn) return;

  profileBtn.addEventListener("click", function () {
    if (_isViewingProfile) {
      exitViewingProfile();
    }
  });
}

_initSidebarProfileNav();

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        SAYFA DEĞİŞİMİ                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _onPageChangeForViewing(pageName: string): void {
  var backBtn = document.getElementById("backToProfileBtn");

  if (pageName === "inventory") {
    if (_isViewingProfile) {
      var targetUid = _viewingUserId;
      if (targetUid) {
        var expectedPath = "users/" + targetUid + "/components";
        if (db.activeBasePath !== expectedPath) {
          initUserDataRef(targetUid, true);
        }
      }
    }
    if (backBtn) {
      var nameEl = document.getElementById("backProfileName");
      if (nameEl) {
        nameEl.textContent = _isViewingProfile && _viewingUserData ? _viewingUserData.username : (currentUser ? currentUser.displayName || "Kullanıcı" : "Kullanıcı");
      }
    }
    return;
  }

  if (_isViewingProfile && pageName === "profile") {
    _updateProfileUIForViewing();
    return;
  }

  if (!_isViewingProfile) {
    return;
  }

  if (pageName !== "profile" && pageName !== "inventory") {
    exitViewingProfile();
  }
}

/* ─────────────────── Sayfa değişim handler'ını kaydet ─────────────────── */

registerPageChangeHandler(_onPageChangeForViewing);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        RESTORE ON LOGIN                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa yenilemede viewing state'i geri yükle ─────────────────── */

var _postsReadyForRestore = false;
var _authReadyForRestore = false;

function _maybeRestoreViewingState(): void {
  if (!_postsReadyForRestore || !_authReadyForRestore) return;
  var storedUid = sessionStorage.getItem("_viewingUserId");
  if (!storedUid) return;
  if (currentUser && storedUid === currentUser.uid) {
    setViewingState(null);
    return;
  }
  if (currentUser) {
    openUserProfile(storedUid);
  }
}

document.addEventListener("postsReady", function () {
  _postsReadyForRestore = true;
  _maybeRestoreViewingState();
}, { once: true });

document.addEventListener("authReady", function () {
  _authReadyForRestore = true;
  _maybeRestoreViewingState();
}, { once: true });

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        EVENT DİNLEYİCİLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.getElementById("viewInventoryBtn")?.addEventListener("click", function () {
  openViewingInventory();
});

document.getElementById("backToProfileBtn")?.addEventListener("click", function () {
  backToProfileFromInventory();
});
