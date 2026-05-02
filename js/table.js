/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     DURUM DEĞİŞKENLERİ VE KONTROL                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sabitler ─────────────────── */

const VSCROLL_INITIAL = 40;

/* ─────────────────── Modal Açık Kontrolü ─────────────────── */

function isAnyModalOpen() {
  return !!document.querySelector(".modal-overlay.active");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FİLTRELEME VE SIRALAMA                          */
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
      const norm = item._statusNorm;
      if (currentStatusFilter === "saglikli") return norm.includes("saglikl");
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       İSTATİSTİK HESAPLAMA                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Tüm Veriyi Tarayarak Önbelleği Yeniden Kur ─────────────────── */

function rebuildStatsCache() {
  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  for (const [id, i] of Object.entries(allData)) {
    const price = parseFloat(i.price) || 0;
    _statsCache.total += price;
    _statsCache.count++;
    if ((i._statusNorm || "").includes("saglikl")) _statsCache.healthy++;
    if (price > _statsCache.mostExpPrice) {
      _statsCache.mostExpPrice = price;
      _statsCache.mostExpId = id;
    }
  }
}

/* ─────────────────── Tek Kayıt Değişiminde Önbelleği Güncelle ─────────────────── */

function updateStatsCacheOnChange(item, oldItem, isRemove) {
  const newPrice = parseFloat(item.price) || 0;
  const oldPrice = oldItem ? parseFloat(oldItem.price) || 0 : 0;

  if (isRemove) {
    _statsCache.total -= oldPrice;
    _statsCache.count--;
      if (oldItem && (oldItem._statusNorm || "").includes("saglikl")) {
        _statsCache.healthy--;
      }
    if (_statsCache.mostExpId === item.id) {
      rebuildStatsCache();
      updateStats(getFilteredSortedList());
    }
  } else {
    if (!oldItem) {
      _statsCache.total += newPrice;
      _statsCache.count++;
      if ((item._statusNorm || "").includes("saglikl")) _statsCache.healthy++;
    } else {
      const priceDiff = newPrice - oldPrice;
      if (priceDiff !== 0) _statsCache.total += priceDiff;

      const oldHealthy = (oldItem._statusNorm || "").includes("saglikl");
      const newHealthy = (item._statusNorm || "").includes("saglikl");
      if (!oldHealthy && newHealthy) _statsCache.healthy++;
      else if (oldHealthy && !newHealthy) _statsCache.healthy--;
    }
    if (newPrice > _statsCache.mostExpPrice) {
      _statsCache.mostExpPrice = newPrice;
      _statsCache.mostExpId = item.id;
      const mostExpItem = allData[_statsCache.mostExpId];
      if (statExpensive)
        statExpensive.textContent = mostExpItem ? mostExpItem.component : "—";
    }
  }
}

/* ─────────────────── İstatistik Kartlarını Güncelle ─────────────────── */

function updateStats(filteredList) {
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  let filteredTotal, filteredHealthy, mostExpItem, filteredLength;

  if (!isFiltered) {
    filteredTotal = _statsCache.total;
    filteredHealthy = _statsCache.healthy;
    mostExpItem = allData[_statsCache.mostExpId] || null;
    filteredLength = Object.keys(allData).length;
  } else if (filteredList) {
    let mostExpPrice = -Infinity;
    filteredTotal = 0;
    filteredHealthy = 0;

    for (const i of filteredList) {
      const price = parseFloat(i.price) || 0;
      filteredTotal += price;
      if ((i._statusNorm || "").includes("saglikl")) filteredHealthy++;
      if (price > mostExpPrice) {
        mostExpPrice = price;
        mostExpItem = i;
      }
    }
    filteredLength = filteredList.length;
  } else {
    return;
  }

  if (statTotal)
    statTotal.textContent = CURRENCY_FORMAT.format(filteredTotal) + " ₺";
  if (statCount) statCount.textContent = filteredLength;
  if (statHealthy) statHealthy.textContent = filteredHealthy;

  if (statExpensive) {
    statExpensive.textContent = mostExpItem ? mostExpItem.component : "—";
    const statCard = statExpensive.closest(".stat-card");
    if (statCard) {
      const statIcon = statCard.querySelector(".stat-icon");
      if (statIcon) {
        statIcon.classList.remove(
          "status-broken",
          "status-reserve",
          "status-discarded",
          "status-healthy",
        );
        if (currentStatusFilter !== "all" && mostExpItem) {
          const statusNorm = mostExpItem._statusNorm || "";
          if (statusNorm.includes("bozuk"))
            statIcon.classList.add("status-broken");
          else if (statusNorm.includes("yedek"))
            statIcon.classList.add("status-reserve");
          else if (statusNorm.includes("atildi"))
            statIcon.classList.add("status-discarded");
          else if (statusNorm.includes("saglikl"))
            statIcon.classList.add("status-healthy");
        }
      }
    }
  }

  if (totalCostDisplay)
    totalCostDisplay.textContent = CURRENCY_FORMAT.format(filteredTotal) + " ₺";
}

/* ─────────────────── Sonuç Sayısını Güncelle ─────────────────── */

function updateResultCount(filteredCount) {
  const total = Object.keys(allData).length;
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  if (resultCount) {
    resultCount.textContent = isFiltered
      ? `${filteredCount} / ${total} kayıt`
      : "";
  }
}

/* ─────────────────── Sıralama İkonlarını Güncelle ─────────────────── */

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
/*                          SATIR VE HÜCRE OLUŞTURMA                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Durum CSS Sınıfı ─────────────────── */

function getStatusClassName(statusValue) {
  const key = normalizeTr(statusValue);
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return "status-healthy";
}

/* ─────────────────── Durum Hücresi HTML ─────────────────── */

function buildStatusCellInnerHTML(item) {
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

/* ─────────────────── Birleşik Marka/Özellik Hücresi HTML ─────────────────── */

function buildCombinedSpecsCellHTML(item) {
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

/* ─────────────────── Standart Satır HTML ─────────────────── */

function buildRowHTML(item) {
  return `
    <td class="col-date">${DATE_FORMAT(item.date)}</td>
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-specs">${buildCombinedSpecsCellHTML(item)}</td>
    <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
    <td class="col-vendor">${escHtml(item.vendor)}</td>
    ${buildStatusCellInnerHTML(item)}
  `;
}

/* ─────────────────── Gruplama Modunda Satır HTML ─────────────────── */

function buildGroupRowHTML(item, dateCell, vendorCell) {
  return `
    ${dateCell}
    <td class="col-component">${escHtml(item.component)}</td>
    <td class="col-specs">${buildCombinedSpecsCellHTML(item)}</td>
    <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
    ${vendorCell}
    ${buildStatusCellInnerHTML(item)}
  `;
}

/* ─────────────────── Satır DOM Elemanı Oluştur ─────────────────── */

function createRowEl(item) {
  const tr = document.createElement("tr");
  tr.dataset.id = item.id;
  return tr;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       FRAGMENT OLUŞTURUCU                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Satır Listesinden Fragment Derle ─────────────────── */

function buildRowsFragment(list) {
  const fragment = document.createDocumentFragment();
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
      sep.innerHTML = `<td colspan="6"></td>`;
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

/* ─────────────────── Tablo Satırlarını Render Et ─────────────────── */

let _vsRafId = null;

function renderTableRows(list) {
  if (_vsRafId) {
    cancelAnimationFrame(_vsRafId);
    _vsRafId = null;
  }

  const unsavedRows = Array.from(tableBody.querySelectorAll(".new-item-row"));

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
    tableBody.replaceChildren(emptyRow, ...unsavedRows);
    return;
  }

  const firstChunk = list.slice(0, VSCROLL_INITIAL);
  tableBody.replaceChildren(buildRowsFragment(firstChunk), ...unsavedRows);

  if (list.length > VSCROLL_INITIAL) {
    const restList = list.slice(VSCROLL_INITIAL);

    _vsRafId = requestAnimationFrame(() => {
      _vsRafId = null;

      if (currentSort.col === "date") {
        const saved = Array.from(tableBody.querySelectorAll(".new-item-row"));
        tableBody.replaceChildren(buildRowsFragment(list), ...saved);
      } else {
        const restFrag = document.createDocumentFragment();
        restList.forEach((item) => {
          const tr = createRowEl(item);
          tr.innerHTML = buildRowHTML(item);
          restFrag.appendChild(tr);
        });
        const saved = tableBody.querySelectorAll(".new-item-row");
        if (saved.length) {
          tableBody.insertBefore(restFrag, saved[0]);
        } else {
          tableBody.appendChild(restFrag);
        }
      }
    });
  }
}

/* ─────────────────── Tam Render (Filtre + Tablo + İstatistik) ─────────────────── */

function renderAll() {
  const scrollY = window.scrollY;
  const list = getFilteredSortedList();
  updateStats(list);
  renderTableRows(list);
  updateResultCount(list.length);

  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, behavior: "instant" });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      CRUD VE VERİ GÜNCELLEMELERİ                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Görünür Öğe Sayısını Hesapla ─────────────────── */

function _countVisibleItems() {
  return Object.values(allData).filter(isItemVisible).length;
}

/* ─────────────────── Öğe Filtre Kriterlerine Uyuyor Mu ─────────────────── */

function isItemVisible(item) {
  if (currentSearch) {
    const q = normalizeTr(currentSearch);
    if (!item._searchTag || !item._searchTag.includes(q)) return false;
  }
  if (currentStatusFilter !== "all") {
    const norm = item._statusNorm || "";
    if (currentStatusFilter === "saglikli" && !norm.includes("saglikl")) return false;
    if (currentStatusFilter === "bozuk" && !norm.includes("bozuk")) return false;
    if (currentStatusFilter === "yedek" && !norm.includes("yedek")) return false;
    if (currentStatusFilter === "atildi" && !norm.includes("atildi")) return false;
  }
  return true;
}

/* ─────────────────── Satır Ekle veya Güncelle ─────────────────── */

function addOrUpdateTableRow(id, item) {
  const visible = isItemVisible(item);
  const row = tableBody.querySelector(`tr[data-id="${id}"]`);
  const newItem = { ...item, id };

  if (!visible) {
    if (row) row.remove();
    updateResultCount(_countVisibleItems());
    return;
  }

  const newRow = createRowEl(newItem);
  newRow.innerHTML = buildRowHTML(newItem);

  if (row) {
    row.replaceWith(newRow);
  } else {
    const topSep = tableBody.querySelector(".group-separator");
    if (topSep && topSep.nextSibling) {
      tableBody.insertBefore(newRow, topSep.nextSibling);
    } else {
      tableBody.appendChild(newRow);
    }
  }

  updateResultCount(_countVisibleItems());
}

/* ─────────────────── Satır Kaldır ─────────────────── */

function removeTableRow(id) {
  const row = tableBody.querySelector(`tr[data-id="${id}"]`);
  if (row) row.remove();

  if (Object.keys(allData).length === 0) {
    renderAll();
    return;
  }

  updateResultCount(_countVisibleItems());
}

/* ─────────────────── Kayıt Durumunu Güncelle (Optimistic) ─────────────────── */

function updateItemStatus(itemId, newStatus) {
  const currentItem = allData[itemId];
  if (!currentItem) return;
  if (currentItem._statusNorm === normalizeTr(newStatus)) return;

  const oldItem = { ...currentItem };
  const oldStatus = currentItem.status;
  const oldStatusNorm = currentItem._statusNorm;

  currentItem.status = newStatus;
  currentItem._statusNorm = normalizeTr(newStatus);

  updateStatsCacheOnChange(currentItem, oldItem, false);

  const applyToDOM = () => {
    const row = tableBody?.querySelector(`tr[data-id="${itemId}"]`);
    const cell = row?.querySelector(".status-cell");
    if (cell)
      cell.outerHTML = buildStatusCellInnerHTML(Object.assign({ id: itemId }, currentItem));
  };

  applyToDOM();

  updateComponentStatusInFirebase(itemId, newStatus)
    .then(() => {
      showToast("Kayıt güncellendi", "success");
    })
    .catch(() => {
      currentItem.status = oldStatus;
      currentItem._statusNorm = oldStatusNorm;
      rebuildStatsCache();
      applyToDOM();
      showToast("Durum güncellenemedi", "error");
    });
}

/* ─────────────────── Kaydı Sil ─────────────────── */

function deleteItem(itemId) {
  if (!allData[itemId]) {
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
      .catch(() => {
        showToast("Kayıt silinemedi", "error");
      });
  };

  if (typeof showConfirm === "function") {
    showConfirm("Bu kaydı silmek istediğinize emin misiniz?", performDelete);
    return;
  }
  performDelete();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        YENİ KAYIT EKLEME                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Satır İçi Yeni Kayıt Satırı Oluştur ─────────────────── */

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

  const dateInput = tr.querySelector(".date-input");
  const hiddenPicker = tr.querySelector(".hidden-picker");
  const calendarIcon = tr.querySelector(".calendar-icon");
  const componentInput = tr.querySelector(".component-input");
  const brandInput = tr.querySelector(".brand-input");
  const specsInput = tr.querySelector(".specs-input");
  const priceInput = tr.querySelector(".price-input");
  const vendorInput = tr.querySelector(".vendor-input");
  const saveBtn = tr.querySelector(".save-btn");

  calendarIcon.onclick = () => hiddenPicker.showPicker();

  hiddenPicker.onchange = (e) => {
    const [y, m, d] = e.target.value.split("-");
    dateInput.value = `${d}.${m}.${y}`;
  };

  priceInput.addEventListener("input", function () {
    if (typeof applyPriceFormat === "function") applyPriceFormat(this);
  });

  componentInput.addEventListener("input", () => {
    saveBtn.classList.toggle("visible", !!componentInput.value.trim());
  });

  vendorInput.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey && componentInput.value.trim()) {
      e.preventDefault();
      submitNewItem(tr);
    }
  });

  tr.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && componentInput.value.trim()) submitNewItem(tr);
  });

  saveBtn.onclick = () => submitNewItem(tr);

  setTimeout(() => componentInput.focus(), 30);
  return tr;
}

/* ─────────────────── Yeni Kayıt Satırını Firebase'e Gönder ─────────────────── */

function submitNewItem(tr) {
  const dateInput = tr.querySelector(".date-input");
  const componentInput = tr.querySelector(".component-input");
  const brandInput = tr.querySelector(".brand-input");
  const specsInput = tr.querySelector(".specs-input");
  const priceInput = tr.querySelector(".price-input");
  const vendorInput = tr.querySelector(".vendor-input");

  const component = componentInput.value.trim();
  if (!component) return;

  const rawDate = dateInput.value.trim();
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

  const rawPrice = priceInput.value.replace(/\./g, "").replace(",", ".");

  const newItemData = {
    date: finalDate,
    component,
    brand: brandInput.value.trim() || "-",
    specs: specsInput.value.trim() || "-",
    price: parseFloat(rawPrice) || 0,
    vendor: vendorInput.value.trim() || "-",
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
/*                     OLAY DİNLEYİCİLERİ VE BAŞLATMA                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Sıralama Başlıkları ─────────────────── */

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

/* ─────────────────── Kayıt Ekle Butonu ─────────────────── */

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

function initTableBodyEvents() {
  if (!tableBody) return;

  tableBody.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete-item") deleteItem(id);
    else if (action === "edit-item") openEditModal(id);
    else if (action === "update-status")
      updateItemStatus(id, btn.dataset.status);
  });

  tableBody.addEventListener("dblclick", function (e) {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    if (e.target.closest(".status-menu") || e.target.closest(".row-actions"))
      return;

    const id = tr.dataset.id;
    const targetCell = e.target.closest("td");
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

    window.getSelection().removeAllRanges();
    openEditModal(id, focusTarget);
  });
}

/* ─────────────────── DOM Hazır Kontrolü ve Başlatma ─────────────────── */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTableBodyEvents);
} else {
  initTableBodyEvents();
}
