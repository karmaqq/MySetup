/* open edit modal fonksiyon basligi */

window.openEditModal = function (id, focusTarget = "component") {
  const item = allData[id];
  if (!item) return;

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

/* close edit modal fonksiyon basligi */

window.closeEditModal = function () {
  if (editModal) editModal.classList.remove("active");
  editingId = null;
};

/* save edit modal fonksiyon basligi */

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

if (modalClose) modalClose.onclick = closeEditModal;
if (modalCancel) modalCancel.onclick = closeEditModal;
if (modalSave) modalSave.onclick = saveEditModal;

if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

if (editCalIcon && editDatePicker) {
  /* onclick fonksiyon basligi */

  editCalIcon.onclick = () => editDatePicker.showPicker();

  /* onchange fonksiyon basligi */

  editDatePicker.onchange = (e) => {
    const [y, m, d] = e.target.value.split("-");
    if (editDate) editDate.value = `${d}.${m}.${y}`;
  };
}

if (editPrice) {
  editPrice.addEventListener("input", function () {
    if (typeof applyPriceFormat === "function") applyPriceFormat(this);
  });
}

if (addItemBtn) {
  /* onclick fonksiyon basligi */

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

/* initiate add row fonksiyon basligi */

function initiateAddRow() {
  const tr = document.createElement("tr");
  tr.className = "new-item-row";
  tr.innerHTML = `
    <td>
      <div class="date-input-wrapper">
        <input type="text" class="entry-input date-input" placeholder="GG.AA.YYYY">
        <input type="date" class="hidden-picker" tabindex="-1">
        <span class="calendar-icon">📅</span>
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

  /* onclick fonksiyon basligi */

  calendarIcon.onclick = () => hiddenPicker.showPicker();

  /* onchange fonksiyon basligi */

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

  /* onclick fonksiyon basligi */

  saveBtn.onclick = () => submitNewItem(tr, inputs);

  setTimeout(() => inputs[1].focus(), 30);
  return tr;
}

/* submit new item fonksiyon basligi */

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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (editModal && editModal.classList.contains("active")) {
      closeEditModal();
    } else if (tableBody) {
      const newRow = tableBody.querySelector(".new-item-row");
      if (newRow) newRow.remove();
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    if (editModal && editModal.classList.contains("active")) {
      e.preventDefault();
      saveEditModal();
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const tag = document.activeElement.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }
});
