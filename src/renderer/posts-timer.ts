/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ZAMAN GÜNCELLEMESİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { _currentPage } from "./app-state";
import { formatTimeAgo } from "./global-ut";
import { allPosts } from "./posts-render";

// F-15: requestIdleCallback polyfill (Safari web build uyumluluğu)
var _requestIdle: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number =
  typeof requestIdleCallback !== "undefined"
    ? requestIdleCallback
    : function (cb) {
        return window.setTimeout(function () {
          cb({ didTimeout: false, timeRemaining: function () { return 50; } } as IdleDeadline);
        }, 200);
      };
var _cancelIdle: (id: number) => void =
  typeof cancelIdleCallback !== "undefined"
    ? cancelIdleCallback
    : window.clearTimeout.bind(window);

let _timeUpdateIdleHandle: number | null = null;
let _timeUpdateTimeout: number | null = null;
let _visibilityListenerRegistered = false;

function _runTimeUpdateBatch() {
  if (
    _currentPage !== "home" &&
    _currentPage !== "profile" &&
    _currentPage !== "postView"
  )
    return;
  if (document.hidden) return;
  const activePage = document.querySelector(
    ".page-content.active",
  ) as HTMLElement | null;
  const postCards = (activePage || document).querySelectorAll(
    "[data-post-id]",
  );
  if (!postCards.length) return;
  postCards.forEach(function (card) {
    const post = allPosts[(card as HTMLElement).dataset.postId!];
    if (!post) return;
    const postTimeEl = card.querySelector(":scope > .post-header .post-time");
    if (postTimeEl) {
      postTimeEl.textContent = formatTimeAgo(post.createdAt, post.phraseIndex);
    }
    const comments = post.comments || {};
    Object.keys(comments).forEach(function (cid) {
      const commentEl = card.querySelector(`[data-comment-id="${cid}"]`);
      if (!commentEl) return;
      const commentTimeEl = commentEl.querySelector(".comment-time");
      if (commentTimeEl) {
        commentTimeEl.textContent = formatTimeAgo(
          comments[cid].createdAt,
          undefined,
          true,
        );
      }
      const replies = comments[cid].replies || {};
      Object.keys(replies).forEach(function (rid) {
        const replyTimeEl = commentEl.querySelector(
          `[data-reply-id="${rid}"] .reply-time`,
        );
        if (replyTimeEl) {
          replyTimeEl.textContent = formatTimeAgo(
            replies[rid].createdAt,
            undefined,
            true,
          );
        }
      });
    });
  });
}

function _scheduleTimeUpdateIdle() {
  if (_timeUpdateIdleHandle) {
    _cancelIdle(_timeUpdateIdleHandle);
    _timeUpdateIdleHandle = null;
  }
  _timeUpdateIdleHandle = _requestIdle(_runTimeUpdateBatch, {
    timeout: 2000,
  });
}

function _startTimeUpdateInterval(): void {
  if (_timeUpdateTimeout) {
    clearTimeout(_timeUpdateTimeout);
    _timeUpdateTimeout = null;
  }

  const scheduleNext = () => {
    _scheduleTimeUpdateIdle();
    _timeUpdateTimeout = window.setTimeout(scheduleNext, 2 * 60 * 1000);
  };
  scheduleNext();
}

function _stopTimeUpdateInterval(): void {
  if (_timeUpdateTimeout) {
    clearTimeout(_timeUpdateTimeout);
    _timeUpdateTimeout = null;
  }
  if (_timeUpdateIdleHandle) {
    _cancelIdle(_timeUpdateIdleHandle);
    _timeUpdateIdleHandle = null;
  }
}

(window as any)._startTimeUpdateInterval = _startTimeUpdateInterval;
(window as any)._stopTimeUpdateInterval = _stopTimeUpdateInterval;

if (!_visibilityListenerRegistered) {
  _visibilityListenerRegistered = true;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      _stopTimeUpdateInterval();
    } else if ((window as any)._postsListenerActive) {
      _startTimeUpdateInterval();
    }
  });
}
