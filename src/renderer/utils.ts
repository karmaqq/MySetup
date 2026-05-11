/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GENEL YARDIMCI ARAÇLAR                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa Geçişi (Animasyonlu) ─────────────────── */

export let _currentPage: string = sessionStorage.getItem("_lastPage") || "home";
export let _isAnimating = false;
export let _pendingPage: string | null = null;
export let _commentListenerRefs: Record<string, () => void> = {};
export const _commentListenerOrder: string[] = [];
let _viewingPostIdVal: string | null = null;
Object.defineProperty(window, "_viewingPostId", {
  get() {
    return _viewingPostIdVal;
  },
  set(v: string | null) {
    _viewingPostIdVal = v;
    if (v) sessionStorage.setItem("_viewingPostId", v);
    else sessionStorage.removeItem("_viewingPostId");
  },
  configurable: true,
});
export const mainScroll = document.getElementById(
  "mainScroll",
) as HTMLElement | null;

export const PAGE_SIZE = 20;

export function showPage(pageName: string): void {
  if (_isAnimating) {
    _pendingPage = pageName;
    return;
  }
  _isAnimating = true;

  const pages = document.querySelectorAll(".page-content");
  const navBtns = document.querySelectorAll(".sidebar-nav-btn");

  const oldPage = document.querySelector(
    ".page-content.active",
  ) as HTMLElement | null;
  const newPage = document.getElementById(
    pageName + "Page",
  ) as HTMLElement | null;

  if (!newPage || oldPage === newPage) {
    _isAnimating = false;
    return;
  }

  if (oldPage && oldPage.id === "postViewPage" && mainScroll) {
    mainScroll.classList.remove("pv-active");
  }

  navBtns.forEach((b) => b.classList.remove("active"));
  const activeNavBtn = document.querySelector(
    `.sidebar-nav-btn[data-page="${pageName}"]`,
  ) as HTMLElement | null;
  if (activeNavBtn) activeNavBtn.classList.add("active");

  _currentPage = pageName;
  sessionStorage.setItem("_lastPage", pageName);

  if (oldPage) {
    oldPage.style.opacity = "0";
    oldPage.style.visibility = "hidden";
    oldPage.classList.remove("active");
  }

  newPage.style.visibility = "visible";
  newPage.style.opacity = "0";
  newPage.classList.add("active");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newPage.style.opacity = "1";
    });
  });

  if (mainScroll) mainScroll.scrollTop = 0;

  setTimeout(() => {
    _isAnimating = false;
    if (
      pageName === "profile" &&
      typeof (window as any).updateProfilePosts === "function"
    ) {
      (window as any).updateProfilePosts();
    }
    if (
      pageName !== "home" &&
      typeof (window as any).clearPostDraft === "function"
    ) {
      (window as any).clearPostDraft();
    }
    if (typeof (window as any)._onPageChange === "function") {
      (window as any)._onPageChange(pageName);
    }
    if (_pendingPage) {
      const next = _pendingPage;
      _pendingPage = null;
      showPage(next);
    }
  }, 320);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SABİTLER VE FORMATLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Para Birimi Formatlayıcı ─────────────────── */

export const CURRENCY_FORMAT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ─────────────────── Tarih Formatlayıcı ─────────────────── */

const _dateCache = new Map<string, string>();
const _DATECACHE_MAX = 200;

export const DATE_FORMAT = (dateString: string): string => {
  if (!dateString) return "-";
  if (_dateCache.has(dateString)) {
    const val = _dateCache.get(dateString)!;
    _dateCache.delete(dateString);
    _dateCache.set(dateString, val);
    return val;
  }
  const date = new Date(dateString);
  const result = isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("tr-TR");
  if (_dateCache.size >= _DATECACHE_MAX) {
    const firstKey = _dateCache.keys().next().value;
    if (firstKey !== undefined) _dateCache.delete(firstKey);
  }
  _dateCache.set(dateString, result);
  return result;
};

/* ─────────────────── Durum Sınıfı Haritası ─────────────────── */

export const STATUS_MAP: Record<string, string> = {
  bozuk: "status-broken",
  yedek: "status-reserve",
  atildi: "status-discarded",
  saglikli: "status-healthy",
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GLOBAL DURUM DEĞİŞKENLERİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Uygulama Durumu ─────────────────── */

export let allData: Record<string, any> = {};
let _currentSearchVal = "";
export let currentSearch = _currentSearchVal;
export function setCurrentSearch(v: string): void {
  _currentSearchVal = v;
  currentSearch = v;
}
export let currentStatusFilter = "all";
export function setCurrentStatusFilter(v: string): void {
  currentStatusFilter = v;
}
export let currentSort: { col: string; dir: string } = {
  col: "date",
  dir: "asc",
};
let _editingIdVal: string | null = null;
export let editingId: string | null = _editingIdVal;
export function setEditingId(v: string | null): void {
  _editingIdVal = v;
  editingId = v;
}

/* ─────────────────── Render Yönetimi ─────────────────── */

export function isAnyModalOpen(): boolean {
  return !!document.querySelector(".modal-overlay.active");
}

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

/* ─────────────────── İstatistik Önbelleği ─────────────────── */

export interface StatsCache {
  total: number;
  count: number;
  healthy: number;
  mostExpId: string | null;
  mostExpPrice: number;
}

export let _statsCache: StatsCache = {
  total: 0,
  count: 0,
  healthy: 0,
  mostExpId: null,
  mostExpPrice: 0,
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          DOM REFERANSLARI                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Bildirim ─────────────────── */

export const toastContainer = document.getElementById("toastContainer");

/* ─────────────────── Post Sistemi ─────────────────── */

export const postsFeed = document.getElementById(
  "postsFeed",
) as HTMLElement | null;

/* ─────────────────── Arama ─────────────────── */

export const searchInput = document.getElementById(
  "searchInput",
) as HTMLInputElement | null;
export const clearSearch = document.getElementById(
  "clearSearch",
) as HTMLElement | null;

/* ─────────────────── Tablo ve İstatistikler ─────────────────── */

export const tableBody = document.getElementById(
  "tableBody",
) as HTMLElement | null;
export const addItemBtn = document.getElementById(
  "addItemBtn",
) as HTMLElement | null;
export const resultCount = document.getElementById(
  "resultCount",
) as HTMLElement | null;
export const statTotal = document.getElementById(
  "statTotal",
) as HTMLElement | null;
export const statCount = document.getElementById(
  "statCount",
) as HTMLElement | null;
export const statHealthy = document.getElementById(
  "statHealthy",
) as HTMLElement | null;
export const statExpensive = document.getElementById(
  "statExpensive",
) as HTMLElement | null;
export const totalCostDisplay = document.getElementById(
  "totalCostDisplay",
) as HTMLElement | null;

/* ─────────────────── Düzenleme Modali ─────────────────── */

export const editModal = document.getElementById(
  "editModal",
) as HTMLElement | null;
export const modalClose = document.getElementById(
  "modalClose",
) as HTMLElement | null;
export const modalCancel = document.getElementById(
  "modalCancel",
) as HTMLElement | null;
export const modalSave = document.getElementById(
  "modalSave",
) as HTMLElement | null;
export const editDate = document.getElementById(
  "editDate",
) as HTMLInputElement | null;
export const editDatePicker = document.getElementById(
  "editDatePicker",
) as HTMLInputElement | null;
export const editCalIcon = document.getElementById(
  "editCalIcon",
) as HTMLElement | null;
export const editComponent = document.getElementById(
  "editComponent",
) as HTMLInputElement | null;
export const editBrand = document.getElementById(
  "editBrand",
) as HTMLInputElement | null;
export const editUrl = document.getElementById(
  "editUrl",
) as HTMLInputElement | null;
export const editSpecs = document.getElementById(
  "editSpecs",
) as HTMLInputElement | null;
export const editPrice = document.getElementById(
  "editPrice",
) as HTMLInputElement | null;
export const editVendor = document.getElementById(
  "editVendor",
) as HTMLInputElement | null;
export const editStatus = document.getElementById(
  "editStatus",
) as HTMLSelectElement | null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YARDIMCI FONKSİYONLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Türkçe Karakter Normalizasyonu ─────────────────── */

export function normalizeTr(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/* ─────────────────── Karakter Kaçış Fonksiyonu ─────────────────── */

function escapeString(str: string): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const escHtml = escapeString;
export const escAttr = escapeString;

/* ─────────────────── Güvenli Harici URL Doğrulama ─────────────────── */

export function escUrl(url: string): string {
  if (!url) return "";
  try {
    const p = new URL(url);
    if (p.protocol !== "http:" && p.protocol !== "https:") return "";
    return escAttr(p.toString());
  } catch (_) {
    return "";
  }
}

export function safeExternalUrl(value: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

/* ─────────────────── Fiyat Giriş Formatlama ─────────────────── */

export function applyPriceFormat(inputEl: HTMLInputElement): void {
  if (!inputEl) return;
  let value = inputEl.value.replace(/[^0-9,]/g, "");
  const parts = value.split(",");

  if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");

  if (value) {
    let [integerPart, decimalPart] = value.split(",");
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    inputEl.value =
      decimalPart !== undefined ? `${integerPart},${decimalPart}` : integerPart;
  } else {
    inputEl.value = "";
  }
}

/* ─────────────────── Tarih Giriş Parse ─────────────────── */

export function parseDateInput(raw: string): string {
  const parts = (raw || "").trim().split(/[./-]/);
  let result: string | undefined;
  if (parts.length === 3) {
    result =
      parts[0].length <= 2
        ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
        : raw.trim();
  }
  if (!result || isNaN(new Date(result).getTime())) {
    result = new Date().toISOString().split("T")[0];
  }
  return result;
}

/* ─────────────────── Fiyat Giriş Parse ─────────────────── */

export function parsePriceInput(value: string): number {
  return parseFloat((value || "").replace(/\./g, "").replace(",", ".")) || 0;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST SİSTEMİ YARDIMCILARI                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export const POST_PHRASES = [
  "dedi ki;",
  "şöyle düşündü;",
  "demişti ki;",
  "fikrini paylaştı.",
  "artık içinde tutamadı ve şöyle dedi;",
  "böyle düşünmekteydi;",
  "tam olarak şundan bahsetti;",
  "bir düşünce geliştirmiş;",
  "bunu sadece kendisin bildiğini sanıyordu;",
  "tuvalette aklına bu düşünce geldi;",
  "bunun sadece düşüncede kalmamasını istedi.",
  "kediler yardımı ile şu fikre ulaştı;",
  "bunu söylerken hiç utanmadı.",
  "bir an bile düşünmeden şunu dedi;",
  "şöyle buyurdu;",
  "fikrini beyan etti;",
];

export function formatTimeAgo(
  timestamp: number,
  phraseIndex?: number,
  skipPhrase?: boolean,
): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let timeText = "az önce";
  if (minutes >= 1 && minutes < 60) timeText = minutes + " dakika önce";
  else if (hours >= 1 && hours < 24) timeText = hours + " saat önce";
  else if (days >= 1 && days < 7) timeText = days + " gün önce";
  else if (days >= 7 && days < 365)
    timeText = Math.floor(days / 7) + " hafta önce";
  else if (days >= 365) timeText = Math.floor(days / 365) + " yıl önce";

  if (skipPhrase) return timeText;
  const idx =
    phraseIndex !== undefined && phraseIndex !== null
      ? phraseIndex
      : 0;
  return timeText + " " + POST_PHRASES[idx];
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return day + "." + month + "." + year + " " + hours + ":" + minutes;
}

/* ─────────────────── Avatar Yardımcıları ─────────────────── */

export function updateAvatarLetter(elementId: string, name: string): void {
  const el = document.getElementById(elementId);
  if (el) el.textContent = (name || "?").charAt(0).toUpperCase();
}

export function getAvatarLetter(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}

export function refreshAllAvatars(name: string): void {
  updateAvatarLetter("profileAvatarLetter", name);
  updateAvatarLetter("sidebarAvatar", name);
}

export function getPostCards(postId: string): NodeListOf<Element> {
  return document.querySelectorAll('[data-post-id="' + postId + '"]');
}

export function buildAvatarHTML(name: string, cssClass: string): string {
  return '<div class="' + cssClass + '">' + getAvatarLetter(name) + "</div>";
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

export function getTotalCommentCount(post: any): number {
  if (!post || !post.comments) return 0;
  let total = Object.keys(post.comments).length;
  Object.keys(post.comments).forEach(function (cid) {
    if (post.comments[cid].replies)
      total += Object.keys(post.comments[cid].replies).length;
  });
  return total;
}

export function _onlyFieldChanged<T>(
  oldObj: T,
  newObj: T,
  fields: (keyof T)[],
): boolean {
  for (const field of fields) {
    if (oldObj[field] !== newObj[field]) return false;
  }
  return true;
}

export function _onlyCommentLikesChanged(
  oldComment: any,
  newComment: any,
): boolean {
  if (!oldComment || !newComment) return false;
  if (!_onlyFieldChanged(oldComment, newComment, ["text", "uid"])) return false;
  const oldRC = oldComment.replies ? Object.keys(oldComment.replies).length : 0;
  const newRC = newComment.replies ? Object.keys(newComment.replies).length : 0;
  if (oldRC !== newRC) return false;
  return true;
}
