/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAÇ ÇUBUĞU VE İSTATİSTİK                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  allData,
  currentSearch,
  currentStatusFilter,
  getStatsCache,
  setCurrentSearch,
  setCurrentStatusFilter,
  searchInput,
  clearSearch,
  statTotal,
  statCount,
  statHealthy,
  statExpensive,
  totalCostDisplay,
  resultCount,
} from "./app-state";
import { scheduleRender } from "./global-fn";
import { CURRENCY_FORMAT } from "./global-ut";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          İSTATİSTİK HESAPLAMA                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── İstatistik Önbelleği ─────────────────── */

export function rebuildStatsCache(): void {
  const c = getStatsCache();
  c.total = 0;
  c.count = 0;
  c.healthy = 0;
  c.mostExpId = null;
  c.mostExpPrice = 0;

  for (const [id, i] of Object.entries(allData)) {
    const price = parseFloat(i.price) || 0;
    c.total += price;
    c.count++;
    if ((i._statusNorm || "").includes("saglikli")) c.healthy++;
    if (price > c.mostExpPrice) {
      c.mostExpPrice = price;
      c.mostExpId = id;
    }
  }
}

/* ─────────────────── Önbellek Güncelleme ─────────────────── */

// F-17: Ardışık rebuildStatsCache çağrılarını RAF ile debounce et
let _rebuildScheduled = false;
function scheduleRebuild(): void {
  if (_rebuildScheduled) return;
  _rebuildScheduled = true;
  requestAnimationFrame(function () {
    _rebuildScheduled = false;
    rebuildStatsCache();
  });
}


export function updateStatsCacheOnChange(
  item: any,
  oldItem: any | undefined,
  isRemove: boolean,
): void {
  const newPrice = parseFloat(item.price) || 0;
  const oldPrice = oldItem ? parseFloat(oldItem.price) || 0 : 0;
  const c = getStatsCache();

  if (isRemove) {
    c.total -= oldPrice;
    c.count--;
    if (oldItem && (oldItem._statusNorm || "").includes("saglikli")) {
      c.healthy--;
    }
    if (c.mostExpId === item.id) {
      scheduleRebuild();
      return;
    }
  } else {
    if (!oldItem) {
      c.total += newPrice;
      c.count++;
      if ((item._statusNorm || "").includes("saglikli")) c.healthy++;
      if (newPrice > c.mostExpPrice) {
        c.mostExpPrice = newPrice;
        c.mostExpId = item.id;
        const mostExpItem = c.mostExpId
          ? allData[c.mostExpId]
          : null;
        if (statExpensive)
          statExpensive.textContent = mostExpItem ? mostExpItem.component : "—";
      }
    } else {
      const priceDiff = newPrice - oldPrice;
      if (priceDiff !== 0) c.total += priceDiff;

      const oldHealthy = (oldItem._statusNorm || "").includes("saglikli");
      const newHealthy = (item._statusNorm || "").includes("saglikli");
      if (!oldHealthy && newHealthy) c.healthy++;
      else if (oldHealthy && !newHealthy) c.healthy--;

      if (
        c.mostExpId === item.id ||
        newPrice > c.mostExpPrice
      ) {
        scheduleRebuild();
        return;
      }
    }
  }
}

/* ─────────────────── İstatistik Görüntüleme ─────────────────── */

export function updateStats(filteredList: any[]): void {
  const isFiltered = currentSearch || currentStatusFilter !== "all";
  let filteredTotal: number,
    filteredHealthy: number,
    mostExpItem: any,
    filteredLength: number;

  const c = getStatsCache();
  if (!isFiltered) {
    filteredTotal = c.total;
    filteredHealthy = c.healthy;
    mostExpItem = c.mostExpId ? allData[c.mostExpId] : null;
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

/* ─────────────────── Sonuç Sayısı ─────────────────── */

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
    }, 250);
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


