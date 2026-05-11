/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          UYGULAMA DURUMU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa Geçişi ─────────────────── */

export let _currentPage: string = sessionStorage.getItem("_lastPage") || "home";
export let _isAnimating = false;
export let _pendingPage: string | null = null;
export let _commentListenerRefs: Record<string, any> = {};
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

/* ─────────────────── Oturum Durumu ─────────────────── */

export let currentUser: firebase.auth.User | null = null;
export function setCurrentUser(u: firebase.auth.User | null): void {
  currentUser = u;
}

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

  var fallbackId = setTimeout(function () {
    _isAnimating = false;
    _runPageCallbacks(pageName);
  }, 400);

  newPage.addEventListener(
    "transitionend",
    function handler() {
      clearTimeout(fallbackId);
      newPage.removeEventListener("transitionend", handler);
      _isAnimating = false;
      _runPageCallbacks(pageName);
    },
    { once: true },
  );
}

function _runPageCallbacks(pageName: string): void {
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
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GLOBAL VERİ YAPILARI                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Envanter Verisi ─────────────────── */

export let allData: Record<string, any> = {};

/* ─────────────────── Durum Sınıfı Haritası ─────────────────── */

export const STATUS_MAP: Record<string, string> = {
  bozuk: "status-broken",
  yedek: "status-reserve",
  atildi: "status-discarded",
  saglikli: "status-healthy",
};

/* ─────────────────── Arama ve Filtre ─────────────────── */

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

/* ─────────────────── Sıralama ─────────────────── */

export let currentSort: { col: string; dir: string } = {
  col: "date",
  dir: "asc",
};

/* ─────────────────── Düzenleme ID ─────────────────── */

let _editingIdVal: string | null = null;
export let editingId: string | null = _editingIdVal;
export function setEditingId(v: string | null): void {
  _editingIdVal = v;
  editingId = v;
}

/* ─────────────────── İstatistik Önbelleği ─────────────────── */

export interface StatsCache {
  total: number;
  count: number;
  healthy: number;
  mostExpId: string | null;
  mostExpPrice: number;
}

let _statsCacheVal: StatsCache = {
  total: 0,
  count: 0,
  healthy: 0,
  mostExpId: null,
  mostExpPrice: 0,
};

export function getStatsCache(): StatsCache {
  return _statsCacheVal;
}

export function setStatsCache(val: Partial<StatsCache>): void {
  Object.assign(_statsCacheVal, val);
}

export function resetStatsCache(): void {
  _statsCacheVal = {
    total: 0,
    count: 0,
    healthy: 0,
    mostExpId: null,
    mostExpPrice: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          DOM REFERANSLARI                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

export const toastContainer = document.getElementById("toastContainer");

export const postsFeed = document.getElementById(
  "postsFeed",
) as HTMLElement | null;

export const searchInput = document.getElementById(
  "searchInput",
) as HTMLInputElement | null;
export const clearSearch = document.getElementById(
  "clearSearch",
) as HTMLElement | null;

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
