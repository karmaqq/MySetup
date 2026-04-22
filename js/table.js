/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     TABLO VERİ GÖSTERME VE YÖNETİMİ                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        FİLTRELEME VE SIRALAMA                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Filtrelenmiş ve Sıralanmış Liste ─────────────────── */

function getFilteredSortedList() {
  let list = Object.keys(allData).map((id) => ({ id, ...allData[id] }));

  if (currentSearch) {
    const q = normalizeTr(currentSearch);
    list = list.filter((item) =>
      [item.component, item.brand, item.specs, item.vendor].some((v) =>
        normalizeTr(v).includes(q),
      ),
    );
  }

  if (currentStatusFilter !== "all") {
    list = list.filter((item) => {
      const norm = normalizeTr(item.status);
      if (currentStatusFilter === "saglikli") return norm.includes("saglikl");
      if (currentStatusFilter === "bozuk") return norm.includes("bozuk");
      if (currentStatusFilter === "yedek") return norm.includes("yedek");
      if (currentStatusFilter === "atildi") return norm.includes("atild");
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          RENDER YÖNETİMİ                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Render Durum Değişkenleri ─────────────────── */

let _pendingRender = false;

/* ─────────────────── Modal Açık Kontrolü ─────────────────── */

function isAnyModalOpen() {
  return !!document.querySelector(".modal-overlay.active");
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

/* ─────────────────── Tablo Satırlarını Render Et ─────────────────── */

function renderTableRows(list) {
  const unsavedRows = Array.from(tableBody.querySelectorAll(".new-item-row"));
  tableBody.innerHTML = "";

  if (!list.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="7" class="empty-cell">
        <div class="empty-state">
          <div class="empty-icon">⊘</div>
          <span>${currentSearch || currentStatusFilter !== "all" ? "Filtreyle eşleşen kayıt bulunamadı" : "Henüz kayıt yok"}</span>
        </div>
      </td>`;
    tableBody.appendChild(emptyRow);
    unsavedRows.forEach((r) => tableBody.appendChild(r));
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
      tableBody.appendChild(sep);

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

          tr.innerHTML = `
            ${dateCell}
            <td class="col-component">${escHtml(item.component)}</td>
            <td class="col-brand">${buildBrandCellHTML(item)}</td>
            <td class="col-specs">${escHtml(item.specs)}</td>
            <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
            ${vendorCell}
            ${buildStatusCellHTML(item)}
          `;
          tableBody.appendChild(tr);
          dateRowSpanIndex++;
        });
      });
    });
  } else {
    const topSep = document.createElement("tr");
    topSep.className = "group-separator";
    topSep.innerHTML = `<td colspan="7"></td>`;
    tableBody.appendChild(topSep);

    list.forEach((item) => {
      const tr = createRowEl(item);
      const formattedDate = DATE_FORMAT(item.date);

      tr.innerHTML = `
        <td class="col-date">${formattedDate}</td>
        <td class="col-component">${escHtml(item.component)}</td>
        <td class="col-brand">${buildBrandCellHTML(item)}</td>
        <td class="col-specs">${escHtml(item.specs)}</td>
        <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
        <td class="col-vendor">${escHtml(item.vendor)}</td>
        ${buildStatusCellHTML(item)}
      `;
      tableBody.appendChild(tr);
    });
  }

  unsavedRows.forEach((r) => tableBody.appendChild(r));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          İSTATİSTİKLER                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İstatistik Kartlarını Güncelle ─────────────────── */

function updateStats(filteredList) {
  const all = Object.values(allData);
  const total = all.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const count = all.length;
  const healthy = all.filter((i) =>
    normalizeTr(i.status).includes("saglikl"),
  ).length;
  const mostExp = all.reduce(
    (best, i) =>
      (parseFloat(i.price) || 0) > (parseFloat(best?.price) || 0) ? i : best,
    null,
  );

  if (statTotal) statTotal.textContent = CURRENCY_FORMAT.format(total) + " ₺";
  if (statCount) statCount.textContent = count;
  if (statHealthy) statHealthy.textContent = healthy;
  if (statExpensive)
    statExpensive.textContent = mostExp ? mostExp.component : "—";

  const filteredTotal = filteredList.reduce(
    (s, i) => s + (parseFloat(i.price) || 0),
    0,
  );
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        SATIR VE HÜCRE OLUŞTURMA                          */
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

/* ─────────────────── Marka Hücresi HTML ─────────────────── */

function buildBrandCellHTML(item) {
  const safeUrl = safeExternalUrl(item.url);
  if (safeUrl) {
    return `<a href="${escAttr(safeUrl)}" target="_blank" rel="noopener noreferrer" class="brand-link" title="Ürüne Git">${escHtml(item.brand)} <span class="link-icon">🔗</span></a>`;
  }
  return escHtml(item.brand);
}

/* ─────────────────── Tablo Satırı Oluştur ─────────────────── */

function createRowEl(item) {
  const tr = document.createElement("tr");
  tr.dataset.id = item.id;
  tr.addEventListener("dblclick", (e) => {
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
/*                        DURUM VE SİLME YÖNETİMİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

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
  if (!allData[itemId]) return;

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
/*                        TABLO OLAY DİNLEYİCİLERİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Tıklama Delegasyonu ─────────────────── */

if (tableBody) {
  tableBody.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    event.stopPropagation();

    const itemId = actionEl.dataset.id;
    if (!itemId) return;

    if (actionEl.dataset.action === "update-status") {
      updateItemStatus(itemId, actionEl.dataset.status);
      return;
    }

    if (actionEl.dataset.action === "edit-item") {
      openEditModal(itemId);
      return;
    }

    if (actionEl.dataset.action === "delete-item") {
      deleteItem(itemId);
    }
  });
}
