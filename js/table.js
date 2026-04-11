/* ─── FİLTRELE + SIRALA ──────────────────────────────────────────────────────── */
function getFilteredSortedList() {
  let list = Object.keys(allData).map((id) => ({ id, ...allData[id] }));

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter((item) =>
      [item.component, item.brand, item.specs, item.vendor].some((v) =>
        (v || "").toLowerCase().includes(q),
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

/* ─── RENDER PIPELINE ────────────────────────────────────────────────────────── */
function renderAll() {
  const list = getFilteredSortedList();
  updateStats(list);
  renderTableRows(list);
  updateResultCount(list.length);
}

/* ─── STATS CARDS ────────────────────────────────────────────────────────────── */
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

  document.getElementById("statTotal").textContent =
    CURRENCY_FORMAT.format(total) + " ₺";
  document.getElementById("statCount").textContent = count;
  document.getElementById("statHealthy").textContent = healthy;
  document.getElementById("statExpensive").textContent = mostExp
    ? mostExp.component
    : "—";

  const filteredTotal = filteredList.reduce(
    (s, i) => s + (parseFloat(i.price) || 0),
    0,
  );
  document.getElementById("totalCostDisplay").textContent =
    CURRENCY_FORMAT.format(filteredTotal) + " ₺";
}

/* ─── STATUS CLASS ───────────────────────────────────────────────────────────── */
function getStatusClassName(statusValue) {
  const key = normalizeTr(statusValue);
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return "status-healthy";
}

/* ─── RESULT COUNT ───────────────────────────────────────────────────────────── */
function updateResultCount(filteredCount) {
  const total = Object.keys(allData).length;
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  resultCount.textContent = isFiltered
    ? `${filteredCount} / ${total} kayıt`
    : "";
}

/* ─── SATIR ELEMENTI OLUŞTUR ─────────────────────────────────────────────────── */
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

/* ─── TABLO SATIRLARINI RENDER ET ────────────────────────────────────────────── */
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
          const statusClass = getStatusClassName(item.status);

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
            <td class="col-brand">
              ${
                item.url && item.url.trim() !== ""
                  ? `<a href="${item.url}" target="_blank" class="brand-link" title="Ürüne Git">${escHtml(item.brand)} <span class="link-icon">🔗</span></a>`
                  : escHtml(item.brand)
              }
            </td>
            <td class="col-specs">${escHtml(item.specs)}</td>
            <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
            ${vendorCell}
            <td class="status-cell">
              <div class="status-cell-inner">
                <div class="status-menu">
                  <span class="status-label ${statusClass}">${item.status}</span>
                  <div class="status-options">
                    <div onclick="updateItemStatus('${item.id}', 'sağlıklı')">✓ Sağlıklı</div>
                    <div onclick="updateItemStatus('${item.id}', 'bozuk')">✗ Bozuk</div>
                    <div onclick="updateItemStatus('${item.id}', 'yedek')">◉ Yedek</div>
                    <div onclick="updateItemStatus('${item.id}', 'atıldı')">⊘ Atıldı</div>
                  </div>
                </div>
                <div class="row-actions">
                  <button class="action-btn edit-btn" onclick="openEditModal('${item.id}')" title="Düzenle (çift tıkla)">✎</button>
                  <button class="action-btn delete-btn" onclick="deleteItem('${item.id}')" title="Sil">✕</button>
                </div>
              </div>
            </td>
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
      const statusClass = getStatusClassName(item.status);
      const formattedDate = DATE_FORMAT(item.date);

      tr.innerHTML = `
        <td class="col-date">${formattedDate}</td>
        <td class="col-component">${escHtml(item.component)}</td>
        <td class="col-brand">
          ${
            item.url && item.url.trim() !== ""
              ? `<a href="${item.url}" target="_blank" class="brand-link" title="Ürüne Git">${escHtml(item.brand)} <span class="link-icon">🔗</span></a>`
              : escHtml(item.brand)
          }
        </td>
        <td class="col-specs">${escHtml(item.specs)}</td>
        <td class="col-price">${CURRENCY_FORMAT.format(item.price)} ₺</td>
        <td class="col-vendor">${escHtml(item.vendor)}</td>
        <td class="status-cell">
          <div class="status-cell-inner">
            <div class="status-menu">
              <span class="status-label ${statusClass}">${item.status}</span>
              <div class="status-options">
                <div onclick="updateItemStatus('${item.id}', 'sağlıklı')">✓ Sağlıklı</div>
                <div onclick="updateItemStatus('${item.id}', 'bozuk')">✗ Bozuk</div>
                <div onclick="updateItemStatus('${item.id}', 'yedek')">◉ Yedek</div>
                <div onclick="updateItemStatus('${item.id}', 'atıldı')">⊘ Atıldı</div>
              </div>
            </div>
            <div class="row-actions">
              <button class="action-btn edit-btn" onclick="openEditModal('${item.id}')" title="Düzenle (çift tıkla)">✎</button>
              <button class="action-btn delete-btn" onclick="deleteItem('${item.id}')" title="Sil">✕</button>
            </div>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  unsavedRows.forEach((r) => tableBody.appendChild(r));
}

/* ─── SORT HEADERS ───────────────────────────────────────────────────────────── */
document.querySelectorAll(".sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    currentSort =
      currentSort.col === col
        ? { col, dir: currentSort.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" };
    updateSortIcons();
    renderAll();
  });
});

function updateSortIcons() {
  document.querySelectorAll(".sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    if (th.dataset.col === currentSort.col) {
      icon.textContent = currentSort.dir === "asc" ? "↑" : "↓";
      th.classList.add("sort-active");
    } else {
      icon.textContent = "↕";
      th.classList.remove("sort-active");
    }
  });
}

/* ─── SEARCH ─────────────────────────────────────────────────────────────────── */
searchInput.addEventListener("input", () => {
  currentSearch = searchInput.value;
  clearSearch.style.display = currentSearch ? "flex" : "none";
  renderAll();
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  currentSearch = "";
  clearSearch.style.display = "none";
  renderAll();
  searchInput.focus();
});

/* ─── STATUS FILTER BUTTONS ──────────────────────────────────────────────────── */
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    renderAll();
  });
});

/* ─── FİREBASE TABLO AKSİYONLARI ─────────────────────────────────────────────── */
window.updateItemStatus = (id, newStatus) => {
  database
    .ref("components/" + id)
    .update({ status: newStatus })
    .then(() => showToast(`Durum güncellendi: ${newStatus}`, "success"))
    .catch(() => showToast("Güncelleme başarısız", "error"));
};

window.deleteItem = (id) => {
  const item = allData[id];
  const name = item ? item.component : "Kayıt";
  showConfirm(`"${name}" silinsin mi?`, () => {
    database
      .ref("components/" + id)
      .remove()
      .then(() => showToast("Kayıt silindi", "success"))
      .catch(() => showToast("Silme başarısız", "error"));
  });
};
