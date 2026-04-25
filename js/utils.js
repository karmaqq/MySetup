/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GENEL YARDIMCI ARAÇLAR                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

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
const _DATECACHE_MAX = 300;
const DATE_FORMAT = (dateString) => {
  if (!dateString) return "-";
  if (_dateCache.has(dateString)) return _dateCache.get(dateString);
  const date = new Date(dateString);
  const result = isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("tr-TR");
  if (_dateCache.size >= _DATECACHE_MAX) _dateCache.clear();
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
/*                          GLOBAL DEĞİŞKENLER                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

let allData = {};
let currentSearch = "";
let currentStatusFilter = "all";
let currentSort = { col: "date", dir: "asc" };
let editingId = null;

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

/* ─────────────────── Sürüm ve Güncelleme ─────────────────── */

const versionDisplay = document.getElementById("versionDisplay");

/* ─────────────────── Bildirim ─────────────────── */

const toastContainer = document.getElementById("toastContainer");

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
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ─────────────────── Güvenli Harici URL Doğrulama ─────────────────── */

function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch (_error) {
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
