/* ═══════════════════════════════════════════════════════════════════════════ */
/* DEĞİŞKENLER VE DURUM KONTROL                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Render Durum Değişkenleri ─────────────────── */
let _pendingRender = false;

/* ─────────────────── Modal Açık Kontrolü ─────────────────── */
function isAnyModalOpen() {
  return !!document.querySelector(".modal-overlay.active");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* FİLTRELEME VE SIRALAMA                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Filtrelenmiş ve Sıralanmış Liste ─────────────────── */
function getFilteredSortedList() {
  let list = Object.keys(allData).map((id) => ({ id, ...allData[id] }));

  if (currentSearch) {
    const q = normalizeTr(currentSearch);
    list = list.filter((item) => item._searchTag.includes(q));
  }

  if (currentStatusFilter !== "all") {
    list = list.filter((item) => {
      const norm = item._statusNorm || normalizeTr(item.status);
      if (currentStatusFilter === "saglikli") return norm.includes("saglikli");
      if (currentStatusFilter === "bozuk") return norm.includes("bozuk");
      if (currentStatusFilter === "yedek") return norm.includes("yedek");
      if (currentStatusFilter === "atildi") return norm.includes("atildi");
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/* İSTATİSTİKLER VE GÜNCELLEMELER                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İstatistik Önbelleğini Güncelle (Delta) ─────────────────── */
function updateStatsCacheOnChange(item, oldItem, isRemove) {
  const newPrice = parseFloat(item.price) || 0;
  const oldPrice = oldItem ? parseFloat(oldItem.price) || 0 : 0;

  if (isRemove) {
    _statsCache.total -= oldPrice;
    _statsCache.count--;
    if (oldItem && normalizeTr(oldItem.status).includes("saglikl")) {
      _statsCache.healthy--;
    }
    if (_statsCache.mostExpId === item.id) {
      rebuildStatsCache();
    }
  } else {
    if (!oldItem) {
      _statsCache.total += newPrice;
      _statsCache.count++;
      if (normalizeTr(item.status).includes("saglikl")) {
        _statsCache.healthy++;
      }
    } else {
      const priceDiff = newPrice - oldPrice;
      if (priceDiff !== 0) {
        _statsCache.total += priceDiff;
      }
      const oldHealthy = normalizeTr(oldItem.status).includes("saglikl");
      const newHealthy = normalizeTr(item.status).includes("saglikl");
      if (!oldHealthy && newHealthy) {
        _statsCache.healthy++;
      } else if (oldHealthy && !newHealthy) {
        _statsCache.healthy--;
      }
    }
    if (newPrice > _statsCache.mostExpPrice) {
      _statsCache.mostExpPrice = newPrice;
      _statsCache.mostExpId = item.id;
    }
  }
}
function rebuildStatsCache() {
  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  for (const i of Object.values(allData)) {
    const price = parseFloat(i.price) || 0;
    _statsCache.total += price;
    _statsCache.count++;
    if (normalizeTr(i.status).includes("saglikl")) _statsCache.healthy++;
    if (price > _statsCache.mostExpPrice) {
      _statsCache.mostExpPrice = price;
      _statsCache.mostExpId = i.id;
    }
  }
}

function updateStats(filteredList) {
  if (statTotal) statTotal.textContent = CURRENCY_FORMAT.format(_statsCache.total) + " ₺";
  if (statCount) statCount.textContent = _statsCache.count;
  if (statHealthy) statHealthy.textContent = _statsCache.healthy;

  const mostExpItem = allData[_statsCache.mostExpId];
  if (statExpensive)
    statExpensive.textContent = mostExpItem ? mostExpItem.component : "—";

  let filteredTotal = 0;
  for (const i of filteredList) {
    filteredTotal += parseFloat(i.price) || 0;
  }
  if (totalCostDisplay)
    totalCostDisplay.textContent = CURRENCY_FORMAT.format(filteredTotal) + " ₺";
}

/* ─────────────────── Sonuç Sayısı Güncelleme ─────────────────── */
function updateResultCount(filteredCount) {
  const total = Object.keys(allData).length;
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  if (resultCount) {
    resultCount.textContent = isFiltered
      ? `${filteredCount} / ${total} kayıt`
      : "";
  }
}

/* ─────────────────── Sıralama İkonları Güncelleme ─────────────────── */
function updateSortIcons() {
  document.querySelectorAll(".sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    const col = th.dataset.sort || th.dataset.col;

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
/* SATIR VE HÜCRE OLUŞTURMA                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Durum CSS Sınıfı Eşleme ─────────────────── */
function getStatusClassName(statusValue) {
  const key = normalizeTr(statusValue);
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return "status-healthy";
}

/* ─────────────────── Durum Hücresi İç HTML ─────────────────── */
function buildStatusCellInnerHTML(item) {
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
      <button class="action-btn edit-btn" data-action="edit-item" data-id="${safeId}" title="Düzenle">✎</button>
      <button class="action-btn delete-btn" data-action="delete-item" data-id="${safeId}" title="Sil">✕</button>
    </div>
  </div>`;
}

/* ─────────────────── Durum Hücresi HTML Sarmalayıcı ─────────────────── */
function buildStatusCellHTML(item) {
  return `<td class="status-cell">${buildStatusCellInnerHTML(item)}</td>`;
}

/* ─────────────────── URL Simgesi Oluşturma ─────────────────── */
function buildBrandCellHTML(item) {
  const brandText = escHtml(item.brand || "-");
  if (item.url) {
    return `<div class="brand-cell-inner">
      <span class="brand-cell-text">${brandText}</span>
      <a href="${escAttr(item.url)}" target="_blank" title="Ürün Linkine Git" class="brand-url-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>`;
  }
  return brandText;
}

/* ─────────────────── Tablo Satırı HTML Şablonu ─────────────────── */

function buildRowHTML(item) {
  const formattedDate = DATE_FORMAT(item.date);
  return `
    <td class="col-date">${formattedDate}</td>
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-brand">${buildBrandCellHTML(item)}</td>
    <td class="col-specs">${escHtml(item.specs)}</td>
    <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
    <td class="col-vendor">${escHtml(item.vendor)}</td>
    ${buildStatusCellHTML(item)}
  `;
}

/* ─────────────────── Gruplamalı Satır HTML ─────────────────── */
function buildGroupRowHTML(item, dateCell, vendorCell) {
  return `
    ${dateCell}
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-brand">${buildBrandCellHTML(item)}</td>
    <td class="col-specs">${escHtml(item.specs)}</td>
    <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
    ${vendorCell}
    ${buildStatusCellHTML(item)}
  `;
}

/* ─────────────────── Tablo Satırı Oluştur ─────────────────── */
function createRowEl(item) {
  const tr = document.createElement("tr");
  tr.dataset.id = item.id;
  tr.addEventListener("dblclick", (e) => {
    window.getSelection().removeAllRanges();
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RENDER MOTORU                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Tablo Satırlarını Render Et ─────────────────── */
function renderTableRows(list) {
  const unsavedRows = Array.from(tableBody.querySelectorAll(".new-item-row"));

  const fragment = document.createDocumentFragment();

  if (!list.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="7" class="empty-cell">
        <div class="empty-state">
          <div class="empty-icon">⊘</div>
          <span>${currentSearch || currentStatusFilter !== "all" ? "Filtreyle eşleşen kayıt bulunamadı" : "Henüz kayıt yok"}</span>
        </div>
      </td>`;
    fragment.appendChild(emptyRow);
    unsavedRows.forEach((r) => fragment.appendChild(r));

    tableBody.innerHTML = "";
    tableBody.appendChild(fragment);
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
      fragment.appendChild(sep);

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
    topSep.innerHTML = `<td colspan="7"></td>`;
    fragment.appendChild(topSep);

    list.forEach((item) => {
      const tr = createRowEl(item);
      tr.innerHTML = buildRowHTML(item);
      fragment.appendChild(tr);
    });
  }

  unsavedRows.forEach((r) => fragment.appendChild(r));

  tableBody.innerHTML = "";
  tableBody.appendChild(fragment);
}

/* ─────────────────── Tüm Tabloyu Yeniden Çiz ─────────────────── */
function renderAll() {
  if (isAnyModalOpen()) {
    _pendingRender = true;
    const list = getFilteredSortedList();
    updateStats(list);
    updateResultCount(list.length);
    return;
  }

  rebuildStatsCache();

  const wrapper = document.querySelector(".table-wrapper");
  const scrollTop = wrapper ? wrapper.scrollTop : 0;
  const scrollLeft = wrapper ? wrapper.scrollLeft : 0;

  const list = getFilteredSortedList();
  updateStats(list);
  renderTableRows(list);
  updateResultCount(list.length);

  if (wrapper) {
    wrapper.scrollTop = scrollTop;
    wrapper.scrollLeft = scrollLeft;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* VERİ YÖNETİMİ VE CRUD İŞLEMLERİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Firebase Ekle/Güncelle ─────────────────── */

function addOrUpdateTableRow(id, item) {
  const useFullRender =
    currentSearch ||
    currentStatusFilter !== "all" ||
    currentSort.col === "date";

  if (useFullRender) {
    renderAll();
    return;
  }

  const row = tableBody.querySelector(`tr[data-id="${id}"]`);
  const newItem = { ...item, id };

  if (row) {
    const newRow = createRowEl(newItem);
    newRow.innerHTML = buildRowHTML(newItem);
    row.replaceWith(newRow);
  } else {
    const topSep = tableBody.querySelector(".group-separator");
    const newRow = createRowEl(newItem);
    newRow.innerHTML = buildRowHTML(newItem);
    if (topSep && topSep.nextSibling) {
      tableBody.insertBefore(newRow, topSep.nextSibling);
    } else {
      tableBody.appendChild(newRow);
    }
  }

  if (typeof updateResultCount === "function") {
    updateResultCount(Object.keys(allData).length);
  }
}

/* ─────────────────── Firebase Satır Silme ─────────────────── */

function removeTableRow(id) {
  const useFullRender =
    currentSearch ||
    currentStatusFilter !== "all" ||
    currentSort.col === "date";

  if (useFullRender) {
    renderAll();
    return;
  }

  const row = tableBody.querySelector(`tr[data-id="${id}"]`);
  if (row) row.remove();

  if (Object.keys(allData).length === 0) {
    renderAll();
    return;
  }

  if (typeof updateResultCount === "function") {
    updateResultCount(Object.keys(allData).length);
  }
}

/* ─────────────────── Sadece Durum Değişikliği Senkronu ─────────────────── */
function syncStatusOnlyChanges(prevData, nextData, changedStatusIds) {
  if (currentStatusFilter !== "all" || currentSearch) {
    renderAll();
    return;
  }

  let needsFullRender = false;

  changedStatusIds.forEach((id) => {
    const row = tableBody.querySelector(`tr[data-id="${id}"]`);
    const statusCell = row?.querySelector(".status-cell");

    if (!statusCell || !nextData[id]) {
      needsFullRender = true;
      return;
    }

    if (
      normalizeTr(prevData[id]?.status) === normalizeTr(nextData[id]?.status)
    ) {
      return;
    }

    statusCell.innerHTML = buildStatusCellInnerHTML({ id, ...nextData[id] });
  });

  if (needsFullRender) {
    renderAll();
    return;
  }

  updateStats(getFilteredSortedList());
}

/* ─────────────────── Kayıt Durumu Güncelleme ─────────────────── */
function updateItemStatus(itemId, newStatus) {
  const currentItem = allData[itemId];
  if (!currentItem) return;

  if (normalizeTr(currentItem.status) === normalizeTr(newStatus)) return;

  const prevData = allData;
  const nextData = {
    ...allData,
    [itemId]: { ...currentItem, status: newStatus },
  };

  allData = nextData;
  syncStatusOnlyChanges(prevData, nextData, [itemId]);

  if (typeof updateComponentStatusInFirebase !== "function") {
    showToast("Durum güncelleme fonksiyonu bulunamadı", "error");
    return;
  }

  updateComponentStatusInFirebase(itemId, newStatus).catch(() => {
    allData = prevData;
    syncStatusOnlyChanges(nextData, prevData, [itemId]);
    showToast("Durum güncellenemedi", "error");
  });
}

/* ─────────────────── Kayıt Silme ─────────────────── */
function deleteItem(itemId) {
  if (!allData[itemId]) {
    console.error(
      "HATA İPTAL EDİLDİ: Bu ID allData içinde bulunamadı! Aranan ID:",
      itemId,
    );
    showToast("Hata: Silinecek öğe bulunamadı!", "error");
    return;
  }

  const performDelete = () => {
    if (typeof deleteComponentFromFirebase !== "function") {
      showToast("Silme fonksiyonu bulunamadı", "error");
      return;
    }

    deleteComponentFromFirebase(itemId)
      .then(() => {
        showToast("Kayıt silindi", "success", 2200);
      })
      .catch((err) => {
        console.error("Firebase silme hatası:", err);
        showToast("Kayıt silinemedi", "error");
      });
  };

  if (typeof showConfirm === "function") {
    showConfirm("Bu kaydı silmek istediğinize emin misiniz?", performDelete);
    return;
  }

  performDelete();
}

/* ─────────────────── Yeni Kayıt Satırı Oluştur ─────────────────── */
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

/* ─────────────────── Yeni Kayıt Gönder ─────────────────── */
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
/* OLAY DİNLEYİCİLERİ VE BAŞLATMA                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Modal Kapanınca Ertelenen Render ─────────────────── */
(function () {
  const observer = new MutationObserver(() => {
    if (_pendingRender && !isAnyModalOpen()) {
      _pendingRender = false;
      renderAll();
    }
  });
  document.querySelectorAll(".modal-overlay").forEach((el) => {
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  });
})();

/* ─────────────────── Sıralama Tıklama Dinleyicisi ─────────────────── */
document.querySelectorAll(".sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const col = th.dataset.sort || th.dataset.col;
    if (!col) return;

    if (currentSort.col === col) {
      currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
    } else {
      currentSort.col = col;
      currentSort.dir = "asc";
    }

    updateSortIcons();
    renderAll();
  });
});

/* ─────────────────── Ürün Ekle Butonu Dinleyicisi ─────────────────── */
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

/* ─────────────────── Tablo Klavye Kısayolları ─────────────────── */
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

/* ─────────────────── Tablo Gövdesi (Event Delegation) ─────────────────── */
function initTableBodyEvents() {
  if (!tableBody) return;
  tableBody.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete-item") {
      deleteItem(id);
    } else if (action === "edit-item") {
      openEditModal(id);
    } else if (action === "update-status") {
      updateItemStatus(id, btn.dataset.status);
    }
  });
}

/* ─────────────────── DOM Yüklendiğinde Başlatma ─────────────────── */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTableBodyEvents);
} else {
  initTableBodyEvents();
}
