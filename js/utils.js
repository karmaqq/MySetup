/*--- zorunlu - agents.md yorum kurallarina uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GENEL YARDIMCI ARAÇLAR                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SPA SAYFA YÖNETİMİ                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sayfa Geçişi (Animasyonlu) ─────────────────── */

let _currentPage = sessionStorage.getItem("_lastPage") || "home";
let _isAnimating = false;
let _pendingPageQueue = [];
let _commentListenerRefs = {};
var _viewingPostIdVal = null;
Object.defineProperty(window, "_viewingPostId", {
  get() { return _viewingPostIdVal; },
  set(v) {
    _viewingPostIdVal = v;
    if (v) sessionStorage.setItem("_viewingPostId", v);
    else sessionStorage.removeItem("_viewingPostId");
  },
  configurable: true,
});
const mainScroll = document.getElementById("mainScroll");

const PAGE_SIZE = 20;

function showPage(pageName) {
  if (_isAnimating) {
    _pendingPageQueue = [pageName];
    return;
  }
  _isAnimating = true;

  const pages = document.querySelectorAll(".page-content");
  const navBtns = document.querySelectorAll(".sidebar-nav-btn");
  const mainScroll = document.getElementById("mainScroll");

  const oldPage = document.querySelector(".page-content.active");
  const newPage = document.getElementById(pageName + "Page");

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
  );
  if (activeNavBtn) activeNavBtn.classList.add("active");

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
    _currentPage = pageName;
    sessionStorage.setItem("_lastPage", pageName);
    if (pageName === "profile" && typeof updateProfilePosts === "function") {
      updateProfilePosts();
    }
    if (pageName !== "home" && typeof clearPostDraft === "function") {
      clearPostDraft();
    }
    if (typeof _onPageChange === "function") {
      _onPageChange(pageName);
    }
    if (_pendingPageQueue.length) {
      const next = _pendingPageQueue.pop();
      _pendingPageQueue = [];
      showPage(next);
    }
  }, 320);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SABİTLER VE FORMATLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Para Birimi Formatlayıcı ─────────────────── */

const CURRENCY_FORMAT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ─────────────────── Tarih Formatlayıcı ─────────────────── */

const _dateCache = new Map();
const _DATECACHE_MAX = 1000;

const DATE_FORMAT = (dateString) => {
  if (!dateString) return "-";
  if (_dateCache.has(dateString)) {
    // LRU: hit olanı sona taşı
    const val = _dateCache.get(dateString);
    _dateCache.delete(dateString);
    _dateCache.set(dateString, val);
    return val;
  }
  const date = new Date(dateString);
  const result = isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("tr-TR");
  if (_dateCache.size >= _DATECACHE_MAX) {
    // En eski kaydı sil (Map sırası insertion order)
    const firstKey = _dateCache.keys().next().value;
    _dateCache.delete(firstKey);
  }
  _dateCache.set(dateString, result);
  return result;
};

/* ─────────────────── Durum Sınıfı Haritası ─────────────────── */

const STATUS_MAP = {
  bozuk: "status-broken",
  yedek: "status-reserve",
  atildi: "status-discarded",
  saglikli: "status-healthy",
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GLOBAL DURUM DEĞİŞKENLERİ                       */
/* ═════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Uygulama Durumu ─────────────────── */

let allData = {};
let currentSearch = "";
let currentStatusFilter = "all";
let currentSort = { col: "date", dir: "asc" };
let editingId = null;



/* ─────────────────── Render Yönetimi ─────────────────── */

function isAnyModalOpen() {
  return !!document.querySelector(".modal-overlay.active");
}

var _renderRafId = null;
var _pendingRender = false;

function scheduleRender() {
  if (isAnyModalOpen()) {
    _pendingRender = true;
    return;
  }
  if (_renderRafId) cancelAnimationFrame(_renderRafId);
  _renderRafId = requestAnimationFrame(function () {
    _renderRafId = null;
    if (typeof renderAll === "function") renderAll();
  });
}

/* ─────────────────── İstatistik Önbelleği ─────────────────── */

let _statsCache = {
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

const toastContainer = document.getElementById("toastContainer");

/* ─────────────────── Sürüm ve Güncelleme ─────────────────── */

const versionDisplay = document.getElementById("versionDisplay");

/* ─────────────────── Arama ─────────────────── */

const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");

/* ─────────────────── Tablo ve İstatistikler ─────────────────── */

const tableBody = document.getElementById("tableBody");
const addItemBtn = document.getElementById("addItemBtn");
const resultCount = document.getElementById("resultCount");
const statTotal = document.getElementById("statTotal");
const statCount = document.getElementById("statCount");
const statHealthy = document.getElementById("statHealthy");
const statExpensive = document.getElementById("statExpensive");
const totalCostDisplay = document.getElementById("totalCostDisplay");

/* ─────────────────── Düzenleme Modali ─────────────────── */

const editModal = document.getElementById("editModal");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");
const editDate = document.getElementById("editDate");
const editDatePicker = document.getElementById("editDatePicker");
const editCalIcon = document.getElementById("editCalIcon");
const editComponent = document.getElementById("editComponent");
const editBrand = document.getElementById("editBrand");
const editUrl = document.getElementById("editUrl");
const editSpecs = document.getElementById("editSpecs");
const editPrice = document.getElementById("editPrice");
const editVendor = document.getElementById("editVendor");
const editStatus = document.getElementById("editStatus");

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YARDIMCI FONKSİYONLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Türkçe Karakter Normalizasyonu ─────────────────── */

function normalizeTr(s) {
  return (s || "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/* ─────────────────── HTML Karakter Kaçışı ─────────────────── */

function escHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

/* ─────────────────── Attribute Karakter Kaçışı ─────────────────── */

function escAttr(str) {
  try {
    const s = str == null ? "" : String(str);
    return s
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  } catch (e) {
    return "";
  }
}

/* ─────────────────── Güvenli Harici URL Doğrulama ─────────────────── */

function escUrl(url) {
  if (!url) return "";
  try {
    var p = new URL(url);
    if (p.protocol !== "http:" && p.protocol !== "https:") return "";
    return escAttr(p.toString());
  } catch (_) {
    return "";
  }
}

function safeExternalUrl(value) {
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

function applyPriceFormat(inputEl) {
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

function parseDateInput(raw) {
  const parts = (raw || "").trim().split(/[./-]/);
  let result;
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

function parsePriceInput(value) {
  return parseFloat((value || "").replace(/\./g, "").replace(",", ".")) || 0;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          POST SİSTEMİ YARDIMCILARI                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

const POST_PHRASES = [
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

function formatTimeAgo(timestamp, phraseIndex, skipPhrase) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let timeText = "az önce";
  if (minutes < 60) timeText = minutes + " dakika önce";
  else if (hours < 24) timeText = hours + " saat önce";
  else if (days < 7) timeText = days + " gün önce";
  else if (days < 365) timeText = Math.floor(days / 7) + " hafta önce";
  else timeText = Math.floor(days / 365) + " yıl önce";

  if (skipPhrase) return timeText;
  var idx =
    phraseIndex !== undefined && phraseIndex !== null
      ? phraseIndex
      : Math.floor(Math.random() * POST_PHRASES.length);
  return timeText + " " + POST_PHRASES[idx];
}

function formatDateTime(timestamp) {
  if (!timestamp) return "";
  var date = new Date(timestamp);
  var day = String(date.getDate()).padStart(2, "0");
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var year = date.getFullYear();
  var hours = String(date.getHours()).padStart(2, "0");
  var minutes = String(date.getMinutes()).padStart(2, "0");
  return day + "." + month + "." + year + " " + hours + ":" + minutes;
}

/* ─────────────────── Avatar Harfini Güncelle (Yardımcı) ─────────────────── */

function updateAvatarLetter(elementId, name) {
  var el = document.getElementById(elementId);
  if (el) el.textContent = (name || "?").charAt(0).toUpperCase();
}

function getAvatarLetter(name) {
  return (name || "?").charAt(0).toUpperCase();
}

function refreshAllAvatars(name) {
  updateAvatarLetter("profileAvatarLetter", name);
  updateAvatarLetter("sidebarAvatar", name);
}

function getPostCards(postId) {
  return document.querySelectorAll('[data-post-id="' + postId + '"]');
}

function buildAvatarHTML(name, cssClass) {
  return '<div class="' + cssClass + '">' + getAvatarLetter(name) + '</div>';
}

function buildPostMenuHTML(pid, isOwn) {
  if (!isOwn) return "";
  return '<button class="post-menu-btn" data-action="post-menu" data-id="' + pid + '">⋮</button>'
    + '<div class="post-dropdown" id="postDropdown-' + pid + '">'
    + '<button class="post-dropdown-item delete" data-action="delete-post" data-id="' + pid + '">'
    + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">'
    + '<polyline points="3 6 5 6 21 6"/>'
    + '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
    + '</svg> Sil</button></div>';
}

function renderLoadMoreBtn(afterEl, btnId, onClick) {
  if (document.getElementById(btnId)) return;
  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "load-more-btn";
  btn.textContent = "Daha Fazla Göster";
  btn.onclick = onClick;
  afterEl.parentNode.insertBefore(btn, afterEl.nextSibling);
}

function removeLoadMoreBtn(btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.remove();
}
