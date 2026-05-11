/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAÇ ÇUBUĞU VE İSTATİSTİK                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  allData,
  currentSearch,
  currentStatusFilter,
  _statsCache,
  scheduleRender,
  setCurrentSearch,
  setCurrentStatusFilter,
  CURRENCY_FORMAT,
  safeExternalUrl,
  searchInput,
  clearSearch,
  statTotal,
  statCount,
  statHealthy,
  statExpensive,
  totalCostDisplay,
  resultCount,
} from "./utils";
import { getFilteredSortedList } from "./table";
import { showToast, showConfirm } from "./io";
import { db } from "./firebase-init";
import { replaceUserDataInFirebase } from "./firebase-inv";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          İSTATİSTİK HESAPLAMA                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function rebuildStatsCache(): void {
  _statsCache.total = 0;
  _statsCache.count = 0;
  _statsCache.healthy = 0;
  _statsCache.mostExpId = null;
  _statsCache.mostExpPrice = 0;

  for (const [id, i] of Object.entries(allData)) {
    const price = parseFloat(i.price) || 0;
    _statsCache.total += price;
    _statsCache.count++;
    if ((i._statusNorm || "").includes("saglikli")) _statsCache.healthy++;
    if (price > _statsCache.mostExpPrice) {
      _statsCache.mostExpPrice = price;
      _statsCache.mostExpId = id;
    }
  }
}

export function updateStatsCacheOnChange(
  item: any,
  oldItem: any | undefined,
  isRemove: boolean,
): void {
  const newPrice = parseFloat(item.price) || 0;
  const oldPrice = oldItem ? parseFloat(oldItem.price) || 0 : 0;

  if (isRemove) {
    _statsCache.total -= oldPrice;
    _statsCache.count--;
    if (oldItem && (oldItem._statusNorm || "").includes("saglikli")) {
      _statsCache.healthy--;
    }
    if (_statsCache.mostExpId === item.id) {
      rebuildStatsCache();
      return;
    }
  } else {
    if (!oldItem) {
      _statsCache.total += newPrice;
      _statsCache.count++;
      if ((item._statusNorm || "").includes("saglikli")) _statsCache.healthy++;
      if (newPrice > _statsCache.mostExpPrice) {
        _statsCache.mostExpPrice = newPrice;
        _statsCache.mostExpId = item.id;
        const mostExpItem = _statsCache.mostExpId
          ? allData[_statsCache.mostExpId]
          : null;
        if (statExpensive)
          statExpensive.textContent = mostExpItem ? mostExpItem.component : "—";
      }
    } else {
      const priceDiff = newPrice - oldPrice;
      if (priceDiff !== 0) _statsCache.total += priceDiff;

      const oldHealthy = (oldItem._statusNorm || "").includes("saglikli");
      const newHealthy = (item._statusNorm || "").includes("saglikli");
      if (!oldHealthy && newHealthy) _statsCache.healthy++;
      else if (oldHealthy && !newHealthy) _statsCache.healthy--;

      if (
        _statsCache.mostExpId === item.id ||
        newPrice > _statsCache.mostExpPrice
      ) {
        rebuildStatsCache();
        return;
      }
    }
  }
}

export function updateStats(filteredList: any[]): void {
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  let filteredTotal: number,
    filteredHealthy: number,
    mostExpItem: any,
    filteredLength: number;

  if (!isFiltered) {
    filteredTotal = _statsCache.total;
    filteredHealthy = _statsCache.healthy;
    mostExpItem = _statsCache.mostExpId ? allData[_statsCache.mostExpId] : null;
    filteredLength = Object.keys(allData).length;
  } else if (filteredList) {
    let mostExpPrice = -Infinity;
    filteredTotal = 0;
    filteredHealthy = 0;

    for (const i of filteredList) {
      const price = parseFloat(i.price) || 0;
      filteredTotal += price;
      if ((i._statusNorm || "").includes("saglikli")) filteredHealthy++;
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
  if (statCount) statCount.textContent = String(filteredLength);
  if (statHealthy) statHealthy.textContent = String(filteredHealthy);

  if (statExpensive) {
    statExpensive.textContent = mostExpItem ? mostExpItem.component : "—";
    const statCard = statExpensive.closest(".stat-card");
    if (statCard) {
      const statIcon = statCard.querySelector(
        ".stat-icon",
      ) as HTMLElement | null;
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
          else if (statusNorm.includes("saglikli"))
            statIcon.classList.add("status-healthy");
        }
      }
    }
  }

  if (totalCostDisplay)
    totalCostDisplay.textContent = CURRENCY_FORMAT.format(filteredTotal) + " ₺";
}

export function updateResultCount(filteredCount: number): void {
  const total = Object.keys(allData).length;
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  if (resultCount) {
    resultCount.textContent = isFiltered
      ? `${filteredCount} / ${total} kayıt`
      : "";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAMA VE FİLTRELEME                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Arama Alanı ─────────────────── */

if (searchInput && clearSearch) {
  let _searchDebounce: number | null = null;

  searchInput.addEventListener("input", () => {
    const val = searchInput!.value;
    setCurrentSearch(val);
    clearSearch!.classList.toggle("visible", !!val);
    if (_searchDebounce) clearTimeout(_searchDebounce);
    _searchDebounce = window.setTimeout(() => {
      scheduleRender();
    }, 180);
  });

  clearSearch.addEventListener("click", () => {
    searchInput!.value = "";
    setCurrentSearch("");
    if (_searchDebounce) clearTimeout(_searchDebounce);
    clearSearch!.classList.remove("visible");
    scheduleRender();
    searchInput!.focus();
  });
}

/* ─────────────────── Arama Klavye Kısayolu ─────────────────── */

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const tag = (document.activeElement?.tagName || "").toUpperCase();
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }
});

/* ─────────────────── Filtre Butonları ─────────────────── */

const filterBtns = document.querySelectorAll(".filter-btn");
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setCurrentStatusFilter((btn as HTMLElement).dataset.status || "all");
    scheduleRender();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV İÇE AKTARMA                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (c === "," && !inQuote) {
      result.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  result.push(current);
  return result;
}

function processCsv(csvText: string): void {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    showToast("CSV dosyası boş veya geçersiz", "error");
    return;
  }

  const dataLines = lines.slice(1);
  const importPayload: Record<string, any> = {};

  dataLines.forEach((line) => {
    const row = parseCsvLine(line);
    if (row.length < 2 || !row[1]) return;

    const entryId = db.userDataRef!.push().key!;
    importPayload[entryId] = {
      date: row[0] || new Date().toISOString().split("T")[0],
      component: row[1],
      brand: row[2] || "-",
      specs: row[3] || "-",
      price: parseFloat((row[4] || "").replace(/[^0-9.]/g, "")) || 0,
      vendor: row[5] || "-",
      status: row[6] || "sağlıklı",
      url: safeExternalUrl(row[7]),
      imageUrl: row[8] || "",
      star: parseInt(row[9]) || 0,
      opinion: row[10] || "",
    };
  });

  const importCount = Object.keys(importPayload).length;
  if (!importCount) {
    showToast("CSV içinde aktarılabilir kayıt bulunamadı", "warn");
    return;
  }

  showConfirm(
    "Yeni liste aktarılırken mevcut tüm verileriniz silinecektir. Onaylıyor musunuz?",
    async () => {
      try {
        var deleteOldImages = Object.values(allData)
          .filter((item: any) => item.imageUrl)
          .map((item: any) =>
            firebase.storage().refFromURL(item.imageUrl).delete().catch(() => {}),
          );
        await Promise.all(deleteOldImages);
        await replaceUserDataInFirebase(importPayload);
        showToast(`${importCount} kayıt sıfırdan yüklendi.`, "success");
        scheduleRender();
      } catch (_) {
        showToast("CSV aktarımı tamamlanamadı", "error");
      }
    },
  );
}

/* ─────────────────── CSV Dosya Seçici ─────────────────── */

const importCsvBtn = document.getElementById(
  "importCsvBtn",
) as HTMLElement | null;
const importCsvInput = document.getElementById(
  "importCsvInput",
) as HTMLInputElement | null;

if (importCsvBtn && importCsvInput) {
  importCsvBtn.addEventListener("click", () => importCsvInput.click());
  importCsvInput.addEventListener("change", (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processCsv((ev.target as any).result as string);
    reader.readAsText(file, "UTF-8");
    importCsvInput.value = "";
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV DIŞA AKTARMA                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

const exportCsvBtn = document.getElementById(
  "exportCsvBtn",
) as HTMLElement | null;

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    const list: any[] = getFilteredSortedList();
    if (!list.length) {
      showToast("Dışa aktarılacak veri yok", "warn");
      return;
    }

    const headers = [
      "Tarih",
      "Bileşen",
      "Marka",
      "Özellikler",
      "Fiyat",
      "Satıcı",
      "Durum",
      "URL",
      "GörselURL",
      "Puan",
      "Görüş",
    ];

    const csvContent = [
      headers.join(","),
      ...list.map((item) =>
        [
          item.date || "",
          item.component || "",
          item.brand || "-",
          item.specs || "-",
          item.price || "0",
          item.vendor || "-",
          item.status || "sağlıklı",
          item.url || "",
          item.imageUrl || "",
          item.star || 0,
          item.opinion || "-",
        ]
          .map(
            (v) =>
              `"${String(v)
                .replace(/"/g, '""')
                .replace(/[\r\n]/g, " ")}"`,
          )
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mysetup_yedek_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    showToast("Veriler CSV olarak yedeklendi", "success");
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          TÜM LİSTEYİ SİL                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const deleteAllBtn = document.getElementById(
  "deleteAllBtn",
) as HTMLElement | null;

if (deleteAllBtn) {
  deleteAllBtn.addEventListener("click", () => {
    const itemCount = Object.keys(allData).length;
    if (!itemCount) {
      showToast("Silinecek kayıt bulunamadı", "warn");
      return;
    }

    showConfirm(
      "Tüm verileri gerçekten silmek istiyor musunuz?",
      async () => {
        try {
          var deleteOldImages = Object.values(allData)
            .filter((item: any) => item.imageUrl)
            .map((item: any) =>
              firebase.storage().refFromURL(item.imageUrl).delete().catch(() => {}),
            );
          await Promise.all(deleteOldImages);
          await replaceUserDataInFirebase({});
          showToast("Tüm kayıtlar silindi", "success");
        } catch (_) {
          showToast("Silme işlemi tamamlanamadı", "error");
        }
      },
      { yesText: "Onay" },
    );
  });
}
