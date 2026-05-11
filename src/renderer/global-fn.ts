/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          PAYLAŞILAN UYGULAMA FONKSİYONLARI                */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { isAnyModalOpen, getAvatarLetter } from "./global-ut";

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
let _pendingRender = false;

export function scheduleRender(): void {
  if (isAnyModalOpen()) {
    _pendingRender = true;
    return;
  }
  if (_renderRafId) cancelAnimationFrame(_renderRafId);
  _renderRafId = requestAnimationFrame(function () {
    _renderRafId = null;
    if (typeof (window as any).renderAll === "function")
      (window as any).renderAll();
  });
}

/* ─────────────────── Avatar Güncelleme ─────────────────── */

export function updateAvatarLetter(elementId: string, name: string): void {
  const el = document.getElementById(elementId);
  if (el) el.textContent = (name || "?").charAt(0).toUpperCase();
}

export function refreshAllAvatars(name: string): void {
  updateAvatarLetter("profileAvatarLetter", name);
  updateAvatarLetter("sidebarAvatar", name);
}

export function buildAvatarHTML(name: string, cssClass: string): string {
  return '<div class="' + cssClass + '">' + getAvatarLetter(name) + "</div>";
}

/* ─────────────────── Post Kartı Yardımcıları ─────────────────── */

export function getPostCards(postId: string): NodeListOf<Element> {
  return document.querySelectorAll('[data-post-id="' + postId + '"]');
}

export function buildPostMenuHTML(pid: string, isOwn: boolean): string {
  if (!isOwn) return "";
  return (
    '<button class="post-menu-btn" data-action="post-menu" data-id="' +
    pid +
    '">⋮</button>' +
    '<div class="post-dropdown" id="postDropdown-' +
    pid +
    '">' +
    '<button class="post-dropdown-item delete" data-action="delete-post" data-id="' +
    pid +
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
