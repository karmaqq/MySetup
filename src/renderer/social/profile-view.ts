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
} from "../core/app-state";
import {
  getUserPublicData,
  getUserPrivacySettings,
} from "../data/firebase-user";
import { initUserDataRef } from "../data/firebase-core";
import { refreshAllAvatars, _walkAndUpdateAvatar, showToast } from "../core/global-fn";
import { getFromAvatarCache } from "../core/global-ut";

/* ─────────────────── Kilit SVG Sabiti ─────────────────── */

const LOCK_SVG = '<span class="tab-lock-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>';

/* ─────────────────── Profil Ziyareti Aç ─────────────────── */

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

  getUserPublicData(uid).then(function (publicData) {
    return getUserPrivacySettings(uid).then(function (privacy) {
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
    });
  }).catch(function () {
    showPage("profile");
  });
}
(window as any).openUserProfile = openUserProfile;

/* ─────────────────── Ziyaretten Çık ─────────────────── */

export function exitViewingProfile(): void {
  if (!_isViewingProfile) return;
  setViewingState(null);
  var user = currentUser;
  if (user) {
    initUserDataRef(user.uid);
  }
  _restoreOwnProfileUI();
}
(window as any).exitViewingProfile = exitViewingProfile;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          UI GÜNCELLEME                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Ziyaret Modu Profil UI ─────────────────── */

function _updateProfileUIForViewing(): void {
  var settingsBtn = document.getElementById("profileSettingsBtn");
  var avatarBtn = document.getElementById("profileAvatarBtn");
  var invBtn = document.getElementById("viewInventoryBtn");
  var profileUsername = document.getElementById("profileUsername");
  var profileEmail = document.getElementById("profileEmail");
  var data = _viewingUserData;

  if (settingsBtn) settingsBtn.style.display = "none";
  if (avatarBtn) avatarBtn.style.display = "none";
  if (profileUsername) profileUsername.textContent = data ? data.username : "Kullanıcı";
  if (profileEmail) profileEmail.textContent = "";

  if (data && data.avatarUrl) {
    _walkAndUpdateAvatar(data.uid, data.avatarUrl);
  } else if (data) {
    _walkAndUpdateAvatar(data.uid, null);
  }
  refreshAllAvatars(data ? data.username : "Kullanıcı", data ? data.avatarUrl || undefined : undefined);

  if (typeof (window as any)._resetTabStates === "function") {
    (window as any)._resetTabStates();
  }

  /* ─── Sekme butonları: gizli değil deaktif ─── */
  document.querySelectorAll(".profile-tabs .tab-btn[data-tab]").forEach(function (b) {
    var el = b as HTMLElement;
    var tab = el.dataset.tab;
    el.style.display = "";
    el.classList.remove("tab-disabled");
    var lockIcon = el.querySelector(".tab-lock-icon");
    if (lockIcon) lockIcon.remove();
    if (tab === "liked-posts" && data && data.likesPrivacy) {
      el.classList.add("tab-disabled");
      el.insertAdjacentHTML("beforeend", LOCK_SVG);
    }
  });

  /* ─── Envanter butonuna kilit ─── */
  if (invBtn) {
    invBtn.style.display = "";
    var lockSvg = invBtn.querySelector(".tab-lock-icon");
    if (lockSvg) lockSvg.remove();
    if (data && data.inventoryPrivacy) {
      invBtn.insertAdjacentHTML("beforeend", LOCK_SVG);
    }
  }

  var _pendingTab = (window as any)._pendingProfileTab;
  if (!_pendingTab) {
    sessionStorage.removeItem("_profileTab");
    (window as any)._profileTab = null;
  }

  document.querySelectorAll(".self-only").forEach(function (el) {
    (el as HTMLElement).style.display = "none";
  });
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
    el.style.display = "";
    el.classList.remove("tab-disabled");
    var lockIcon = el.querySelector(".tab-lock-icon");
    if (lockIcon) lockIcon.remove();
  });

  /* ─── Envanter butonundan kilit ikonunu temizle ─── */
  if (invBtn) {
    invBtn.style.display = "";
    var lockSvg = invBtn.querySelector(".tab-lock-icon");
    if (lockSvg) lockSvg.remove();
  }

  var ownAvatar = user ? getFromAvatarCache(user.uid) || undefined : undefined;
  refreshAllAvatars(user ? user.displayName || "Kullanıcı" : "Kullanıcı", ownAvatar);

  sessionStorage.removeItem("_profileTab");
  (window as any)._profileTab = null;

  document.querySelectorAll(".self-only").forEach(function (el) {
    (el as HTMLElement).style.display = "";
  });

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
    initUserDataRef(_viewingUserId, true);
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
        initUserDataRef(targetUid, true);
      }
    }
    if (backBtn) {
      backBtn.style.display = "";
      var nameEl = document.getElementById("backProfileName");
      if (nameEl) {
        nameEl.textContent = _isViewingProfile && _viewingUserData ? _viewingUserData.username : (currentUser ? currentUser.displayName || "Kullanıcı" : "Kullanıcı");
      }
    }
    return;
  }

  if (_isViewingProfile && pageName === "profile") {
    if (backBtn) backBtn.style.display = "none";
    _updateProfileUIForViewing();
    return;
  }

  if (!_isViewingProfile) {
    if (backBtn) backBtn.style.display = "none";
    return;
  }

  if (pageName !== "profile" && pageName !== "inventory") {
    exitViewingProfile();
  }
}

/* ─────────────────── Mevcut onPageChange'e ekle ─────────────────── */

var origOnPageChange = (window as any)._onPageChange;
(window as any)._onPageChange = function (pageName: string): void {
  if (typeof origOnPageChange === "function") origOnPageChange(pageName);
  _onPageChangeForViewing(pageName);
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        RESTORE ON LOGIN                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa yenilemede viewing state'i geri yükle ─────────────────── */

var _restoreTimer: number | null = null;

function _tryRestoreViewingState(): void {
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
  if (_restoreTimer) clearTimeout(_restoreTimer);
  _restoreTimer = window.setTimeout(function () {
    _restoreTimer = null;
    _tryRestoreViewingState();
  }, 300);
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        EVENT DİNLEYİCİLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.getElementById("viewInventoryBtn")?.addEventListener("click", function () {
  openViewingInventory();
});

document.getElementById("backToProfileBtn")?.addEventListener("click", function () {
  backToProfileFromInventory();
});
