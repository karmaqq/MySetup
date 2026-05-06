/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              SİLME İŞLEMLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post silme onayı ─────────────────── */

function _confirmDeletePost(postId) {
  var postData = allPosts[postId];
  showConfirm("Bu gönderiyi silmek istediğine emin misin?", function () {
    deletePostFromFirebase(postId, postData)
      .then(function () {
        showToast("Gönderi silindi.", "success");
      })
      .catch(function () {
        showToast("Gönderi silinemedi.", "error");
      });
  });
}

/* ─────────────────── Yorum silme onayı ─────────────────── */

function _confirmDeleteComment(postId, commentId) {
  showConfirm("Yorum silinsin mi?", function () {
    const thread = document.getElementById(
      "commentThread-" + postId + "-" + commentId,
    );
    if (thread) {
      thread.style.transition = "opacity 0.3s, transform 0.3s";
      thread.style.opacity = "0";
      thread.style.transform = "translateY(4px)";
      setTimeout(function () {
        thread.remove();
      }, 320);
    }
    deleteCommentFromFirebase(postId, commentId)
      .then(function () {
        showToast("Yorum silindi.", "success");
      })
      .catch(function () {
        showToast("Yorum silinemedi.", "error");
        if (thread) {
          thread.style.opacity = "1";
          thread.style.transform = "translateY(0)";
        }
      });
  });
}

/* ─────────────────── Yanıt silme onayı ─────────────────── */

function _confirmDeleteReply(postId, commentId, replyId) {
  showConfirm("Yanıt silinsin mi?", function () {
    const replyEl = document.querySelector(
      '[data-reply-id="' + replyId + '"]',
    );
    if (replyEl) {
      replyEl.style.transition = "opacity 0.3s, transform 0.3s";
      replyEl.style.opacity = "0";
      replyEl.style.transform = "translateY(4px)";
      setTimeout(function () {
        replyEl.remove();
      }, 320);
    }
    deleteReplyFromFirebase(postId, commentId, replyId)
      .then(function () {
        showToast("Yanıt silindi.", "success");
      })
      .catch(function () {
        showToast("Yanıt silinemedi.", "error");
        if (replyEl) {
          replyEl.style.opacity = "1";
          replyEl.style.transform = "translateY(0)";
        }
      });
  });
}
