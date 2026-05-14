/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BİLDİRİM SİSTEMİ                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { currentUser } from "../core/app-state";
import { showToast, showConfirm } from "../core/global-fn";
import {
  deletePostFromFirebase,
  getPostsByIds,
} from "../data/firebase-post";
import {
  deleteCommentFromFirebase,
  deleteReplyFromFirebase,
} from "../data/firebase-comment";

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
    post: async function () {
      const allPostsGlobal = (window as any).allPosts || {};
      let postData = allPostsGlobal[ids.postId];
      if (!postData) {
        const fetched = await getPostsByIds([ids.postId], {});
        postData = fetched[ids.postId] || { uid: currentUser?.uid };
      }
      return deletePostFromFirebase(ids.postId, postData);
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

/* ─────────────────── Dışa Aktarılan Silme Onayları ─────────────────── */
export const _confirmDeletePost = (postId: string) => _confirmDelete("post", { postId });
export const _confirmDeleteComment = (postId: string, commentId: string) => _confirmDelete("comment", { postId, commentId });
export const _confirmDeleteReply = (postId: string, commentId: string, replyId: string) => _confirmDelete("reply", { postId, commentId, replyId });
