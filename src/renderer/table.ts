/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     DURUM DEĞİŞKENLERİ VE KONTROL                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sabitler ─────────────────── */

const VSCROLL_INITIAL = 40;

import {
  allData,
  currentSearch,
  currentStatusFilter,
  currentSort,
  isAnyModalOpen,
  scheduleRender,
  normalizeTr,
  STATUS_MAP,
  DATE_FORMAT,
  CURRENCY_FORMAT,
  escHtml,
  escAttr,
  mainScroll,
  tableBody,
  addItemBtn,
  editModal,
  applyPriceFormat,
  parseDateInput,
  parsePriceInput,
} from "./utils";
import {
  addComponentToFirebase,
  deleteComponentFromFirebase,
  updateComponentStatusInFirebase,
} from "./firebase-inv";
import { showToast, showConfirm } from "./io";
import { openEditModal } from "./editmodal";
import { updateStats, updateResultCount, rebuildStatsCache, updateStatsCacheOnChange } from "./toolbar";

/* ─────────────────── MutationObserver ─────────────────── */

(function () {
  const observer = new MutationObserver(function () {
    if (!isAnyModalOpen() && (_pendingRender as boolean)) {
      (_pendingRender as boolean) = false;
      renderAll();
    }
  });
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
})();

let _pendingRender: boolean = false;
let _vsRafId: number | null = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FİLTRELEME VE SIRALAMA                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function getFilteredSortedList(): any[] {
  let list = Object.keys(allData)
    .map((id) => ({ id, ...allData[id] }))
    .filter(isItemVisible);

  list.sort((a, b) => {
    let av = a[currentSort.col] ?? "";
    let bv = b[currentSort.col] ?? "";

    if (currentSort.col === "price") {
      av = parseFloat(av) || 0;
      bv = parseFloat(bv) || 0;
      return currentSort.dir === "asc" ? av - bv : bv - av;
    }

    if (currentSort.col === "date") {
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return currentSort.dir === "asc" ? cmp : -cmp;
    }

    av = av.toString().toLowerCase();
    bv = bv.toString().toLowerCase();
    return currentSort.dir === "asc"
      ? av.localeCompare(bv, "tr")
      : bv.localeCompare(av, "tr");
  });

  return list;
}

export function updateSortIcons(): void {
  document.querySelectorAll(".sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon") as HTMLElement | null;
    const col = (th as HTMLElement).dataset.sort || (th as HTMLElement).dataset.col;

    if (col === currentSort.col) {
      if (icon) icon.textContent = currentSort.dir === "asc" ? "↑" : "↓";
      th.classList.add("sort-active");
      th.classList.remove("asc", "desc");
      th.classList.add(currentSort.dir);
    } else {
      if (icon) icon.textContent = "↕";
      th.classList.remove("sort-active", "asc", "desc");
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SATIR VE HÜCRE OLUŞTURMA                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

function getStatusClassName(statusValue: string): string {
  const key = normalizeTr(statusValue);
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return "status-healthy";
}

function buildStatusCellInnerHTML(item: any): string {
  const statusClass = getStatusClassName(item.status);
  const safeId = escAttr(item.id);
  const safeStatus = escHtml(item.status);
  return `<td class="status-cell"><div class="status-cell-inner">
    <div class="status-menu">
      <span class="status-label ${statusClass}">${safeStatus}</span>
      <div class="status-options">
        <div data-action="update-status" data-id="${safeId}" data-status="sağlıklı">✓ Sağlıklı</div>
        <div data-action="update-status" data-id="${safeId}" data-status="bozuk">✗ Bozuk</div>
        <div data-action="update-status" data-id="${safeId}" data-status="yedek">◉ Yedek</div>
        <div data-action="update-status" data-id="${safeId}" data-status="atıldı">⊘ Atıldı</div>
      </div>
    </div>
    <div class="row-actions">
      <button class="action-btn edit-btn"   data-action="edit-item"   data-id="${safeId}" title="Düzenle">✎</button>
      <button class="action-btn delete-btn" data-action="delete-item" data-id="${safeId}" title="Sil">✕</button>
    </div>
  </div></td>`;
}

function buildCombinedSpecsCellHTML(item: any): string {
  const brandText = item.brand && item.brand !== "-" ? escHtml(item.brand) : "";
  const specsText = item.specs && item.specs !== "-" ? escHtml(item.specs) : "";

  let contentHtml = `<div class="specs-text-content">`;
  if (brandText) contentHtml += `<span class="brand-text">${brandText}</span>`;
  if (specsText) contentHtml += `<span class="specs-text">${specsText}</span>`;
  if (!brandText && !specsText)
    contentHtml += `<span class="specs-text">-</span>`;
  contentHtml += `</div>`;

  if (item.url) {
    return `<div class="combined-specs-cell">
      ${contentHtml}
      <a href="${escAttr(item.url)}" target="_blank" title="Ürün Linkine Git" class="brand-url-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>`;
  }
  return `<div class="combined-specs-cell">${contentHtml}</div>`;
}

function buildRowHTML(item: any): string {
  return `
    <td class="col-date">${DATE_FORMAT(item.date)}</td>
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-specs">${buildCombinedSpecsCellHTML(item)}</td>
    <td class="col-price">` + CURRENCY_FORMAT.format(item.price) + ` ₺</td>
    <td class="col-vendor">${escHtml(item.vendor)}</td>
    ${buildStatusCellInnerHTML(item)}
  `;
}

function buildGroupRowHTML(item: any, dateCell: string, vendorCell: string): string {
  return `
    ${dateCell}
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-specs">${buildCombinedSpecsCellHTML(item)}</td>
    <td class="col-price">` + CURRENCY_FORMAT.format(item.price) + ` ₺</td>
    ${vendorCell}
    ${buildStatusCellInnerHTML(item)}
  `;
}

function createRowEl(item: any): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.dataset.id = item.id;
  return tr;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       FRAGMENT OLUŞTURUCU                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function buildRowsFragment(list: any[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const groupByDate = currentSort.col === "date";

  if (groupByDate) {
    const dateGroups: { label: string; items: any[] }[] = [];
    let currentDateGroup: { label: string; items: any[] } | null = null;

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
      sep.innerHTML = `<td colspan="6"></td>`;
      fragment.appendChild(sep);

      const vendorGroups: { name: string; items: any[] }[] = [];
      let currentVendorGroup: { name: string; items: any[] } | null = null;

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
          const dateCell =
            dateRowSpanIndex === 0
              ? `<td class="col-date" rowspan="${group.items.length}">${group.label}</td>`
              : "";
          const vendorCell =
            itemIdx === 0
              ? `<td class="col-vendor" rowspan="${vGroup.items.length}">${escHtml(vGroup.name)}</td>`
              : "";
          tr.innerHTML = buildGroupRowHTML(item, dateCell, vendorCell);
          fragment.appendChild(tr);
          dateRowSpanIndex++;
        });
      });
    });
  } else {
    const topSep = document.createElement("tr");
    topSep.className = "group-separator";
    topSep.innerHTML = `<td colspan="6"></td>`;
    fragment.appendChild(topSep);

    list.forEach((item) => {
      const tr = createRowEl(item);
      tr.innerHTML = buildRowHTML(item);
      fragment.appendChild(tr);
    });
  }

  return fragment;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       RENDER MOTORU + VIRTUAL SCROLL                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

function renderTableRows(list: any[], scrollY?: number): void {
  if (_vsRafId) {
    cancelAnimationFrame(_vsRafId);
    _vsRafId = null;
  }

  const unsavedRows = Array.from(tableBody!.querySelectorAll(".new-item-row"));

  if (!list.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="6" class="empty-cell">
        <div class="empty-state">
          <div class="empty-icon">⊘</div>
          <span>${
            currentSearch || currentStatusFilter !== "all"
              ? "Filtreyle eşleşen kayıt bulunamadı"
              : "Henüz kayıt yok"
          }</span>
        </div>
      </td>`;
    tableBody!.replaceChildren(emptyRow, ...unsavedRows);
    return;
  }

  if (currentSort.col === "date" || list.length <= VSCROLL_INITIAL) {
    tableBody!.replaceChildren(buildRowsFragment(list), ...unsavedRows);
    if (mainScroll && scrollY !== undefined) mainScroll.scrollTop = scrollY;
    return;
  }

  const firstChunk = list.slice(0, VSCROLL_INITIAL);
  tableBody!.replaceChildren(buildRowsFragment(firstChunk), ...unsavedRows);

  const restList = list.slice(VSCROLL_INITIAL);

  _vsRafId = requestAnimationFrame(() => {
    _vsRafId = null;

    const restFrag = document.createDocumentFragment();
    restList.forEach((item) => {
      const tr = createRowEl(item);
      tr.innerHTML = buildRowHTML(item);
      restFrag.appendChild(tr);
    });
    const saved = tableBody!.querySelectorAll(".new-item-row");
    if (saved.length) {
      tableBody!.insertBefore(restFrag, saved[0]);
    } else {
      tableBody!.appendChild(restFrag);
    }

    if (mainScroll && scrollY !== undefined) mainScroll.scrollTop = scrollY;
  });
}

/* ─────────────────── Tam Render ─────────────────── */

export function renderAll(): void {
  (window as any).renderAll = renderAll;
  const scrollY = mainScroll ? mainScroll.scrollTop : 0;
  const list = getFilteredSortedList();
  updateStats(list);
  renderTableRows(list, scrollY);
  updateResultCount(list.length);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      CRUD VE VERİ GÜNCELLEMELERİ                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

function isItemVisible(item: any): boolean {
  if (currentSearch) {
    const q = normalizeTr(currentSearch);
    if (!item._searchTag || !item._searchTag.includes(q)) return false;
  }
  if (currentStatusFilter !== "all") {
    const norm = item._statusNorm || "";
    if (currentStatusFilter === "saglikli" && !norm.includes("saglikli"))
      return false;
    if (currentStatusFilter === "bozuk" && !norm.includes("bozuk"))
      return false;
    if (currentStatusFilter === "yedek" && !norm.includes("yedek"))
      return false;
    if (currentStatusFilter === "atildi" && !norm.includes("atildi"))
      return false;
  }
  return true;
}

export function addOrUpdateTableRow(id: string, item: any): void {
  if (currentSort.col === "date") {
    scheduleRender();
    return;
  }

  const visible = isItemVisible(item);
  const row = tableBody!.querySelector(`tr[data-id="${id}"]`) as HTMLTableRowElement | null;
  const newItem = { ...item, id };

  if (!visible) {
    if (row) row.remove();
    return;
  }

  const newRow = createRowEl(newItem);
  newRow.innerHTML = buildRowHTML(newItem);

  if (row) {
    row.replaceWith(newRow);
  } else {
    const topSep = tableBody!.querySelector(".group-separator");
    if (topSep && topSep.nextSibling) {
      tableBody!.insertBefore(newRow, topSep.nextSibling);
    } else {
      tableBody!.appendChild(newRow);
    }
  }
}

export function removeTableRow(id: string): void {
  const row = tableBody!.querySelector(`tr[data-id="${id}"]`);
  if (row) row.remove();

  if (Object.keys(allData).length === 0) {
    renderAll();
    return;
  }
}

function updateItemStatus(itemId: string, newStatus: string): void {
  const currentItem = allData[itemId];
  if (!currentItem) return;
  if (currentItem._statusNorm === normalizeTr(newStatus)) return;

  const oldItem = { ...currentItem };
  const oldStatusNorm = currentItem._statusNorm;

  currentItem.status = newStatus;
  currentItem._statusNorm = normalizeTr(newStatus);

  updateStatsCacheOnChange(currentItem, oldItem, false);

  const applyToDOM = () => {
    const row = tableBody?.querySelector(`tr[data-id="${itemId}"]`);
    const cell = row?.querySelector(".status-cell");
    if (cell && cell.parentNode) {
      const newCell = document.createElement("td");
      newCell.className = "status-cell";
      newCell.innerHTML = buildStatusCellInnerHTML(
        Object.assign({ id: itemId }, currentItem),
      );
      cell.parentNode.replaceChild(newCell, cell);
    }
  };

  applyToDOM();

  updateComponentStatusInFirebase(itemId, newStatus)
    .then(() => {
      showToast("Kayıt güncellendi", "success");
    })
    .catch(() => {
      currentItem.status = oldItem.status;
      currentItem._statusNorm = oldStatusNorm;
      rebuildStatsCache();
      updateStats(getFilteredSortedList());
      applyToDOM();
      showToast("Durum güncellenemedi", "error");
    });
}

function deleteItem(itemId: string): void {
  if (!allData[itemId]) {
    showToast("Hata: Silinecek öğe bulunamadı!", "error");
    return;
  }

  const performDelete = () => {
    deleteComponentFromFirebase(itemId)
      .then(() => {
        showToast("Kayıt silindi", "success", 2200);
      })
      .catch(() => {
        showToast("Kayıt silinemedi", "error");
      });
  };

  showConfirm("Bu kaydı silmek istediğinize emin misiniz?", performDelete);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        YENİ KAYIT EKLEME                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function initiateAddRow(): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = "new-item-row";
  tr.innerHTML = `
    <td>
      <div class="date-input-wrapper">
        <input type="text" class="entry-input date-input" placeholder="GG.AA.YYYY">
        <input type="date" class="hidden-picker" tabindex="-1">
        <span class="calendar-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
      </div>
    </td>
    <td><input type="text" class="entry-input component-input" placeholder="Bileşen Adı *"></td>
    <td>
      <div style="display: flex; gap: 6px;">
        <input type="text" class="entry-input brand-input" placeholder="Marka" style="flex: 1;">
        <input type="text" class="entry-input specs-input" placeholder="Özellikler" style="flex: 1;">
      </div>
    </td>
    <td><input type="text" class="entry-input price-input" placeholder="0,00" inputmode="decimal"></td>
    <td><input type="text" class="entry-input vendor-input" placeholder="Satıcı"></td>
    <td style="text-align: center;">
      <button type="button" class="btn-modal-save save-btn new-row-save">Kaydet</button>
    </td>
  `;

  const dateInput = tr.querySelector(".date-input") as HTMLInputElement | null;
  const hiddenPicker = tr.querySelector(".hidden-picker") as HTMLInputElement | null;
  const calendarIcon = tr.querySelector(".calendar-icon") as HTMLElement | null;
  const componentInput = tr.querySelector(".component-input") as HTMLInputElement | null;
  const brandInput = tr.querySelector(".brand-input") as HTMLInputElement | null;
  const specsInput = tr.querySelector(".specs-input") as HTMLInputElement | null;
  const priceInput = tr.querySelector(".price-input") as HTMLInputElement | null;
  const vendorInput = tr.querySelector(".vendor-input") as HTMLInputElement | null;
  const saveBtn = tr.querySelector(".save-btn") as HTMLElement | null;

  if (calendarIcon && hiddenPicker) {
    calendarIcon.onclick = () => hiddenPicker.showPicker();
  }

  if (hiddenPicker) {
    hiddenPicker.onchange = (e) => {
      const [y, m, d] = (e.target as HTMLInputElement).value.split("-");
      if (dateInput) dateInput.value = `${d}.${m}.${y}`;
    };
  }

  if (priceInput) {
    priceInput.addEventListener("input", function () {
      applyPriceFormat(this);
    });
  }

  if (componentInput) {
    componentInput.addEventListener("input", () => {
      if (saveBtn) saveBtn.classList.toggle("visible", !!componentInput.value.trim());
    });
  }

  if (vendorInput && componentInput) {
    vendorInput.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.shiftKey && componentInput.value.trim()) {
        e.preventDefault();
        submitNewItem(tr);
      }
    });
  }

  tr.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && componentInput?.value.trim()) submitNewItem(tr);
  });

  if (saveBtn) saveBtn.onclick = () => submitNewItem(tr);

  setTimeout(() => componentInput?.focus(), 30);
  return tr;
}

function submitNewItem(tr: HTMLTableRowElement): void {
  const dateInput = tr.querySelector(".date-input") as HTMLInputElement | null;
  const componentInput = tr.querySelector(".component-input") as HTMLInputElement | null;
  const brandInput = tr.querySelector(".brand-input") as HTMLInputElement | null;
  const specsInput = tr.querySelector(".specs-input") as HTMLInputElement | null;
  const priceInput = tr.querySelector(".price-input") as HTMLInputElement | null;
  const vendorInput = tr.querySelector(".vendor-input") as HTMLInputElement | null;

  const component = componentInput?.value.trim();
  if (!component) return;

  const finalDate = parseDateInput(dateInput?.value || "");
  const rawPrice = parsePriceInput(priceInput?.value || "");

  const newItemData = {
    date: finalDate,
    component,
    brand: brandInput?.value.trim() || "-",
    specs: specsInput?.value.trim() || "-",
    price: rawPrice,
    vendor: vendorInput?.value.trim() || "-",
    status: "sağlıklı",
    url: "",
  };

  addComponentToFirebase(newItemData)
    .then(() => {
      tr.remove();
      showToast(`"${component}" eklendi`, "success");
    })
    .catch(() => showToast("Kayıt eklenemedi", "error"));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     OLAY DİNLEYİCİLERİ VE BAŞLATMA                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sıralama Başlıkları ─────────────────── */

document.querySelectorAll(".sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const col = (th as HTMLElement).dataset.sort || (th as HTMLElement).dataset.col;
    if (!col) return;

    if (currentSort.col === col) {
      (currentSort as any).dir = currentSort.dir === "asc" ? "desc" : "asc";
    } else {
      (currentSort as any).col = col;
      (currentSort as any).dir = "asc";
    }

    updateSortIcons();
    renderAll();
  });
});

/* ─────────────────── Kayıt Ekle Butonu ─────────────────── */

if (addItemBtn) {
  addItemBtn.onclick = () => {
    if (!tableBody) return;
    const existing = tableBody.querySelector(".new-item-row");
    if (existing) {
      (existing.querySelector(".component-input") as HTMLElement)?.focus();
      return;
    }
    tableBody.appendChild(initiateAddRow());
  };
}

/* ─────────────────── Escape ile Yeni Satırı Kapat ─────────────────── */

document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    (!editModal || !editModal.classList.contains("active"))
  ) {
    if (tableBody) {
      const newRow = tableBody.querySelector(".new-item-row");
      if (newRow) newRow.remove();
    }
  }
});

/* ─────────────────── Tablo Gövdesi Olay Delegasyonu ─────────────────── */

function initTableBodyEvents(): void {
  if (!tableBody) return;

  tableBody.addEventListener("click", function (e) {
    const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete-item") deleteItem(id!);
    else if (action === "edit-item") openEditModal(id!);
    else if (action === "update-status")
      updateItemStatus(id!, btn.dataset.status!);
  });

  tableBody.addEventListener("dblclick", function (e) {
    const tr = (e.target as HTMLElement).closest("tr[data-id]") as HTMLTableRowElement | null;
    if (!tr) return;
    if ((e.target as HTMLElement).closest(".status-menu") || (e.target as HTMLElement).closest(".row-actions"))
      return;

    const id = tr.dataset.id;
    const targetCell = (e.target as HTMLElement).closest("td") as HTMLElement | null;
    let focusTarget = "component";

    if (targetCell) {
      if (targetCell.classList.contains("col-date")) focusTarget = "date";
      else if (targetCell.classList.contains("col-specs"))
        focusTarget = "brand";
      else if (targetCell.classList.contains("col-price"))
        focusTarget = "price";
      else if (targetCell.classList.contains("col-vendor"))
        focusTarget = "vendor";
    }

    window.getSelection()?.removeAllRanges();
    openEditModal(id!, focusTarget);
  });
}

/* ─────────────────── Başlatma ─────────────────── */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTableBodyEvents);
} else {
  initTableBodyEvents();
}
