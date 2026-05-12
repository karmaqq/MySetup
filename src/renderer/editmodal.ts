/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       DÜZENLEME MODALI YÖNETİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  allData,
  editingId,
  setEditingId,
  editModal,
  editDate,
  editDatePicker,
  editCalIcon,
  editComponent,
  editBrand,
  editSpecs,
  editUrl,
  editPrice,
  editVendor,
  editStatus,
  modalClose,
  modalCancel,
  modalSave,
} from "./app-state";
import {
  safeExternalUrl,
  parseDateInput,
  parsePriceInput,
  applyPriceFormat,
} from "./global-ut";
import { updateComponentInFirebase } from "./firebase-inv";
import { showToast, showConfirm } from "./global-fn";
import { getFilteredSortedList } from "./table";
import {
  _resetPreviewInstant,
  refreshPreview,
  handleImageFile,
  updateStars,
} from "./image-utils";

let currentRating = 0;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          MODAL YÖNETİMİ                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modal Açma ─────────────────── */

export function openEditModal(
  id: string,
  focusTarget: string = "component",
): void {
  const item = allData[id];
  if (!item) return;

  _resetPreviewInstant();
  setEditingId(id);

  const parts = (item.date || "").split("-");
  if (editDate)
    editDate.value =
      parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : "";
  if (editDatePicker) editDatePicker.value = item.date || "";
  if (editComponent) editComponent.value = item.component || "";
  if (editBrand) editBrand.value = item.brand === "-" ? "" : item.brand || "";
  if (editSpecs) editSpecs.value = item.specs === "-" ? "" : item.specs || "";
  if (editUrl) editUrl.value = item.url || "";
  if (editVendor)
    editVendor.value = item.vendor === "-" ? "" : item.vendor || "";
  if (editStatus) editStatus.value = item.status || "sağlıklı";

  if (editPrice) {
    let dPrice = (item.price || 0).toString().replace(".", ",");
    let [iPart, dPart] = dPrice.split(",");
    if (iPart) iPart = iPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    editPrice.value =
      dPart !== undefined ? `${iPart},${dPart}` : item.price ? iPart : "";
  }

  currentRating = item.star || 0;
  updateStars(currentRating);

  const opinionInput = document.getElementById(
    "editOpinionText",
  ) as HTMLTextAreaElement | null;
  if (opinionInput) opinionInput.value = item.opinion || "";

  if (editModal) editModal.classList.add("active");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const imagePreview = document.getElementById(
        "editImagePreview",
      ) as HTMLElement | null;
      const imageUploadBtn = document.getElementById(
        "imageUploadBtn",
      ) as HTMLElement | null;
      const imageFileInput = document.getElementById(
        "imageFileInput",
      ) as HTMLInputElement | null;

      refreshPreview(item.imageUrl || "", imagePreview!, imageUploadBtn);

      if (imageUploadBtn)
        imageUploadBtn.onclick = () => imageFileInput && imageFileInput.click();
      if (imageFileInput) {
        imageFileInput.value = "";
        imageFileInput.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file)
            handleImageFile(file, imagePreview!, editingId!, imageUploadBtn);
        };
      }

      const el =
        focusTarget === "date"
          ? editDate
          : focusTarget === "brand"
            ? editBrand
            : focusTarget === "specs"
              ? editSpecs
              : focusTarget === "price"
                ? editPrice
                : focusTarget === "vendor"
                  ? editVendor
                  : editComponent;
      if (el) el.focus();
    });
  });
}

/* ─────────────────── Modal Kapatma ─────────────────── */

export function closeEditModal(): void {
  if (editModal) editModal.classList.remove("active");
  setEditingId(null);
}

/* ─────────────────── Modal Kaydetme ─────────────────── */

export function saveEditModal(): void {
  if (!editingId) return;

  const component = editComponent!.value.trim();
  if (!component) {
    showToast("Bileşen adı zorunludur", "error");
    editComponent!.focus();
    return;
  }

  const finalDate = parseDateInput(editDate!.value);
  const rawEditPrice = parsePriceInput(editPrice!.value);
  const opinionInput = document.getElementById(
    "editOpinionText",
  ) as HTMLTextAreaElement | null;

  const itemData = {
    date: finalDate,
    component,
    brand: editBrand!.value.trim() || "-",
    specs: editSpecs!.value.trim() || "-",
    price: rawEditPrice,
    vendor: editVendor!.value.trim() || "-",
    status: editStatus!.value,
    url: safeExternalUrl(editUrl!.value.trim()),
    star: currentRating,
    opinion: opinionInput ? opinionInput.value.trim() : "",
  };

  updateComponentInFirebase(editingId, itemData)
    .then(() => {
      showToast("Kayıt güncellendi", "success");
      closeEditModal();
    })
    .catch(() => showToast("Güncelleme başarısız", "error"));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          MODAL OLAY DİNLEYİCİLERİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

if (modalClose) modalClose.onclick = closeEditModal;
if (modalCancel) modalCancel.onclick = closeEditModal;
if (modalSave) modalSave.onclick = saveEditModal;

if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

if (editCalIcon && editDatePicker) {
  editCalIcon.onclick = () => editDatePicker!.showPicker();
  editDatePicker.onchange = (e) => {
    const [y, m, d] = (e.target as HTMLInputElement).value.split("-");
    if (editDate) editDate.value = `${d}.${m}.${y}`;
  };
}

if (editPrice) {
  editPrice.addEventListener("input", function () {
    applyPriceFormat(this);
  });
}

const editStarRating = document.getElementById(
  "editStarRating",
) as HTMLElement | null;
if (editStarRating) {
  editStarRating.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("star")) {
      currentRating = parseInt((e.target as HTMLElement).dataset.value!);
      updateStars(currentRating);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          MODAL KLAVYE KISAYOLLARI                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener("keydown", (e) => {
  if (!editModal || !editModal.classList.contains("active")) return;

  if (e.key === "Escape") {
    closeEditModal();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    saveEditModal();
    return;
  }

  if (e.shiftKey) {
    const isNext = e.key === "ArrowRight" || e.key === "ArrowUp";
    const isPrev = e.key === "ArrowLeft" || e.key === "ArrowDown";
    if (!isNext && !isPrev) return;

    e.preventDefault();
    if (!editingId) return;

    const list = getFilteredSortedList();
    const currentIdx = list.findIndex((item: any) => item.id === editingId);
    if (currentIdx === -1) {
      showToast("Kayıt listesi henüz yüklenmedi", "warn");
      return;
    }

    let targetIdx = isNext
      ? (currentIdx + 1) % list.length
      : (currentIdx - 1 + list.length) % list.length;

    const targetItem = list[targetIdx];
    if (!targetItem) return;

    _resetPreviewInstant();
    openEditModal(targetItem.id);
  }
});
