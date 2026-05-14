/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          TABLO CRUD İŞLEMLERİ                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allData, tableBody, editModal, addItemBtn } from "./app-state";
import { normalizeTr, applyPriceFormat, parseDateInput, parsePriceInput } from "./global-ut";
import { showToast, showConfirm } from "./global-fn";
import {
  addComponentToFirebase,
  deleteComponentFromFirebase,
  updateComponentStatusInFirebase,
} from "./firebase-inv";
import { openEditModal } from "./editmodal";
import { updateStats, rebuildStatsCache, updateStatsCacheOnChange } from "./toolbar";
import { buildStatusCellContent, getCachedFilteredList, invalidateFilterCache } from "./table";

/* ─────────────────── Durum Güncelleme ─────────────────── */

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
      newCell.innerHTML = buildStatusCellContent(
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
      invalidateFilterCache();
      updateStats(getCachedFilteredList());
      applyToDOM();
      showToast("Durum güncellenemedi", "error");
    });
}

/* ─────────────────── Kayıt Silme ─────────────────── */

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
  const hiddenPicker = tr.querySelector(
    ".hidden-picker",
  ) as HTMLInputElement | null;
  const calendarIcon = tr.querySelector(".calendar-icon") as HTMLElement | null;
  const componentInput = tr.querySelector(
    ".component-input",
  ) as HTMLInputElement | null;
  const brandInput = tr.querySelector(
    ".brand-input",
  ) as HTMLInputElement | null;
  const specsInput = tr.querySelector(
    ".specs-input",
  ) as HTMLInputElement | null;
  const priceInput = tr.querySelector(
    ".price-input",
  ) as HTMLInputElement | null;
  const vendorInput = tr.querySelector(
    ".vendor-input",
  ) as HTMLInputElement | null;
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
      if (saveBtn)
        saveBtn.classList.toggle("visible", !!componentInput.value.trim());
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
  const componentInput = tr.querySelector(
    ".component-input",
  ) as HTMLInputElement | null;
  const brandInput = tr.querySelector(
    ".brand-input",
  ) as HTMLInputElement | null;
  const specsInput = tr.querySelector(
    ".specs-input",
  ) as HTMLInputElement | null;
  const priceInput = tr.querySelector(
    ".price-input",
  ) as HTMLInputElement | null;
  const vendorInput = tr.querySelector(
    ".vendor-input",
  ) as HTMLInputElement | null;

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
    const btn = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement | null;
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete-item") deleteItem(id!);
    else if (action === "edit-item") openEditModal(id!);
    else if (action === "update-status")
      updateItemStatus(id!, btn.dataset.status!);
  });

  tableBody.addEventListener("dblclick", function (e) {
    const tr = (e.target as HTMLElement).closest(
      "tr[data-id]",
    ) as HTMLTableRowElement | null;
    if (!tr) return;
    if (
      (e.target as HTMLElement).closest(".status-menu") ||
      (e.target as HTMLElement).closest(".row-actions")
    )
      return;

    const id = tr.dataset.id;
    const targetCell = (e.target as HTMLElement).closest(
      "td",
    ) as HTMLElement | null;
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTableBodyEvents);
} else {
  initTableBodyEvents();
}
