/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BİLDİRİM SİSTEMİ                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { toastContainer } from "./utils";
import {
  deletePostFromFirebase,
  deleteCommentFromFirebase,
  deleteReplyFromFirebase,
} from "./firebase-post";

/* ─────────────────── Toast Bildirimi Göster ─────────────────── */

export function showToast(message: string, type: string = "info", duration: number = 3200): void {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons: Record<string, string> = { success: "✓", error: "✕", warn: "⚠", info: "i" };
  const icon = document.createElement("span");
  const text = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = icons[type] || "i";
  text.textContent = message;
  toast.append(icon, text);
  toastContainer.appendChild(toast);

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ONAY DİYALOĞU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function showConfirm(message: string, onConfirm: () => void, opts?: { yesText?: string; noText?: string }): void {
  if (!toastContainer) return;
  const existing = toastContainer.querySelector(".toast-confirm");
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
  toastContainer.appendChild(toast);

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SİLME İŞLEMLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Genel silme onayı (post/yorum/yanıt) ─────────────────── */

function _confirmDelete(type: string, ids: Record<string, string>): void {
  const messages: Record<string, string> = {
    post: "Bu gönderiyi silmek istediğine emin misin?",
    comment: "Yorum silinsin mi?",
    reply: "Yanıt silinsin mi?",
  };
  const successMessages: Record<string, string> = {
    post: "Gönderi silindi",
    comment: "Yorum silindi",
    reply: "Yanıt silindi",
  };
  const fns: Record<string, () => Promise<any>> = {
    post: function () {
      const allPostsGlobal = (window as any).allPosts || {};
      return deletePostFromFirebase(ids.postId, allPostsGlobal[ids.postId]);
    },
    comment: function () {
      return deleteCommentFromFirebase(ids.postId, ids.commentId);
    },
    reply: function () {
      return deleteReplyFromFirebase(ids.postId, ids.commentId, ids.replyId);
    },
  };
  showConfirm(messages[type], function () {
    let animEl: HTMLElement | null = null;
    if (type === "comment") {
      animEl = document.getElementById(
        "commentThread-" + ids.postId + "-" + ids.commentId,
      );
    } else if (type === "reply") {
      animEl = document.querySelector('[data-reply-id="' + ids.replyId + '"]') as HTMLElement | null;
    }
    if (animEl) {
      animEl.style.transition = "opacity 0.3s, transform 0.3s";
      animEl.style.opacity = "0";
      animEl.style.transform = "translateY(4px)";
    }
    fns[type]()
      .then(function () {
        if (animEl)
          setTimeout(function () {
            animEl!.remove();
          }, 320);
        showToast(successMessages[type], "success");
      })
      .catch(function () {
        if (animEl) {
          animEl.style.opacity = "1";
          animEl.style.transform = "translateY(0)";
        }
        showToast("Silinemedi", "error");
      });
  });
}

/* Dışa aktarılan silme onay fonksiyonları */
export const _confirmDeletePost = (postId: string) => _confirmDelete("post", { postId });
export const _confirmDeleteComment = (postId: string, commentId: string) => _confirmDelete("comment", { postId, commentId });
export const _confirmDeleteReply = (postId: string, commentId: string, replyId: string) => _confirmDelete("reply", { postId, commentId, replyId });
