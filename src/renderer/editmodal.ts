/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       DÜZENLEME MODALI YÖNETİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  allData,
  editingId,
  setEditingId,
  escAttr,
  safeExternalUrl,
  parseDateInput,
  parsePriceInput,
  applyPriceFormat,
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
} from "./utils";
import {
  uploadImageToFirebase,
  updateComponentInFirebase,
} from "./firebase-inv";
import { showToast, showConfirm } from "./io";
import { getFilteredSortedList } from "./table";

/* ─────────────────── Global Durum Değişkenleri ─────────────────── */

let _resetRafId: number | null = null;
let currentRating = 0;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÖRSEL YÖNETİMİ                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function applyAdaptiveSize(
  imgEl: HTMLImageElement,
  imagePreview: HTMLElement,
): void {
  const MIN_W = 180,
    MIN_H = 140,
    MAX_W = 340,
    MAX_H = 260;
  const nw = imgEl.naturalWidth || 1;
  const nh = imgEl.naturalHeight || 1;
  const ratio = nw / nh;
  let w: number, h: number;

  if (ratio >= 1) {
    w = MAX_W;
    h = Math.round(w / ratio);
    if (h < MIN_H) {
      h = MIN_H;
      w = Math.round(h * ratio);
    }
    if (w > MAX_W) {
      w = MAX_W;
      h = Math.round(w / ratio);
    }
  } else {
    h = MAX_H;
    w = Math.round(h * ratio);
    if (w < MIN_W) {
      w = MIN_W;
      h = Math.round(w / ratio);
    }
    if (h > MAX_H) {
      h = MAX_H;
      w = Math.round(h * ratio);
    }
  }

  w = Math.max(MIN_W, Math.min(MAX_W, w));
  h = Math.max(MIN_H, Math.min(MAX_H, h));
  imagePreview.style.width = w + "px";
  imagePreview.style.height = h + "px";
}

function refreshPreview(
  url: string,
  imagePreview: HTMLElement,
  imageUploadBtn: HTMLElement | null,
): void {
  if (url) {
    imagePreview.innerHTML = `
      <img src="${escAttr(url)}" alt="Ürün görseli" id="editImagePreviewImg" />
      <button class="preview-delete-btn" id="previewDeleteBtn" title="Görseli sil">✕</button>`;
    imagePreview.classList.remove("hidden");
    if (imageUploadBtn) imageUploadBtn.classList.add("has-image");

    const imgEl = document.getElementById(
      "editImagePreviewImg",
    ) as HTMLImageElement | null;
    if (imgEl) {
      imgEl.addEventListener(
        "load",
        () => applyAdaptiveSize(imgEl, imagePreview),
        { once: true },
      );
      if (imgEl.complete) applyAdaptiveSize(imgEl, imagePreview);
    }

    document.getElementById("previewDeleteBtn")!.onclick = () => {
      const idToDelete = editingId;
      if (!idToDelete) return;
      showConfirm("Görsel kalıcı olarak silinsin mi?", async () => {
        try {
          const user = firebase.auth().currentUser;
          if (user) {
            const ref = firebase
              .storage()
              .ref(`users/${user.uid}/components/${idToDelete}/image`);
            await ref.delete().catch(() => {});
          }
          await updateComponentInFirebase(idToDelete, { imageUrl: "" });
          if (allData[idToDelete]) allData[idToDelete].imageUrl = "";
          if (editingId === idToDelete)
            refreshPreview("", imagePreview, imageUploadBtn);
          showToast("Görsel silindi", "success");
        } catch (_) {
          showToast("Görsel silinemedi", "error");
        }
      });
    };
  } else {
    imagePreview.innerHTML = "";
    imagePreview.classList.add("hidden");
    if (imageUploadBtn) imageUploadBtn.classList.remove("has-image");
  }
}

function handleImageFile(
  file: File,
  imagePreview: HTMLElement,
  id: string,
  imageUploadBtn: HTMLElement | null,
): void {
  if (!file || !file.type.startsWith("image/")) return;
  imagePreview.classList.remove("hidden");
  imagePreview.style.width = "200px";
  imagePreview.style.height = "160px";
  imagePreview.innerHTML = `
    <div class="preview-loading">
      <p class="preview-loading-brand">My<span class="accent-text">SETUP</span></p>
      <div class="preview-spinner"></div>
    </div>`;

  uploadImageToFirebase(file, id)
    .then((url) => {
      updateComponentInFirebase(id, { imageUrl: url }).then(() => {
        if (allData[id]) allData[id].imageUrl = url;
        refreshPreview(url, imagePreview, imageUploadBtn);
      });
    })
    .catch(() => {
      imagePreview.classList.add("hidden");
      showToast("Yükleme başarısız", "error");
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAYÜZ YARDIMCILARI                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

function _resetPreviewInstant(): void {
  const imagePreview = document.getElementById(
    "editImagePreview",
  ) as HTMLElement | null;
  if (!imagePreview) return;

  if (_resetRafId !== null) {
    cancelAnimationFrame(_resetRafId);
    _resetRafId = null;
  }

  imagePreview.style.transition = "none";
  imagePreview.style.width = "200px";
  imagePreview.style.height = "160px";
  imagePreview.innerHTML = "";
  imagePreview.classList.add("hidden");

  _resetRafId = requestAnimationFrame(() => {
    _resetRafId = requestAnimationFrame(() => {
      imagePreview!.style.transition = "";
      _resetRafId = null;
    });
  });
}

function updateStars(rating: number): void {
  const stars = document.querySelectorAll("#editStarRating .star");
  stars.forEach((s) => {
    (s as HTMLElement).classList.toggle(
      "active",
      parseInt((s as HTMLElement).dataset.value!) <= rating,
    );
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          MODAL YÖNETİMİ                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

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

export function closeEditModal(): void {
  if (editModal) editModal.classList.remove("active");
  setEditingId(null);
  if ((window as any)._flushPendingRender) {
    (window as any)._flushPendingRender();
  }
}

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
