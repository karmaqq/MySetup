/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAÇ ÇUBUĞU VE İSTATİSTİK                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  allData,
  currentSearch,
  currentStatusFilter,
  _statsCache,
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


