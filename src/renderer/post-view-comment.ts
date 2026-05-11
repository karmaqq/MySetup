/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      POST VIEW YORUM/YANIT GÖNDERİMİ                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { addCommentToFirebase, addReplyToFirebase } from "./firebase-comment";
import { showToast } from "./global-fn";

let _replyTargetCommentId: string | null = null;
let _replyTargetUsername: string | null = null;

/* ─────────────────── Yanıt hedefini ayarlar ─────────────────── */

function _setPostViewReplyTarget(commentId: string, username: string): void {
  _replyTargetCommentId = commentId;
  _replyTargetUsername = username;

  var target = document.getElementById("postViewReplyTarget");
  var targetText = document.getElementById("postViewReplyTargetText");
  if (target && targetText) {
    targetText.textContent = "@" + username + " yanıtlanıyor";
    target.classList.add("visible");
  }

  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLTextAreaElement | null;
  if (input) {
    input.placeholder = "@" + username + " kişisine yanıtla...";
    input.focus();
  }
}

/* ─────────────────── Yanıt hedefini temizler ─────────────────── */

export function _clearPostViewReplyTarget(): void {
  _replyTargetCommentId = null;
  _replyTargetUsername = null;

  var target = document.getElementById("postViewReplyTarget");
  if (target) target.classList.remove("visible");

  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLTextAreaElement | null;
  if (input) input.placeholder = "Yorum yaz...";
}

/* ─────────────────── Yorum veya yanıt gönderir ─────────────────── */

export function _submitPostViewComment(): void {
  var input = document.getElementById(
    "postViewCommentInput",
  ) as HTMLElement | null;
  if (!input || !(window as any)._viewingPostId) return;
  if (!(window as any).allPosts[(window as any)._viewingPostId]) {
    showToast("Bu gönderi artık mevcut değil", "warn");
    return;
  }

  var user = firebase.auth().currentUser;
  if (!user) return;

  var text = (input as HTMLTextAreaElement).value.trim();
  if (!text) {
    showToast("Yorum metni boş olamaz", "warn");
    return;
  }

  var sendBtn = document.getElementById(
    "postViewSendBtn",
  ) as HTMLButtonElement | null;
  if (sendBtn) sendBtn.disabled = true;

  var baseData: Record<string, any> = {
    uid: user.uid,
    username: user.displayName || "Kullanici",
    text: text,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    likes: {},
  };

  function _done(): void {
    if (input) (input as HTMLTextAreaElement).value = "";
    if (sendBtn) {
      sendBtn.classList.remove("visible");
      sendBtn.disabled = false;
    }
  }

  function _fail(): void {
    if (sendBtn) sendBtn.disabled = false;
  }

  if (_replyTargetCommentId) {
    var targetCid = _replyTargetCommentId;
    var post = (window as any).allPosts[(window as any)._viewingPostId as string];
    if (!post || !post.comments || !post.comments[targetCid]) {
      showToast("Yanıtlamak istediğin yorum artık mevcut değil", "warn");
      _clearPostViewReplyTarget();
      _fail();
      return;
    }
    addReplyToFirebase((window as any)._viewingPostId, targetCid, baseData)
      .then(function () {
        _clearPostViewReplyTarget();
        showToast("Yanıt eklendi", "success");
        var repliesSec = document.getElementById(
          "replies-" + (window as any)._viewingPostId + "-" + targetCid,
        );
        if (repliesSec && repliesSec.classList.contains("hidden")) {
          repliesSec.classList.remove("hidden");
          var toggleBtn = document.getElementById(
            "toggleReplies-" + (window as any)._viewingPostId + "-" + targetCid,
          ) as HTMLElement | null;
          if (toggleBtn) toggleBtn.textContent = "yanıtları gizle";
        }
        _done();
      })
      .catch(function () {
        showToast("Yanıt eklenemedi", "error");
        _fail();
      });
  } else {
    addCommentToFirebase((window as any)._viewingPostId, baseData)
      .then(function () {
        showToast("Yorum eklendi", "success");
        _done();
      })
      .catch(function () {
        showToast("Yorum eklenemedi", "error");
        _fail();
      });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          OLAY DİNLEYİCİLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Yanıt iptal ─────────────────── */

var _pvReplyCancel = document.getElementById("postViewReplyCancel");
if (_pvReplyCancel)
  _pvReplyCancel.addEventListener("click", _clearPostViewReplyTarget);

/* ─────────────────── Composer input ─────────────────── */

var _pvInput = document.getElementById(
  "postViewCommentInput",
) as HTMLTextAreaElement | null;
if (_pvInput) {
  _pvInput.addEventListener("input", function (this: HTMLTextAreaElement) {
    var sendBtn = document.getElementById("postViewSendBtn");
    if (sendBtn)
      sendBtn.classList.toggle("visible", this.value.trim().length > 0);
  });

  _pvInput.addEventListener("keydown", function (e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      _submitPostViewComment();
    }
  });
}

/* ─────────────────── Gönder butonu ─────────────────── */

var _pvSendBtn = document.getElementById("postViewSendBtn");
if (_pvSendBtn) _pvSendBtn.addEventListener("click", _submitPostViewComment);

/* ─────────────────── Post View içi delegasyon ─────────────────── */

var _pvContent = document.getElementById("postViewContent");
if (_pvContent) {
  _pvContent.addEventListener("click", function (e: MouseEvent) {
    var btn = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement | null;
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === "pv-focus-composer") {
      var input = document.getElementById(
        "postViewCommentInput",
      ) as HTMLElement | null;
      if (input) input.focus();
      return;
    }

    if (action === "start-reply") {
      _setPostViewReplyTarget(btn.dataset.commentId!, btn.dataset.username!);
      return;
    }
  });
}
