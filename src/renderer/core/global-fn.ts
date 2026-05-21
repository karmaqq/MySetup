/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          PAYLAŞILAN UYGULAMA FONKSİYONLARI                */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { isAnyModalOpen, getAvatarLetter, escAttr, getFromAvatarCache } from "./global-ut";

/* ─────────────────── Toast Bildirimi ─────────────────── */

export function showToast(message: string, type: string = "info", duration: number = 3200): void {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons: Record<string, string> = { success: "✓", error: "✕", warn: "⚠", info: "i" };
  const icon = document.createElement("span");
  const text = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = icons[type] || "i";
  text.textContent = message;
  toast.append(icon, text);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  setTimeout(() => {
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }, duration);
}

/* ─────────────────── Onay Diyaloğu ─────────────────── */

export function showConfirm(message: string, onConfirm: () => void, opts?: { yesText?: string; noText?: string }): void {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const existing = container.querySelector(".toast-confirm");
  if (existing) {
    existing.classList.remove("visible");
    existing.remove();
  }
  const yesText = (opts && opts.yesText) || "Evet, Devam Et";
  const noText = (opts && opts.noText) || "İptal";
  const toast = document.createElement("div");
  toast.className = "toast toast-confirm";
  const text = document.createElement("div");
  const actions = document.createElement("div");
  const yesBtn = document.createElement("button");
  const noBtn = document.createElement("button");

  text.textContent = message;
  actions.className = "toast-actions";
  yesBtn.className = "toast-yes";
  noBtn.className = "toast-no";
  yesBtn.type = "button";
  noBtn.type = "button";
  yesBtn.textContent = yesText;
  noBtn.textContent = noText;
  actions.append(yesBtn, noBtn);
  toast.append(text, actions);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  function _dismissConfirm() {
    if (autoTimeout) clearTimeout(autoTimeout);
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }

  const autoTimeout = setTimeout(_dismissConfirm, 15000);

  yesBtn.onclick = () => {
    _dismissConfirm();
    onConfirm();
  };
  noBtn.onclick = _dismissConfirm;
}

/* ─────────────────── Render Yönetimi ─────────────────── */

let _renderRafId: number | null = null;

export function scheduleRender(): void {
  if (_renderRafId) cancelAnimationFrame(_renderRafId);
  _renderRafId = requestAnimationFrame(function () {
    _renderRafId = null;
    if (typeof (window as any).renderAll === "function")
      (window as any).renderAll();
  });
}

/* ─────────────────── Avatar Güncelleme ─────────────────── */

export function updateAvatarImage(
  elementId: string,
  url: string | null,
  name?: string,
): void {
  var el = document.getElementById(elementId);
  if (!el) return;
  var letterSpan = el.querySelector("span") as HTMLElement | null;
  var existingImg = el.querySelector(
    "img.avatar-img",
  ) as HTMLImageElement | null;

  if (url) {
    if (existingImg) {
      existingImg.src = url;
      if (name) existingImg.alt = name;
    } else {
      if (letterSpan) letterSpan.style.display = "none";
      var newImg = document.createElement("img");
      newImg.className = "avatar-img";
      newImg.src = url;
      newImg.alt = name || "Avatar";
      el.appendChild(newImg);
    }
    el.classList.add("has-image");
  } else {
    if (existingImg) existingImg.remove();
    if (letterSpan) {
      letterSpan.style.display = "";
      if (name) letterSpan.textContent = getAvatarLetter(name);
    }
    el.classList.remove("has-image");
  }
}

export function refreshAllAvatars(name: string, avatarUrl?: string): void {
  updateAvatarImage("sidebarAvatar", avatarUrl || null, name);
  updateAvatarImage("profileAvatarContainer", avatarUrl || null, name);
}

export function buildAvatarHTML(
  name: string,
  cssClass: string,
  uid?: string,
  avatarUrl?: string,
): string {
  var dataAttr = uid ? ' data-uid="' + escAttr(uid) + '"' : "";
  var actionAttr = uid ? ' data-action="view-profile"' : "";
  var finalUrl = avatarUrl;
  if (uid) {
    var cached = getFromAvatarCache(uid);
    if (cached) finalUrl = cached;
  }
  if (finalUrl) {
    return (
      '<div class="' +
      cssClass +
      '"' +
      dataAttr +
      actionAttr +
      ">" +
      '<img src="' +
      escAttr(finalUrl) +
      '" alt="' +
      escAttr(name) +
      '" class="avatar-img" />' +
      "</div>"
    );
  }
  return (
    '<div class="' +
    cssClass +
    '"' +
    dataAttr +
    actionAttr +
    ">" +
    "<span>" +
    getAvatarLetter(name) +
    "</span>" +
    "</div>"
  );
}

export function _walkAndUpdateAvatar(uid: string, url: string | null): void {
  var selector = '[data-uid="' + escAttr(uid) + '"]';
  var elements = document.querySelectorAll(selector);
  elements.forEach(function (el) {
    if (
      !el.classList.contains("post-avatar") &&
      !el.classList.contains("comment-avatar") &&
      !el.classList.contains("reply-avatar")
    ) return;
    var existingImg = el.querySelector(
      "img.avatar-img",
    ) as HTMLImageElement | null;
    var letterSpan = el.querySelector("span") as HTMLElement | null;

    if (url) {
      if (existingImg) {
        existingImg.src = url;
      } else {
        if (letterSpan) letterSpan.style.display = "none";
        var img = document.createElement("img");
        img.className = "avatar-img";
        img.src = url;
        img.alt = "Avatar";
        el.appendChild(img);
      }
      el.classList.add("has-image");
    } else {
      if (existingImg) existingImg.remove();
      if (letterSpan) letterSpan.style.display = "";
      el.classList.remove("has-image");
    }
  });
}

/* ─────────────────── Post Kartı Yardımcıları ─────────────────── */

export function getPostCards(postId: string): NodeListOf<Element> {
  return document.querySelectorAll('[data-post-id="' + escAttr(postId) + '"]');
}

export function buildPostMenuHTML(pid: string, isOwn: boolean): string {
  if (!isOwn) return "";
  const ePid = escAttr(pid);
  return (
    '<button class="post-menu-btn" data-action="post-menu" data-id="' +
    ePid +
    '">⋮</button>' +
    '<div class="post-dropdown" id="postDropdown-' +
    ePid +
    '">' +
    '<button class="post-dropdown-item delete" data-action="delete-post" data-id="' +
    ePid +
    '">' +
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    "</svg> Sil</button></div>"
  );
}

export function getTotalCommentCount(post: any): number {
  if (!post || !post.comments) return 0;
  let total = Object.keys(post.comments).length;
  Object.keys(post.comments).forEach(function (cid) {
    if (post.comments[cid].replies)
      total += Object.keys(post.comments[cid].replies).length;
  });
  return total;
}

/* ─────────────────── "Daha Fazla Göster" Butonu ─────────────────── */

export function renderLoadMoreBtn(
  afterEl: Element,
  btnId: string,
  onClick: () => void,
): void {
  if (document.getElementById(btnId)) return;
  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "load-more-btn";
  btn.textContent = "Daha Fazla Göster";
  btn.onclick = onClick;
  afterEl.parentNode!.insertBefore(btn, afterEl.nextSibling);
}

export function removeLoadMoreBtn(btnId: string): void {
  const btn = document.getElementById(btnId);
  if (btn) btn.remove();
}
