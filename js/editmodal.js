/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       DÜZENLEME MODALI YÖNETİMİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Global Değişkenler ─────────────────── */

let _resetRafId = null;
let currentRating = 0;

/* ─────────────────── Görsel Boyutlandırma ─────────────────── */

function applyAdaptiveSize(imgEl, imagePreview) {
  const MIN_W = 180,
    MIN_H = 140,
    MAX_W = 340,
    MAX_H = 260;
  const nw = imgEl.naturalWidth || 1;
  const nh = imgEl.naturalHeight || 1;
  const ratio = nw / nh;
  let w, h;
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

function refreshPreview(url, imagePreview, imageUploadBtn) {
  if (url) {
    imagePreview.innerHTML = `
      <img src="${url}" alt="Ürün görseli" id="editImagePreviewImg" />
      <button class="preview-delete-btn" id="previewDeleteBtn" title="Görseli sil">✕</button>`;
    imagePreview.classList.remove("hidden");
    if (imageUploadBtn) imageUploadBtn.classList.add("has-image");
    const imgEl = document.getElementById("editImagePreviewImg");
    if (imgEl) {
      imgEl.onload = () => applyAdaptiveSize(imgEl, imagePreview);
      if (imgEl.complete) applyAdaptiveSize(imgEl, imagePreview);
    }
    document.getElementById("previewDeleteBtn").onclick = () => {
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
          if (typeof renderAll === "function") renderAll();
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

function handleImageFile(file, imagePreview, id, imageUploadBtn) {
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
        if (typeof renderAll === "function") renderAll();
      });
    })
    .catch(() => {
      imagePreview.classList.add("hidden");
      if (typeof showToast === "function")
        showToast("Yükleme başarısız", "error");
    });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* YARDIMCI FONKSİYONLAR                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Önizlemeyi Anında Sıfırla ─────────────────── */

function _resetPreviewInstant() {
  const imagePreview = document.getElementById("editImagePreview");
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
      imagePreview.style.transition = "";
      _resetRafId = null;
    });
  });
}

/* ─────────────────── Yıldız Arayüzünü Güncelle ─────────────────── */

function updateStars(rating) {
  const stars = document.querySelectorAll("#editStarRating .star");
  if (!stars) return;
  stars.forEach((s) => {
    s.classList.toggle("active", parseInt(s.dataset.value) <= rating);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MODAL YÖNETİMİ                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Düzenleme Modalını Aç ─────────────────── */

window.openEditModal = function (id, focusTarget = "component") {
  const item = allData[id];
  if (!item) return;

  _resetPreviewInstant();

  editingId = id;

  const parts = (item.date || "").split("-");
  if (editDate) {
    editDate.value =
      parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : "";
  }
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

  const opinionInput = document.getElementById("editOpinionText");
  if (opinionInput) opinionInput.value = item.opinion || "";

  if (editModal) {
    editModal.classList.add("active");
  }

  setTimeout(() => {
    const imagePreview = document.getElementById("editImagePreview");
    const imageUploadBtn = document.getElementById("imageUploadBtn");
    const imageFileInput = document.getElementById("imageFileInput");

    refreshPreview(item.imageUrl || "", imagePreview, imageUploadBtn);

    if (imageUploadBtn && !imageUploadBtn._eventsBound) {
      imageUploadBtn.onclick = () => imageFileInput && imageFileInput.click();
      imageUploadBtn._eventsBound = true;
    }
    if (imageFileInput && !imageFileInput._eventsBound) {
      imageFileInput.value = "";
      imageFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file, imagePreview, id, imageUploadBtn);
      };
      imageFileInput._eventsBound = true;
    }

    switch (focusTarget) {
      case "date":
        if (editDate) editDate.focus();
        break;
      case "brand":
        if (editBrand) editBrand.focus();
        break;
      case "specs":
        if (editSpecs) editSpecs.focus();
        break;
      case "price":
        if (editPrice) editPrice.focus();
        break;
      case "vendor":
        if (editVendor) editVendor.focus();
        break;
      default:
        if (editComponent) editComponent.focus();
    }
  }, 80);
};

/* ─────────────────── Düzenleme Modalını Kapat ─────────────────── */

window.closeEditModal = function () {
  if (editModal) {
    editModal.classList.remove("active");
  }
  editingId = null;
};

/* ─────────────────── Düzenleme Kaydını Kaydet ─────────────────── */

window.saveEditModal = function () {
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
  const opinionInput = document.getElementById("editOpinionText");

  const itemData = {
    date: finalDate,
    component,
    brand: editBrand.value.trim() || "-",
    specs: editSpecs.value.trim() || "-",
    price: parseFloat(rawEditPrice) || 0,
    vendor: editVendor.value.trim() || "-",
    status: editStatus.value,
    url: editUrl.value.trim(),
    star: currentRating,
    opinion: opinionInput ? opinionInput.value.trim() : "",
  };

  updateComponentInFirebase(editingId, itemData)
    .then(() => {
      showToast("Kayıt güncellendi", "success");
      closeEditModal();
    })
    .catch(() => showToast("Güncelleme başarısız", "error"));
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MODAL OLAY DİNLEYİCİLERİ                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modal Kapat / Kaydet Butonları ─────────────────── */

if (modalClose) modalClose.onclick = closeEditModal;
if (modalCancel) modalCancel.onclick = closeEditModal;
if (modalSave) modalSave.onclick = saveEditModal;

/* ─────────────────── Modal Dış Tıklama ile Kapatma ─────────────────── */

if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

/* ─────────────────── Takvim İkonu Tarih Seçici ─────────────────── */

if (editCalIcon && editDatePicker) {
  editCalIcon.onclick = () => editDatePicker.showPicker();

  editDatePicker.onchange = (e) => {
    const [y, m, d] = e.target.value.split("-");
    if (editDate) editDate.value = `${d}.${m}.${y}`;
  };
}

/* ─────────────────── Modal Fiyat Formatlama ─────────────────── */

if (editPrice) {
  editPrice.addEventListener("input", function () {
    if (typeof applyPriceFormat === "function") applyPriceFormat(this);
  });
}

/* ─────────────────── Yıldız Tıklama Delegasyonu ─────────────────── */

const editStarRating = document.getElementById("editStarRating");
if (editStarRating) {
  editStarRating.addEventListener("click", (e) => {
    if (e.target.classList.contains("star")) {
      currentRating = parseInt(e.target.dataset.value);
      updateStars(currentRating);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MODAL KLAVYE KISAYOLLARI                           */
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

    if (!editingId || typeof getFilteredSortedList !== "function") return;

    const list = getFilteredSortedList();
    const currentIdx = list.findIndex((item) => item.id === editingId);
    if (currentIdx === -1) {
      showToast("Kayıt listesi henüz yüklenmedi", "warn");
      return;
    }

    let targetIdx;
    if (isNext) {
      targetIdx = currentIdx + 1;
      if (targetIdx >= list.length) targetIdx = 0;
    } else {
      targetIdx = currentIdx - 1;
      if (targetIdx < 0) targetIdx = list.length - 1;
    }

    const targetItem = list[targetIdx];
    if (!targetItem) return;

    if (typeof _resetPreviewInstant === "function") _resetPreviewInstant();
    openEditModal(targetItem.id);
  }
});
