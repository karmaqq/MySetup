/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            POST RENDER + FEED YÖNETİMİ                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Lazy görsel yükleyici (IntersectionObserver) ─────────────────── */

var _lazyObserver: IntersectionObserver | null = null;

function _getLazyObserver(): IntersectionObserver {
  if (!_lazyObserver) {
    _lazyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var img = e.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              delete img.dataset.src;
            }
            _lazyObserver!.unobserve(img);
          }
        });
      },
      { rootMargin: "200px" },
    );
  }
  return _lazyObserver;
}

import { User } from "firebase/auth";
import { postsFeed, currentUser } from "../core/app-state";
import {
  formatTimeAgo,
  formatDateTime,
  escHtml,
  escAttr,
  escUrl,
  _onlyFieldChanged,
} from "../core/global-ut";
import {
  getPostCards,
  buildAvatarHTML,
  buildPostMenuHTML,
  getTotalCommentCount,
} from "../core/global-fn";

/* ─────────────────── Feed Durum Değişkenleri ─────────────────── */

export let allPosts: Record<string, any> = {};
(window as any).allPosts = allPosts;

var _MAX_POSTS_IN_MEMORY = 200;
var _EVICT_COUNT = 100;
var _renderedPostIds: Set<string> = new Set();

export function _evictOldPostsIfNeeded(): void {
  var keys = Object.keys(allPosts);
  if (keys.length <= _MAX_POSTS_IN_MEMORY) return;
  var sorted = keys.slice().sort(function (a, b) {
    return (allPosts[a].createdAt || 0) - (allPosts[b].createdAt || 0);
  });
  var evicted = 0;
  for (var ei = 0; ei < sorted.length && evicted < _EVICT_COUNT; ei++) {
    var id = sorted[ei];
    if (!_renderedPostIds.has(id)) {
      delete allPosts[id];
      evicted++;
    }
  }
}

/* ─────────────────── Post Kartı HTML Döndürür ─────────────────── */

export function _renderPostHTML(
  postId: string,
  postData: any,
  opts?: { inPostView?: boolean },
): string {
  const user = currentUser;
  const isOwn = !!(user && user.uid === postData.uid);
  const liked = postData.likes && user && postData.likes[user.uid];
  const likeCount = postData.likes ? Object.keys(postData.likes).length : 0;
  const commentCount = getTotalCommentCount(postData);
  const timeText = formatTimeAgo(postData.createdAt, postData.phraseIndex);
  const pid = escAttr(postId);
  const inPostView = opts && opts.inPostView;

  let html = `<div class="post-card" data-post-id="${pid}">`;

  html += `<div class="post-header${inPostView ? "" : " post-header-link"}"${inPostView ? "" : ` data-action="open-post-view" data-id="${pid}"`}>`;
  html += buildAvatarHTML(postData.username, "post-avatar", postData.uid, postData.avatarUrl);
  html += '<div class="post-user-info">';
  html += `<span class="post-username" data-action="view-profile" data-uid="${escAttr(postData.uid)}">${escHtml(postData.username || "Kullanici")}</span>`;
  html += `<span class="post-time">${escHtml(timeText)}</span>`;
  html += "</div>";
  html += buildPostMenuHTML(pid, isOwn);
  html += "</div>";

  html += `<div class="post-body${inPostView ? "" : " post-body-link"}"${inPostView ? "" : ` data-action="open-post-view" data-id="${pid}"`}>`;
  if (postData.content)
    html += `<div class="post-text">${escHtml(postData.content)}</div>`;
  if (postData.imageUrl) {
    var imgAttr = inPostView ? "src" : "data-src";
    html += `<div class="post-image"><img ${imgAttr}="${escUrl(String(postData.imageUrl))}" alt="" class="post-img-lazy"></div>`;
  }
  html += "</div>";

  html += '<div class="post-actions">';
  html += `<button class="post-action-btn like-btn${liked ? " liked" : ""}" data-action="like-post" data-id="${pid}">`;
  html += `<svg viewBox="0 0 24 24" width="15" height="15" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5 0 0 0 0-7.78z"/></svg>`;
  html += ` <span class="post-like-count-${pid}">${likeCount}</span></button>`;
  if (inPostView) {
    html += `<button class="post-action-btn comment-btn" data-action="pv-focus-composer">`;
  } else {
    html += `<button class="post-action-btn comment-btn" data-action="open-post-view" data-id="${pid}">`;
  }
  html += `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  html += ` <span data-comment-count="${pid}">${commentCount}</span></button>`;
  html += `<span class="post-date">${escHtml(formatDateTime(postData.createdAt))}</span>`;
  html += "</div>";

  html += "</div>";
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        FEED DOM İŞLEMLERİ                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Görsel yüklendiğinde aspect ratio ayarla ─────────────────── */

export function _initPostImage(img: HTMLImageElement | null): void {
  if (!img) return;
  if (img.dataset.src) {
    _getLazyObserver().observe(img);
    img.addEventListener(
      "load",
      function () {
        _handlePostImageLoad(img);
      },
      { once: true },
    );
  } else if (img.src) {
    if (img.complete) {
      _handlePostImageLoad(img);
    } else {
      img.addEventListener(
        "load",
        function () {
          _handlePostImageLoad(img);
        },
        { once: true },
      );
    }
  }
}

function _handlePostImageLoad(img: HTMLImageElement): void {
  var r = img.naturalWidth / img.naturalHeight;
  var p = img.parentElement;
  if (!p) return;
  p.classList.toggle("landscape", r > 1.2);
  p.classList.toggle("portrait", r < 0.8);
  p.classList.toggle("square", r >= 0.8 && r <= 1.2);
}

/* ─────────────────── Post ekle (prepend/append, animasyonlu) ─────────────────── */

export function _insertPostToFeed(
  postId: string,
  postData: any,
  prepend: boolean,
): void {
  if (!postsFeed) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderPostHTML(postId, postData);
  const el = wrapper.firstElementChild as HTMLElement;
  if (!el) return;
  el.style.cssText =
    "opacity:0;transform:translateY(" +
    (prepend ? "-" : "") +
    "8px);transition:opacity 0.25s ease,transform 0.25s ease";
  if (prepend) {
    postsFeed.insertBefore(el, postsFeed.firstChild);
  } else {
    postsFeed.appendChild(el);
  }
  _renderedPostIds.add(postId);
  _initPostImage(el.querySelector(".post-img-lazy") as HTMLImageElement | null);
  if (typeof (window as any)._registerTimeCard === "function") {
    (window as any)._registerTimeCard(el);
  }
  requestAnimationFrame(function () {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

/* ─────────────────── Mevcut kart varsa yerinde günceller ─────────────────── */

export function _patchPostCard(postId: string, postData: any): void {
  const el =
    postsFeed && postsFeed.querySelector('[data-post-id="' + postId + '"]');
  if (!el) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = _renderPostHTML(postId, postData);
  const newEl = wrapper.firstElementChild;
  if (!newEl) return;
  const oldSection = el.querySelector(".comment-section");
  const wasOpen = oldSection && oldSection.classList.contains("visible");
  if (typeof (window as any)._unregisterTimeCard === "function") {
    (window as any)._unregisterTimeCard(el);
  }
  el.replaceWith(newEl);
  if (typeof (window as any)._registerTimeCard === "function") {
    (window as any)._registerTimeCard(newEl);
  }
  _initPostImage(
    newEl.querySelector(".post-img-lazy") as HTMLImageElement | null,
  );
  if (wasOpen) {
    const newSection = newEl.querySelector(".comment-section");
    if (newSection) newSection.classList.add("visible");
    const btn = newEl.querySelector(".comment-btn") as HTMLElement | null;
    if (btn) btn.classList.add("active");
  }
}

/* ─────────────────── Sadece beğeni sayacını günceller ─────────────────── */

export function _patchPostLikes(
  postId: string,
  likes: Record<string, any> | null,
  user: User | null,
): void {
  const likeCount = likes ? Object.keys(likes).length : 0;
  const liked = user && likes && likes[user.uid];
  const cards = getPostCards(postId);
  cards.forEach(function (card) {
    const btn = card.querySelector(
      '[data-action="like-post"]',
    ) as HTMLElement | null;
    if (!btn) return;
    btn.classList.toggle("liked", !!liked);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
    const span = btn.querySelector(".post-like-count-" + postId);
    if (span) span.textContent = String(likeCount);
  });
}

/* ─────────────────── Postu animasyonla kaldırır ─────────────────── */

export function _softRemovePost(postId: string): void {
  _renderedPostIds.delete(postId);
  getPostCards(postId).forEach(function (el) {
    if (typeof (window as any)._unregisterTimeCard === "function") {
      (window as any)._unregisterTimeCard(el);
    }
    (el as HTMLElement).style.transition = "opacity 0.3s, transform 0.3s";
    (el as HTMLElement).style.opacity = "0";
    (el as HTMLElement).style.transform = "translateY(4px)";
    setTimeout(function () {
      el.remove();
    }, 320);
  });
  if (postsFeed && postsFeed.children.length === 0) _renderEmptyFeed();
}

/* ─────────────────── Boş feed mesajı ─────────────────── */

export function _renderEmptyFeed(): void {
  if (!postsFeed) return;
  postsFeed.innerHTML =
    '<div class="posts-empty">Henüz gönderi yok. İlk gönderiyi sen yap!</div>';
}

/* ─────────────────── Sadece beğeni değişimi mi kontrol et ─────────────────── */

export function _onlyLikesChanged(oldPost: any, newPost: any): boolean {
  if (
    !_onlyFieldChanged(oldPost, newPost, [
      "content",
      "imageUrl",
      "username",
      "uid",
      "createdAt",
    ])
  )
    return false;
  if (getTotalCommentCount(oldPost) !== getTotalCommentCount(newPost))
    return false;
  var oldComments = oldPost.comments || {};
  var newComments = newPost.comments || {};
  for (var cid of Object.keys(newComments)) {
    if (!oldComments[cid]) return false;
    if (oldComments[cid].text !== newComments[cid].text) return false;
  }
  return true;
}
