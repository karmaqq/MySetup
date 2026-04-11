// app.js dosyasının en başı
let ipcRenderer = null;

try {
  const electron = require("electron");
  ipcRenderer = electron.ipcRenderer;
} catch (e) {
  console.log("Tarayıcı modu: Electron fonksiyonları pasif.");
}

// Postayı yakalayacak olan alan (HTML'deki ID)
const versionDisplay = document.getElementById("versionDisplay");

const updateBtn = document.getElementById("updateBtn");

// Eğer Electron içindeysek dinlemeye başla
if (ipcRenderer) {
  // 'app_version' postası geldiğinde içindeki rakamı ekrana yaz
  ipcRenderer.on("app_version", (event, version) => {
    if (versionDisplay) {
      versionDisplay.innerText = `v${version}`;
    }
  });
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

/* ─── FIREBASE AYARLARI ───────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyDINeXkzy4JCwt9cSjII5Icm-x_NpmtmK4",
  databaseURL: "https://mysetup-8dcd5-default-rtdb.firebaseio.com",
  projectId: "mysetup-8dcd5",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dataRef = database.ref("components");

/* ─── DOM REFERANSLARI ─────────────────────────────────────────────────────────── */
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

// MODAL DÜZENLEME
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

// Edit fiyat kutusunu akıllı formata geçiriyoruz
editPrice.type = "text";
editPrice.inputMode = "decimal";

editPrice.addEventListener("input", function () {
  let value = this.value.replace(/[^0-9,]/g, "");
  const parts = value.split(",");
  if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");

  if (value) {
    let [integerPart, decimalPart] = value.split(",");
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    this.value =
      decimalPart !== undefined ? `${integerPart},${decimalPart}` : integerPart;
  } else {
    this.value = "";
  }
});

/* ─── State ──────────────────────────────────────────────────────────────────── */
let allData = {};
let currentSearch = "";
let currentStatusFilter = "all";
let currentSort = { col: "date", dir: "asc" };
let editingId = null;

/* ─── Connection Status ──────────────────────────────────────────────────────── */
function updateSystemStatus(text, state) {
  statusText.textContent = text;
  statusPanel.className = "status-panel" + (state ? ` status-${state}` : "");
}

updateSystemStatus("Bağlanıyor...", "warn");

database.ref(".info/connected").on("value", (snapshot) => {
  updateSystemStatus(
    snapshot.val() ? "Bağlandı" : "Bağlantı Kesildi",
    snapshot.val() ? "ok" : "error",
  );
});

/* ─── Firebase Listener ──────────────────────────────────────────────────────── */
dataRef.on(
  "value",
  (snapshot) => {
    allData = snapshot.val() || {};
    renderAll();
  },
  () => updateSystemStatus("Veri alınamadı", "error"),
);

/* ─── Normalize Turkish Chars ────────────────────────────────────────────────── */
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

/* ─── Filter + Sort ──────────────────────────────────────────────────────────── */
function getFilteredSortedList() {
  let list = Object.keys(allData).map((id) => ({ id, ...allData[id] }));

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter((item) =>
      [item.component, item.brand, item.specs, item.vendor].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }

  if (currentStatusFilter !== "all") {
    list = list.filter((item) => {
      const norm = normalizeTr(item.status);
      if (currentStatusFilter === "saglikli") return norm.includes("saglikl");
      if (currentStatusFilter === "bozuk") return norm.includes("bozuk");
      if (currentStatusFilter === "yedek") return norm.includes("yedek");
      if (currentStatusFilter === "atildi") return norm.includes("atild");
      return true;
    });
  }

  list.sort((a, b) => {
    let av = a[currentSort.col] ?? "";
    let bv = b[currentSort.col] ?? "";

    if (currentSort.col === "price") {
      av = parseFloat(av) || 0;
      bv = parseFloat(bv) || 0;
      return currentSort.dir === "asc" ? av - bv : bv - av;
    }
    if (currentSort.col === "date") {
      return currentSort.dir === "asc"
        ? new Date(av) - new Date(bv)
        : new Date(bv) - new Date(av);
    }
    av = av.toString().toLowerCase();
    bv = bv.toString().toLowerCase();
    return currentSort.dir === "asc"
      ? av.localeCompare(bv, "tr")
      : bv.localeCompare(av, "tr");
  });

  return list;
}

/* ─── Render Pipeline ────────────────────────────────────────────────────────── */
function renderAll() {
  const list = getFilteredSortedList();
  updateStats(list);
  renderTableRows(list);
  updateResultCount(list.length);
}

/* ─── Stats Cards ────────────────────────────────────────────────────────────── */
function updateStats(filteredList) {
  const all = Object.values(allData);
  const total = all.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const count = all.length;
  const healthy = all.filter((i) =>
    normalizeTr(i.status).includes("saglikl"),
  ).length;
  const mostExp = all.reduce(
    (best, i) =>
      (parseFloat(i.price) || 0) > (parseFloat(best?.price) || 0) ? i : best,
    null,
  );

  document.getElementById("statTotal").textContent =
    CURRENCY_FORMAT.format(total) + " ₺";
  document.getElementById("statCount").textContent = count;
  document.getElementById("statHealthy").textContent = healthy;
  document.getElementById("statExpensive").textContent = mostExp
    ? mostExp.component
    : "—";

  const filteredTotal = filteredList.reduce(
    (s, i) => s + (parseFloat(i.price) || 0),
    0,
  );
  document.getElementById("totalCostDisplay").textContent =
    CURRENCY_FORMAT.format(filteredTotal) + " ₺";
}

/* ─── Render Table Rows ──────────────────────────────────────────────────────── */
function createRowEl(item) {
  const tr = document.createElement("tr");
  tr.dataset.id = item.id;
  tr.addEventListener("dblclick", (e) => {
    const targetCell = e.target.closest("td");
    let focusTarget = "component";

    if (targetCell) {
      if (targetCell.classList.contains("col-date")) focusTarget = "date";
      else if (targetCell.classList.contains("col-brand"))
        focusTarget = "brand";
      else if (targetCell.classList.contains("col-specs"))
        focusTarget = "specs";
      else if (targetCell.classList.contains("col-price"))
        focusTarget = "price";
      else if (targetCell.classList.contains("col-vendor"))
        focusTarget = "vendor";
    }

    if (
      !e.target.closest(".status-menu") &&
      !e.target.closest(".row-actions")
    ) {
      openEditModal(item.id, focusTarget);
    }
  });
  return tr;
}

function renderTableRows(list) {
  const unsavedRows = Array.from(tableBody.querySelectorAll(".new-item-row"));
  tableBody.innerHTML = "";

  if (!list.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="7" class="empty-cell">
        <div class="empty-state">
          <div class="empty-icon">⊘</div>
          <span>${currentSearch || currentStatusFilter !== "all" ? "Filtreyle eşleşen kayıt bulunamadı" : "Henüz kayıt yok"}</span>
        </div>
      </td>`;
    tableBody.appendChild(emptyRow);
    unsavedRows.forEach((r) => tableBody.appendChild(r));
    return;
  }

  const groupByDate = currentSort.col === "date";

  if (groupByDate) {
    const dateGroups = [];
    let currentDateGroup = null;

    list.forEach((item) => {
      const formattedDate = DATE_FORMAT(item.date);
      if (!currentDateGroup || currentDateGroup.label !== formattedDate) {
        currentDateGroup = { label: formattedDate, items: [] };
        dateGroups.push(currentDateGroup);
      }
      currentDateGroup.items.push(item);
    });

    dateGroups.forEach((group) => {
      const sep = document.createElement("tr");
      sep.className = "group-separator";
      sep.innerHTML = `<td colspan="7"></td>`;
      tableBody.appendChild(sep);

      const vendorGroups = [];
      let currentVendorGroup = null;

      group.items.forEach((item) => {
        if (!currentVendorGroup || currentVendorGroup.name !== item.vendor) {
          currentVendorGroup = { name: item.vendor, items: [] };
          vendorGroups.push(currentVendorGroup);
        }
        currentVendorGroup.items.push(item);
      });

      let dateRowSpanIndex = 0;

      vendorGroups.forEach((vGroup) => {
        vGroup.items.forEach((item, itemIdx) => {
          const tr = createRowEl(item);
          const statusClass = getStatusClassName(item.status);

          const dateCell =
            dateRowSpanIndex === 0
              ? `<td class="col-date" rowspan="${group.items.length}">${group.label}</td>`
              : "";
          const vendorCell =
            itemIdx === 0
              ? `<td class="col-vendor" rowspan="${vGroup.items.length}">${escHtml(vGroup.name)}</td>`
              : "";

          tr.innerHTML = `
            ${dateCell}
            <td class="col-component">${escHtml(item.component)}</td>
            <td class="col-brand">
              ${
                item.url && item.url.trim() !== ""
                  ? `
                <a href="${item.url}" target="_blank" class="brand-link" title="Ürüne Git">
                  ${escHtml(item.brand)} <span class="link-icon">🔗</span>
                </a>
              `
                  : escHtml(item.brand)
              }
            </td>
            <td class="col-specs">${escHtml(item.specs)}</td>
            <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
            ${vendorCell}
            <td class="status-cell">
              <div class="status-cell-inner">
                <div class="status-menu">
                  <span class="status-label ${statusClass}">${item.status}</span>
                  <div class="status-options">
                    <div onclick="updateItemStatus('${item.id}', 'sağlıklı')">✓ Sağlıklı</div>
                    <div onclick="updateItemStatus('${item.id}', 'bozuk')">✗ Bozuk</div>
                    <div onclick="updateItemStatus('${item.id}', 'yedek')">◉ Yedek</div>
                    <div onclick="updateItemStatus('${item.id}', 'atıldı')">⊘ Atıldı</div>
                  </div>
                </div>
                <div class="row-actions">
                  <button class="action-btn edit-btn" onclick="openEditModal('${item.id}')" title="Düzenle (çift tıkla)">✎</button>
                  <button class="action-btn delete-btn" onclick="deleteItem('${item.id}')" title="Sil">✕</button>
                </div>
              </div>
            </td>
          `;
          tableBody.appendChild(tr);
          dateRowSpanIndex++;
        });
      });
    });
  } else {
    const topSep = document.createElement("tr");
    topSep.className = "group-separator";
    topSep.innerHTML = `<td colspan="7"></td>`;
    tableBody.appendChild(topSep);

    list.forEach((item) => {
      const tr = createRowEl(item);
      const statusClass = getStatusClassName(item.status);
      const formattedDate = DATE_FORMAT(item.date);

      tr.innerHTML = `
        <td class="col-date">${formattedDate}</td>
        <td class="col-component">${escHtml(item.component)}</td>
        <td class="col-brand">
          ${
            item.url && item.url.trim() !== ""
              ? `
            <a href="${item.url}" target="_blank" class="brand-link" title="Ürüne Git">
              ${escHtml(item.brand)} <span class="link-icon">🔗</span>
            </a>
          `
              : escHtml(item.brand)
          }
        </td>
        <td class="col-specs">${escHtml(item.specs)}</td>
        <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
        <td class="col-vendor">${escHtml(item.vendor)}</td>
        <td class="status-cell">
          <div class="status-cell-inner">
            <div class="status-menu">
              <span class="status-label ${statusClass}">${item.status}</span>
              <div class="status-options">
                <div onclick="updateItemStatus('${item.id}', 'sağlıklı')">✓ Sağlıklı</div>
                <div onclick="updateItemStatus('${item.id}', 'bozuk')">✗ Bozuk</div>
                <div onclick="updateItemStatus('${item.id}', 'yedek')">◉ Yedek</div>
                <div onclick="updateItemStatus('${item.id}', 'atıldı')">⊘ Atıldı</div>
              </div>
            </div>
            <div class="row-actions">
              <button class="action-btn edit-btn" onclick="openEditModal('${item.id}')" title="Düzenle (çift tıkla)">✎</button>
              <button class="action-btn delete-btn" onclick="deleteItem('${item.id}')" title="Sil">✕</button>
            </div>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }
  unsavedRows.forEach((r) => tableBody.appendChild(r));
}

/* ─── Result Count ───────────────────────────────────────────────────────────── */
function updateResultCount(filteredCount) {
  const total = Object.keys(allData).length;
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  resultCount.textContent = isFiltered
    ? `${filteredCount} / ${total} kayıt`
    : "";
}

/* ─── Status Class ───────────────────────────────────────────────────────────── */
function getStatusClassName(statusValue) {
  const key = normalizeTr(statusValue);
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return "status-healthy";
}

/* ─── HTML Escape ────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ─── Sort Headers ───────────────────────────────────────────────────────────── */
document.querySelectorAll(".sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    currentSort =
      currentSort.col === col
        ? { col, dir: currentSort.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" };
    updateSortIcons();
    renderAll();
  });
});

function updateSortIcons() {
  document.querySelectorAll(".sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    if (th.dataset.col === currentSort.col) {
      icon.textContent = currentSort.dir === "asc" ? "↑" : "↓";
      th.classList.add("sort-active");
    } else {
      icon.textContent = "↕";
      th.classList.remove("sort-active");
    }
  });
}

/* ─── Search ─────────────────────────────────────────────────────────────────── */
searchInput.addEventListener("input", () => {
  currentSearch = searchInput.value;
  clearSearch.style.display = currentSearch ? "flex" : "none";
  renderAll();
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  currentSearch = "";
  clearSearch.style.display = "none";
  renderAll();
  searchInput.focus();
});

/* ─── Status Filter Buttons ──────────────────────────────────────────────────── */
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    renderAll();
  });
});

/* ─── Export CSV ─────────────────────────────────────────────────────────────── */
function exportCSV() {
  const list = getFilteredSortedList();
  if (!list.length) {
    showToast("Dışa aktarılacak veri yok", "warn");
    return;
  }

  const headers = [
    "Tarih",
    "Bileşen",
    "Marka",
    "Özellikler",
    "Fiyat",
    "Satıcı",
    "Durum",
    "Link",
  ];

  const rows = list.map((i) =>
    [
      i.date,
      i.component,
      i.brand,
      i.specs,
      i.price,
      i.vendor,
      i.status,
      i.url || "",
    ]
      .map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mysetup_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${list.length} kayıt dışa aktarıldı`, "success");
}

/* ─── Import CSV ─────────────────────────────────────────────────────────────── */
function processCsv(csv) {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length < 2) return;

  showConfirm("Veriler sıfırlanacak. Onaylıyor musunuz?", () => {
    dataRef.remove().then(() => {
      let importCount = 0;
      lines.slice(1).forEach((line) => {
        const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
        let cols = line.match(regex) || [];
        if (cols.length === 0) cols = line.split(",");

        cols = cols.map((c) =>
          c.replace(/^"|"$/g, "").replace(/""/g, '"').trim(),
        );

        if (cols.length >= 7) {
          let rawPrice = cols[4].replace(/[^\d.,]/g, "");
          if (rawPrice.includes(",") && rawPrice.includes(".")) {
            rawPrice = rawPrice.replace(/\./g, "").replace(",", ".");
          } else if (rawPrice.includes(",")) {
            rawPrice = rawPrice.replace(",", ".");
          }

          const newItem = {
            date: cols[0] || new Date().toISOString().split("T")[0],
            component: cols[1] || "-",
            brand: cols[2] || "-",
            specs: cols[3] || "-",
            price: parseFloat(rawPrice) || 0,
            vendor: cols[5] || "-",
            status: (cols[6] || "saglikli").toLowerCase(),
            url: cols[7] || "",
          };
          dataRef.push(newItem);
          importCount++;
        }
      });
      showToast(`${importCount} kayıt başarıyla yüklendi.`, "success");
    });
  });
}

/* ─── CSV UI Triggers ───────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importCsvInput = document.getElementById("importCsvInput");

  if (exportBtn) exportBtn.onclick = exportCSV;

  if (importBtn && importCsvInput) {
    importBtn.onclick = () => importCsvInput.click();
    importCsvInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => processCsv(ev.target.result);
      reader.readAsText(file);
      importCsvInput.value = "";
    };
  }
});

/* ─── Edit Modal ─────────────────────────────────────────────────────────────── */
window.openEditModal = function (id, focusTarget = "component") {
  const item = allData[id];
  if (!item) return;

  editingId = id;

  const parts = (item.date || "").split("-");
  editDate.value =
    parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : "";
  editDatePicker.value = item.date || "";
  editComponent.value = item.component || "";
  editBrand.value = item.brand === "-" ? "" : item.brand || "";
  editSpecs.value = item.specs === "-" ? "" : item.specs || "";
  editUrl.value = item.url || "";

  let dPrice = (item.price || 0).toString().replace(".", ",");
  let [iPart, dPart] = dPrice.split(",");
  if (iPart) iPart = iPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  editPrice.value =
    dPart !== undefined ? `${iPart},${dPart}` : item.price ? iPart : "";

  editVendor.value = item.vendor === "-" ? "" : item.vendor || "";
  editStatus.value = item.status || "sağlıklı";

  editModal.classList.add("active");

  setTimeout(() => {
    switch (focusTarget) {
      case "date":
        editDate.focus();
        break;
      case "brand":
        editBrand.focus();
        break;
      case "specs":
        editSpecs.focus();
        break;
      case "price":
        editPrice.focus();
        break;
      case "vendor":
        editVendor.focus();
        break;
      default:
        editComponent.focus();
    }
  }, 80);
};

function closeEditModal() {
  editModal.classList.remove("active");
  editingId = null;
}

function saveEditModal() {
  if (!editingId) return;
  const component = editComponent.value.trim();
  if (!component) {
    showToast("Bileşen adı zorunludur", "error");
    editComponent.focus();
    return;
  }

  const rawDate = editDate.value.trim();
  const parts = rawDate.split(/[./-]/);
  let finalDate;
  if (parts.length === 3) {
    finalDate =
      parts[0].length <= 2
        ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
        : rawDate;
  }
  if (!finalDate || isNaN(new Date(finalDate).getTime())) {
    finalDate = new Date().toISOString().split("T")[0];
  }

  const rawEditPrice = editPrice.value.replace(/\./g, "").replace(",", ".");

  database
    .ref("components/" + editingId)
    .update({
      date: finalDate,
      component,
      brand: editBrand.value.trim() || "-",
      specs: editSpecs.value.trim() || "-",
      price: parseFloat(rawEditPrice) || 0,
      vendor: editVendor.value.trim() || "-",
      status: editStatus.value,
      url: editUrl.value.trim(),
    })
    .then(() => {
      showToast("Kayıt güncellendi", "success");
      closeEditModal();
    })
    .catch(() => showToast("Güncelleme başarısız", "error"));
}

modalClose.onclick = closeEditModal;
modalCancel.onclick = closeEditModal;
modalSave.onclick = saveEditModal;

editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

editCalIcon.onclick = () => editDatePicker.showPicker();
editDatePicker.onchange = (e) => {
  const [y, m, d] = e.target.value.split("-");
  editDate.value = `${d}.${m}.${y}`;
};

/* ─── Firebase Actions ───────────────────────────────────────────────────────── */
window.updateItemStatus = (id, newStatus) => {
  database
    .ref("components/" + id)
    .update({ status: newStatus })
    .then(() => showToast(`Durum güncellendi: ${newStatus}`, "success"))
    .catch(() => showToast("Güncelleme başarısız", "error"));
};

window.deleteItem = (id) => {
  const item = allData[id];
  const name = item ? item.component : "Kayıt";
  showConfirm(`"${name}" silinsin mi?`, () => {
    database
      .ref("components/" + id)
      .remove()
      .then(() => showToast("Kayıt silindi", "success"))
      .catch(() => showToast("Silme başarısız", "error"));
  });
};

/* ─── Add New Item Row ───────────────────────────────────────────────────────── */
addItemBtn.onclick = () => {
  const existing = tableBody.querySelector(".new-item-row");
  if (existing) {
    existing.querySelector(".entry-input").focus();
    return;
  }
  tableBody.appendChild(initiateAddRow());
};

function initiateAddRow() {
  const tr = document.createElement("tr");
  tr.className = "new-item-row";
  tr.innerHTML = `
    <td>
      <div class="date-input-wrapper">
        <input type="text" class="entry-input date-input" placeholder="GG.AA.YYYY" style="min-width:110px">
        <input type="date" class="hidden-picker" tabindex="-1">
        <span class="calendar-icon">📅</span>
      </div>
    </td>
    <td><input type="text" class="entry-input component-input" placeholder="Bileşen" style="min-width:120px"></td>
    <td><input type="text" class="entry-input brand-input" placeholder="Marka"></td>
    <td><input type="text" class="entry-input specs-input" placeholder="Özellikler" style="min-width:160px"></td>
    <td><input type="text" class="entry-input price-input" placeholder="0,00" style="min-width:90px" inputmode="decimal"></td>
    <td><input type="text" class="entry-input vendor-input" placeholder="Satıcı"></td>
    <td><button type="button" class="save-btn" style="display:none;">Kaydet</button></td>
  `;

  const dateInput = tr.querySelector(".date-input");
  const hiddenPicker = tr.querySelector(".hidden-picker");
  const calendarIcon = tr.querySelector(".calendar-icon");
  const inputs = tr.querySelectorAll(".entry-input");
  const saveBtn = tr.querySelector(".save-btn");
  const priceInput = tr.querySelector(".price-input");

  calendarIcon.onclick = () => hiddenPicker.showPicker();
  hiddenPicker.onchange = (e) => {
    const [y, m, d] = e.target.value.split("-");
    dateInput.value = `${d}.${m}.${y}`;
  };

  priceInput.addEventListener("input", function () {
    let value = this.value.replace(/[^0-9,]/g, "");
    const parts = value.split(",");
    if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");
    if (value) {
      let [integerPart, decimalPart] = value.split(",");
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      this.value =
        decimalPart !== undefined
          ? `${integerPart},${decimalPart}`
          : integerPart;
    } else {
      this.value = "";
    }
  });

  inputs[1].addEventListener("input", () => {
    saveBtn.style.display = inputs[1].value.trim() ? "inline-flex" : "none";
  });

  inputs[inputs.length - 1].addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey && inputs[1].value.trim()) {
      e.preventDefault();
      submitNewItem(tr, inputs);
    }
  });

  tr.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && inputs[1].value.trim()) submitNewItem(tr, inputs);
  });

  saveBtn.onclick = () => submitNewItem(tr, inputs);
  setTimeout(() => inputs[1].focus(), 30);
  return tr;
}

function submitNewItem(tr, inputs) {
  const component = inputs[1].value.trim();
  if (!component) return;

  const rawDate = inputs[0].value.trim();
  const parts = rawDate.split(/[./-]/);
  let finalDate;
  if (parts.length === 3) {
    finalDate =
      parts[0].length <= 2
        ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
        : rawDate;
  }
  if (!finalDate || isNaN(new Date(finalDate).getTime())) {
    finalDate = new Date().toISOString().split("T")[0];
  }

  const rawPrice = inputs[4].value.replace(/\./g, "").replace(",", ".");

  dataRef
    .push({
      date: finalDate,
      component,
      brand: inputs[2].value.trim() || "-",
      specs: inputs[3].value.trim() || "-",
      price: parseFloat(rawPrice) || 0,
      vendor: inputs[5].value.trim() || "-",
      status: "sağlıklı",
      url: "",
    })
    .then(() => {
      tr.remove();
      showToast(`"${component}" eklendi`, "success");
    })
    .catch(() => showToast("Kayıt eklenemedi", "error"));
}

/* ─── Toast System ───────────────────────────────────────────────────────────── */
function showToast(message, type = "info", duration = 3200) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { success: "✓", error: "✕", warn: "⚠", info: "i" };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "i"}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });
  setTimeout(() => {
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }, duration);
}

function showConfirm(message, onConfirm) {
  const toast = document.createElement("div");
  toast.className = "toast toast-confirm";
  toast.innerHTML = `<span>${message}</span><div class="toast-actions"><button class="toast-yes">Evet, Sil</button><button class="toast-no">İptal</button></div>`;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });
  const dismiss = () => {
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };
  toast.querySelector(".toast-yes").onclick = () => {
    dismiss();
    onConfirm();
  };
  toast.querySelector(".toast-no").onclick = dismiss;
}

/* ─── Keyboard Shortcuts ─────────────────────────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (editModal.classList.contains("active")) {
      closeEditModal();
    } else {
      const newRow = tableBody.querySelector(".new-item-row");
      if (newRow) newRow.remove();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    if (editModal.classList.contains("active")) {
      e.preventDefault();
      saveEditModal();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const tag = document.activeElement.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
});

/* ─── GÜNCELLEME SİSTEMİ ─────────────────────────────────────────────────── */
if (ipcRenderer) {
  ipcRenderer.on("app_version", (event, version) => {
    if (versionDisplay) versionDisplay.innerText = `v${version}`;
  });

  // Sadece güncelleme bulunduğunda tetiklenir
  ipcRenderer.on("update_available", (event, version) => {
    if (!updateBtn) return;

    updateBtn.style.display = "flex";
    updateBtn.style.pointerEvents = "auto";
    updateBtn.innerHTML = `Güncelleme Mevcut`; // Versiyon numarasını sildik, daha sade.

    // BUTONA TIKLANDIĞINDA
    updateBtn.onclick = () => {
      // 1. Onay isteme, butonu kilitle ve yazıyı değiştir
      updateBtn.innerHTML = "Güncelleme Yükleniyor...";
      updateBtn.style.pointerEvents = "none";
      updateBtn.style.color = "var(--text-dim)";

      // 2. Arka planda indirmeyi başlat (Bittiğinde main.js programı kapatacak)
      ipcRenderer.send("start_download");
    };
  });

  // Hata durumunda sadece butonu eski haline getir
  ipcRenderer.on("update_error", () => {
    if (updateBtn && updateBtn.style.display === "flex") {
      updateBtn.innerHTML = "Güncelleme Başarısız";
      updateBtn.style.pointerEvents = "auto";
      updateBtn.style.color = "var(--red)";
    }
  });
}
