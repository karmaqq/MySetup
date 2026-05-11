/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       YORUM VE YANIT RENDER                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { escHtml, escAttr, formatTimeAgo } from "./global-ut";
import { buildAvatarHTML } from "./global-fn";

/* ─────────────────── Ortak silme dropdown HTML ─────────────────── */

function _buildDeleteDropdownHTML(
  action: string,
  attrs: Record<string, string>,
): string {
  const attrStr = Object.keys(attrs)
    .map(function (k) {
      return `data-${k}="${attrs[k]}"`;
    })
    .join(" ");
  return (
    `<div class="comment-dropdown">` +
    `<button class="comment-dropdown-item delete" data-action="${action}" ${attrStr}>` +
    `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Sil</button></div>`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       YORUM HTML                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function _renderCommentThreadHTML(
  postId: string,
  commentId: string,
  commentData: any,
  user: firebase.auth.User | null,
  isPostOwner?: boolean,
): string {
  const pid = escAttr(postId);
  const cid = escAttr(commentId);
  const isOwn = user && user.uid === commentData.uid;
  const liked = user && commentData.likes && commentData.likes[user.uid];
  const likeCount = commentData.likes
    ? Object.keys(commentData.likes).length
    : 0;
  const replyCount = commentData.replies
    ? Object.keys(commentData.replies).length
    : 0;
  const timeAgo = commentData.createdAt
    ? formatTimeAgo(commentData.createdAt, undefined, true)
    : "";

  let html = `<div class="comment-thread" id="commentThread-${pid}-${cid}">`;

  html += `<div class="comment-item" data-comment-id="${cid}">`;
  html += '<div class="comment-avatar-col">';
  html += buildAvatarHTML(commentData.username, "comment-avatar");
  html += "</div>";
  html += '<div class="comment-body">';
  html += '<div class="comment-meta">';
  html += `<span class="comment-username">${escHtml(commentData.username || "Kullanici")}</span>`;
  html += `<span class="comment-time">${escHtml(timeAgo)}</span>`;
  if (isOwn || isPostOwner) {
    html += `<button class="comment-menu-btn" data-action="comment-menu" data-post-id="${pid}" data-comment-id="${cid}">⋮</button>`;
    html += _buildDeleteDropdownHTML("delete-comment", {
      "post-id": pid,
      "comment-id": cid,
    });
  }
  html += "</div>";
  html += `<div class="comment-text">${escHtml(commentData.text || "")}</div>`;
  html += '<div class="comment-actions">';
  html += `<button class="comment-action-btn${liked ? " liked" : ""}" data-action="like-comment" data-post-id="${pid}" data-comment-id="${cid}">`;
  html += `<svg viewBox="0 0 24 24" width="12" height="12" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>`;
  html += ` <span class="like-count-c-${cid}">${likeCount}</span></button>`;
  html += `<button class="comment-action-btn reply-btn" data-action="start-reply" data-post-id="${pid}" data-comment-id="${cid}" data-username="${escAttr(commentData.username || "Kullanici")}">`;
  html += `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`;
  html += `<span class="reply-count-${cid}">${replyCount}</span></button>`;
  if (replyCount > 0) {
    html += `<button class="toggle-replies-btn" id="toggleReplies-${pid}-${cid}" data-action="toggle-replies" data-post-id="${pid}" data-comment-id="${cid}">`;
    html += "yanıtları gör</button>";
  }
  html += "</div>";
  html += "</div></div>";

  html += `<div class="replies-section hidden" id="replies-${pid}-${cid}">`;
  if (commentData.replies) {
    const sortedReplies = Object.keys(commentData.replies).sort(
      function (a, b) {
        return (
          (commentData.replies[a].createdAt || 0) -
          (commentData.replies[b].createdAt || 0)
        );
      },
    );
    sortedReplies.forEach(function (rid) {
      html += _renderReplyHTML(
        postId,
        commentId,
        rid,
        commentData.replies[rid],
        user,
      );
    });
  }
  html += "</div>";

  html += "</div>";
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YANIT HTML                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function _renderReplyHTML(
  postId: string,
  commentId: string,
  replyId: string,
  replyData: any,
  user: firebase.auth.User | null,
  isPostOwner?: boolean,
): string {
  const pid = escAttr(postId);
  const cid = escAttr(commentId);
  const rid = escAttr(replyId);
  const isOwn = user && user.uid === replyData.uid;
  const liked = user && replyData.likes && replyData.likes[user.uid];
  const likeCount = replyData.likes ? Object.keys(replyData.likes).length : 0;
  const timeAgo = replyData.createdAt
    ? formatTimeAgo(replyData.createdAt, undefined, true)
    : "";

  let html = `<div class="reply-item" data-reply-id="${rid}">`;
  html += buildAvatarHTML(replyData.username, "reply-avatar");
  html += '<div class="reply-body">';
  html += '<div class="reply-meta">';
  html += `<span class="reply-username">${escHtml(replyData.username || "Kullanici")}</span>`;
  html += `<span class="reply-time">${escHtml(timeAgo)}</span>`;
  if (isOwn || isPostOwner) {
    html += `<button class="comment-menu-btn" data-action="reply-menu" data-post-id="${pid}" data-comment-id="${cid}" data-reply-id="${rid}">⋮</button>`;
    html += _buildDeleteDropdownHTML("delete-reply", {
      "post-id": pid,
      "comment-id": cid,
      "reply-id": rid,
    });
  }
  html += "</div>";
  html += `<div class="reply-text">${escHtml(replyData.text || "")}</div>`;
  html += '<div class="reply-actions">';
  html += `<button class="comment-action-btn${liked ? " liked" : ""}" data-action="like-reply" data-post-id="${pid}" data-comment-id="${cid}" data-reply-id="${rid}">`;
  html += `<svg viewBox="0 0 24 24" width="11" height="11" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>`;
  html += ` <span>${likeCount}</span></button>`;
  html += "</div>";
  html += "</div></div>";
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      YORUM/YANIT BEĞENİ DOM GÜNCELLEME                */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function _patchCommentLikeBtn(
  postId: string,
  commentId: string,
  likes: Record<string, any> | null,
  user: firebase.auth.User | null,
): void {
  const count = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const btn = document.querySelector(
    `[data-action="like-comment"][data-post-id="${postId}"][data-comment-id="${commentId}"]`,
  ) as HTMLElement | null;
  if (!btn) return;
  btn.classList.toggle("liked", !!liked);
  const svg = btn.querySelector("svg");
  if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
  const span = document.querySelector(`.like-count-c-${commentId}`);
  if (span) span.textContent = String(count);
}

export function _patchReplyLikeBtn(
  postId: string,
  commentId: string,
  replyId: string,
  likes: Record<string, any> | null,
  user: firebase.auth.User | null,
): void {
  const count = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const btn = document.querySelector(
    `[data-action="like-reply"][data-post-id="${postId}"][data-comment-id="${commentId}"][data-reply-id="${replyId}"]`,
  ) as HTMLElement | null;
  if (!btn) return;
  btn.classList.toggle("liked", !!liked);
  const svg = btn.querySelector("svg");
  if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
  const span = btn.querySelector("span");
  if (span) span.textContent = String(count);
}
