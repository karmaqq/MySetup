/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ZAMAN GÜNCELLEMESİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { _currentPage } from "../core/app-state";
import { formatTimeAgo } from "../core/global-ut";
import { allPosts } from "./post-render";

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

/* ─────────────────── Kayıtlı Kart Seti ─────────────────── */

var _observedCards: Set<Element> = new Set();

export function _registerTimeCard(el: Element): void {
  _observedCards.add(el);
}

export function _unregisterTimeCard(el: Element): void {
  _observedCards.delete(el);
}

function _updateCardTimes(card: Element): void {
  var post = allPosts[(card as HTMLElement).dataset.postId!];
  if (!post) return;
  var postTimeEl = card.querySelector(":scope > .post-header .post-time");
  if (postTimeEl) {
    postTimeEl.textContent = formatTimeAgo(post.createdAt, post.phraseIndex);
  }
  var comments = post.comments || {};
  Object.keys(comments).forEach(function (cid) {
    var commentEl = card.querySelector('[data-comment-id="' + cid + '"]');
    if (!commentEl) return;
    var _ce = commentEl as HTMLElement;
    var commentTimeEl = _ce.querySelector(".comment-time");
    if (commentTimeEl) {
      commentTimeEl.textContent = formatTimeAgo(
        comments[cid].createdAt,
        undefined,
        true,
      );
    }
    var replies = comments[cid].replies || {};
    Object.keys(replies).forEach(function (rid) {
      var replyTimeEl = _ce.querySelector(
        '[data-reply-id="' + rid + '"] .reply-time',
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
}

function _runTimeUpdateBatch(): void {
  if (
    _currentPage !== "home" &&
    _currentPage !== "profile" &&
    _currentPage !== "postView"
  )
    return;
  if (document.hidden) return;
  if (!_observedCards.size) return;
  _observedCards.forEach(function (card) {
    if (!(card as HTMLElement).isConnected) {
      _observedCards.delete(card);
      return;
    }
    _updateCardTimes(card);
  });
}

function _scheduleTimeUpdateIdle(): void {
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
  var scheduleNext = function (): void {
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
