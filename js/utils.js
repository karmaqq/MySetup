/* ─── ELECTRON IPC ──────────────────────────────────────────────────────────── */
let ipcRenderer = null;

try {
  const electron = require("electron");
  ipcRenderer = electron.ipcRenderer;
} catch (e) {
  console.log("Tarayıcı modu: Electron fonksiyonları pasif.");
}

/* ─── FORMATLAMA ─────────────────────────────────────────────────────────────── */
const CURRENCY_FORMAT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMAT = (dateString) =>
  new Date(dateString).toLocaleDateString("tr-TR");

/* ─── DURUM HARİTALAMA ─────────────────────────────────────────────────────────── */
const STATUS_MAP = {
  bozuk: "status-broken",
  yedek: "status-reserve",
  atildi: "status-discarded",
  saglikli: "status-healthy",
};

/* ─── STATE ───────────────────────────────────────────────────────────────────── */
let allData = {};
let currentSearch = "";
let currentStatusFilter = "all";
let currentSort = { col: "date", dir: "asc" };
let editingId = null;

/* ─── DOM REFERANSLARI ─────────────────────────────────────────────────────────── */
const versionDisplay = document.getElementById("versionDisplay");
const updateBtn = document.getElementById("updateBtn");
const statusPanel = document.getElementById("statusPanel");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const tableBody = document.getElementById("tableBody");
const addItemBtn = document.getElementById("addItemBtn");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const exportBtn = document.getElementById("exportBtn");
const resultCount = document.getElementById("resultCount");
const toastContainer = document.getElementById("toastContainer");

// Modal DOM referansları
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

/* ─── YARDIMCI FONKSİYONLAR ─────────────────────────────────────────────────── */
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

function escHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Fiyat input'unu Türk formatına (1.234,56) çevirir
function applyPriceFormat(inputEl) {
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

/* ─── EDIT FİYAT KUTUSUNU AYARLA ────────────────────────────────────────────── */
editPrice.type = "text";
editPrice.inputMode = "decimal";
editPrice.addEventListener("input", function () {
  applyPriceFormat(this);
});
