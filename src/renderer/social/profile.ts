/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL SEKMESİ YÖNETİMİ                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { _initUserPostsTab, _initLikedPostsTab, TAB } from "./profile-tabs";

/* ─────────────────── Profil sekmesi değiştğinde çağrılır ─────────────────── */

function updateProfilePosts(): void {
  if ((window as any)._pendingProfileTab) {
    switchProfileTab((window as any)._pendingProfileTab);
    (window as any)._pendingProfileTab = null;
  } else {
    const savedTab = sessionStorage.getItem("_profileTab");
    switchProfileTab(savedTab === "liked-posts" ? "liked-posts" : "user-posts");
  }
}
(window as any).updateProfilePosts = updateProfilePosts;

function switchProfileTab(tabName: string): void {
  var targetBtn = document.querySelector('.profile-tabs .tab-btn[data-tab="' + tabName + '"]');
  if (targetBtn && (targetBtn as HTMLElement).classList.contains("tab-disabled")) return;

  (window as any)._profileTab = tabName;

  sessionStorage.setItem("_profileTab", tabName);

  /* ─────────────────── Tab görünürlüğünü güncelle ─────────────────── */
  document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  const activeBtn = document.querySelector(
    '.profile-tabs .tab-btn[data-tab="' + tabName + '"]',
  ) as HTMLElement | null;
  if (activeBtn) activeBtn.classList.add("active");
  document.querySelectorAll("#profilePage .tab-content").forEach(function (c) {
    c.classList.remove("active");
  });
  const targetId = tabName === "user-posts" ? TAB.USER_POSTS : TAB.LIKED_POSTS;
  const target = document.getElementById(targetId);
  if (target) target.classList.add("active");

  if (tabName === "user-posts") {
    _initUserPostsTab();
  } else if (tabName === "liked-posts") {
    _initLikedPostsTab();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       SAYFA DEĞİŞİMİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa değiştğinde profil sekmelerini temizle ─────────────────── */

function _onPageChange(pageName: string): void {
  if (pageName !== "profile") {
    (window as any)._profileTab = null;
    sessionStorage.removeItem("_profileTab");
  }
}
(window as any)._onPageChange = _onPageChange;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PROFİL SEKME BUTONLARI                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function (this: HTMLElement) {
    if (this.classList.contains("tab-disabled")) return;
    const tab = this.dataset.tab!;
    document.querySelectorAll(".profile-tabs .tab-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    this.classList.add("active");
    document
      .querySelectorAll("#profilePage .tab-content")
      .forEach(function (c) {
        c.classList.remove("active");
      });
    const target = document.getElementById(
      tab === "user-posts" ? TAB.USER_POSTS : TAB.LIKED_POSTS,
    );
    if (target) target.classList.add("active");
    switchProfileTab(tab);
  });
});
