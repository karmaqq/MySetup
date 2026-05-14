/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         TABLO RENDER MOTORU                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sabitler ─────────────────── */

const VSCROLL_INITIAL = 40;

import {
  allData,
  currentSearch,
  currentStatusFilter,
  currentSort,
  STATUS_MAP,
  mainScroll,
  tableBody,
} from "./app-state";
import {
  normalizeTr,
  DATE_FORMAT,
  CURRENCY_FORMAT,
  escHtml,
  escAttr,
} from "./global-ut";
import { scheduleRender } from "./global-fn";
import {
  updateStats,
  updateResultCount,
} from "./toolbar";

let _vsRafId: number | null = null;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FİLTRELEME VE SIRALAMA                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Filtrelenmiş Sıralı Liste ─────────────────── */

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

/* ─────────────────── Sıralama İkonları ─────────────────── */

export function updateSortIcons(): void {
  document.querySelectorAll(".sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon") as HTMLElement | null;
    const col =
      (th as HTMLElement).dataset.sort || (th as HTMLElement).dataset.col;

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

/* ─────────────────── Durum Hücresi ─────────────────── */

export function buildStatusCellContent(item: any): string {
  const statusClass = getStatusClassName(item.status);
  const safeId = escAttr(item.id);
  const safeStatus = escHtml(item.status);
  return `<div class="status-cell-inner">
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
  </div>`;
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
  return (
    `
    <td class="col-date">${DATE_FORMAT(item.date)}</td>
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-specs">${buildCombinedSpecsCellHTML(item)}</td>
    <td class="col-price">` +
    CURRENCY_FORMAT.format(item.price) +
    ` ₺</td>
    <td class="col-vendor">${escHtml(item.vendor)}</td>
    <td class="status-cell">${buildStatusCellContent(item)}</td>
  `
  );
}

function buildGroupRowHTML(
  item: any,
  dateCell: string,
  vendorCell: string,
): string {
  return (
    `
    ${dateCell}
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-specs">${buildCombinedSpecsCellHTML(item)}</td>
    <td class="col-price">` +
    CURRENCY_FORMAT.format(item.price) +
    ` ₺</td>
    ${vendorCell}
    <td class="status-cell">${buildStatusCellContent(item)}</td>
  `
  );
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

let _cachedFilteredList: any[] | null = null;
let _cacheInvalidated = true;

export function invalidateFilterCache(): void {
  _cacheInvalidated = true;
}

export function getCachedFilteredList(): any[] {
  if (_cacheInvalidated || !_cachedFilteredList) {
    _cachedFilteredList = getFilteredSortedList();
    _cacheInvalidated = false;
  }
  return _cachedFilteredList;
}

export function renderAll(): void {
  (window as any).renderAll = renderAll;
  const scrollY = mainScroll ? mainScroll.scrollTop : 0;
  invalidateFilterCache();
  const list = getCachedFilteredList();
  updateStats(list);
  renderTableRows(list, scrollY);
  updateResultCount(list.length);
}

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         SATIR EKLEME / SİLME                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Satır Ekle veya Güncelle ─────────────────── */

export function addOrUpdateTableRow(id: string, item: any, oldItem?: any): void {
  if (currentSort.col === "date") {
    scheduleRender();
    return;
  }

  const visible = isItemVisible(item);
  const row = tableBody!.querySelector(
    `tr[data-id="${id}"]`,
  ) as HTMLTableRowElement | null;
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

/* ─────────────────── Satır Sil ─────────────────── */

export function removeTableRow(id: string): void {
  const row = tableBody!.querySelector(`tr[data-id="${id}"]`);
  if (row) {
    const prev = row.previousElementSibling;
    if (prev && prev.classList.contains("group-separator")) {
      prev.remove();
    }
    row.remove();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     OLAY DİNLEYİCİLERİ VE BAŞLATMA                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sıralama Başlıkları ─────────────────── */

document.querySelectorAll(".sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const col =
      (th as HTMLElement).dataset.sort || (th as HTMLElement).dataset.col;
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


