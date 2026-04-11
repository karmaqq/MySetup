/* ─── EDIT MODAL ─────────────────────────────────────────────────────────────── */
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

/* ─── YENİ ÜRÜN EKLEME ───────────────────────────────────────────────────────── */
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
    applyPriceFormat(this);
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

/* ─── KLAVYE KISAYOLLARI ─────────────────────────────────────────────────────── */
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
