/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          DÜZENLEME MODALI                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Önizlemeyi Anında Sıfırla (geçiş için) ─────────────────── */

let _resetRafId = null;

function _resetPreviewInstant() {
  const imagePreview = document.getElementById("editImagePreview");
  if (!imagePreview) return;

  // Önceki rAF zinciri henüz bitmemişse iptal et
  if (_resetRafId !== null) {
    cancelAnimationFrame(_resetRafId);
    _resetRafId = null;
  }

  imagePreview.style.transition = "none";
  imagePreview.style.width = "200px";
  imagePreview.style.height = "160px";
  imagePreview.innerHTML = "";
  imagePreview.classList.add("hidden");

  // Transition'ı iki frame sonra geri aç — tek rAF yeterli değil,
  // style değişikliği aynı frame'de flush olmadan geri açılabilir
  _resetRafId = requestAnimationFrame(() => {
    _resetRafId = requestAnimationFrame(() => {
      imagePreview.style.transition = "";
      _resetRafId = null;
    });
  });
}

/* ─────────────────── Düzenleme Modalını Aç ─────────────────── */

window.openEditModal = function (id, focusTarget = "component") {
  const item = allData[id];
  if (!item) return;

  // Geçiş yapılıyorsa önizlemeyi anında sıfırla (önceki görsel boyutu görünmesin)
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

  if (editModal) editModal.classList.add("active");

  setTimeout(() => {
    // ── Görsel önizleme elemanları ──
    const imagePreview = document.getElementById("editImagePreview");
    const imageUploadBtn = document.getElementById("imageUploadBtn");
    const imageFileInput = document.getElementById("imageFileInput");

    /* Görselin gerçek en/boy oranına göre önizleme boyutunu hesapla */
    const MIN_W = 180,
      MIN_H = 140,
      MAX_W = 340,
      MAX_H = 260;

    function applyAdaptiveSize(imgEl) {
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

    /* Önizlemeyi güncelle */
    function refreshPreview(url) {
      if (url) {
        const img = new Image();
        img.onload = () => applyAdaptiveSize(img);
        img.src = url;

        imagePreview.innerHTML = `
          <img src="${url}" alt="Ürün görseli" />
          <button class="preview-delete-btn" id="previewDeleteBtn" title="Görseli sil">✕</button>`;
        imagePreview.classList.remove("hidden");

        if (imageUploadBtn) imageUploadBtn.classList.add("has-image");

        document.getElementById("previewDeleteBtn").onclick = () => {
          // Tıklandığı andaki editingId'yi sabitle —
          // onay diyaloğu beklerken modal geçişi olursa yanlış ürün silinmez
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
              // Hâlâ aynı ürünün modalındaysak önizlemeyi temizle
              if (editingId === idToDelete) refreshPreview("");
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

    // İlk yükleme
    refreshPreview(item.imageUrl || "");

    /* Dosyayı yükle ve önizle */
    function handleImageFile(file) {
      if (!file || !file.type.startsWith("image/")) return;
      // Önizlemeyi göster, mini loading ekranını yerleştir
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
            refreshPreview(url);
            if (typeof renderAll === "function") renderAll();
          });
        })
        .catch(() => {
          imagePreview.innerHTML =
            '<span style="color:var(--red);padding:8px;font-size:12px">Yükleme başarısız</span>';
        });
    }

    // Dosya seçici butonu
    if (imageUploadBtn && imageFileInput) {
      imageUploadBtn.onclick = () => imageFileInput.click();
      imageFileInput.value = "";
    }
    if (imageFileInput) {
      imageFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file);
      };
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
  if (editModal) editModal.classList.remove("active");
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

  const itemData = {
    date: finalDate,
    component,
    brand: editBrand.value.trim() || "-",
    specs: editSpecs.value.trim() || "-",
    price: parseFloat(rawEditPrice) || 0,
    vendor: editVendor.value.trim() || "-",
    status: editStatus.value,
    url: editUrl.value.trim(),
  };

  updateComponentInFirebase(editingId, itemData)
    .then(() => {
      showToast("Kayıt güncellendi", "success");
      closeEditModal();
    })
    .catch(() => showToast("Güncelleme başarısız", "error"));
};

/* ─────────────────── Modal Kapat Butonları ─────────────────── */

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

/* ─────────────────── Ürün Ekle Butonu ─────────────────── */

if (addItemBtn) {
  addItemBtn.onclick = () => {
    if (!tableBody) return;
    const existing = tableBody.querySelector(".new-item-row");
    if (existing) {
      existing.querySelector(".component-input").focus();
      return;
    }
    tableBody.appendChild(initiateAddRow());
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YENİ KAYIT SATIRI                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

function initiateAddRow() {
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
    <td><input type="text" class="entry-input brand-input" placeholder="Marka"></td>
    <td><input type="text" class="entry-input specs-input" placeholder="Özellikler"></td>
    <td><input type="text" class="entry-input price-input" placeholder="0,00" inputmode="decimal"></td>
    <td><input type="text" class="entry-input vendor-input" placeholder="Satıcı"></td>
    <td style="text-align: center;">
      <button type="button" class="btn-modal-save save-btn new-row-save">Kaydet</button>
    </td>
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
    if (typeof applyPriceFormat === "function") applyPriceFormat(this);
  });

  inputs[1].addEventListener("input", () => {
    saveBtn.classList.toggle("visible", !!inputs[1].value.trim());
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

/* ─────────────────── Yeni Kayıt Gönderme ─────────────────── */

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

  const newItemData = {
    date: finalDate,
    component,
    brand: inputs[2].value.trim() || "-",
    specs: inputs[3].value.trim() || "-",
    price: parseFloat(rawPrice) || 0,
    vendor: inputs[5].value.trim() || "-",
    status: "sağlıklı",
    url: "",
  };

  if (typeof addComponentToFirebase === "function") {
    addComponentToFirebase(newItemData)
      .then(() => {
        tr.remove();
        showToast(`"${component}" eklendi`, "success");
      })
      .catch(() => showToast("Kayıt eklenemedi", "error"));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          KLAVYE KISAYOLLARI                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener("keydown", (e) => {
  /* ── Escape: modalı kapat ya da yeni satırı iptal et ── */
  if (e.key === "Escape") {
    if (editModal && editModal.classList.contains("active")) {
      closeEditModal();
    } else if (tableBody) {
      const newRow = tableBody.querySelector(".new-item-row");
      if (newRow) newRow.remove();
    }
    return;
  }

  /* ── Ctrl/Cmd+Enter: modalı kaydet ── */
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    if (editModal && editModal.classList.contains("active")) {
      e.preventDefault();
      saveEditModal();
    }
    return;
  }

  /* ── Ctrl/Cmd+F: aramaya odaklan ── */
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const tag = document.activeElement.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
    return;
  }

  /* ── Shift + Yön tuşları: modal açıkken listede gezin ──
     Shift+Sağ / Shift+Yukarı  → listedeki bir sonraki öğeye geç
     Shift+Sol / Shift+Aşağı   → listedeki bir önceki öğeye geç
     Input odaklanmış olsa bile Shift zorunlu olduğu için çakışma olmaz.
  */
  if (editModal && editModal.classList.contains("active") && e.shiftKey) {
    const isNext = e.key === "ArrowRight" || e.key === "ArrowUp";
    const isPrev = e.key === "ArrowLeft" || e.key === "ArrowDown";

    if (!isNext && !isPrev) return;

    e.preventDefault(); // Shift+yön'ün metin seçme davranışını engelle

    if (!editingId || typeof getFilteredSortedList !== "function") return;

    const list = getFilteredSortedList();
    const currentIdx = list.findIndex((item) => item.id === editingId);
    if (currentIdx === -1) return;

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

    _resetPreviewInstant();
    openEditModal(targetItem.id);
  }
});
