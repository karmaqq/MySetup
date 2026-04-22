/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        GİRİŞ / ÇIKIŞ VE BİLDİRİMLER                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BİLDİRİM SİSTEMİ                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Toast Bildirimi Göster ─────────────────── */

window.showToast = function (message, type = "info", duration = 3200) {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { success: "✓", error: "✕", warn: "⚠", info: "i" };
  const icon = document.createElement("span");
  const text = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = icons[type] || "i";
  text.textContent = message;
  toast.append(icon, text);
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  setTimeout(() => {
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }, duration);
};

/* ─────────────────── Onay Diyalogu Göster ─────────────────── */

window.showConfirm = function (message, onConfirm) {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast toast-confirm";
  const text = document.createElement("span");
  const actions = document.createElement("div");
  const yesBtn = document.createElement("button");
  const noBtn = document.createElement("button");

  text.textContent = message;
  actions.className = "toast-actions";
  yesBtn.className = "toast-yes";
  noBtn.className = "toast-no";
  yesBtn.type = "button";
  noBtn.type = "button";
  yesBtn.textContent = "Evet, Devam Et";
  noBtn.textContent = "İptal";
  actions.append(yesBtn, noBtn);
  toast.append(text, actions);
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  const dismiss = () => {
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };

  yesBtn.onclick = () => {
    dismiss();
    onConfirm();
  };
  noBtn.onclick = dismiss;
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAMA VE FİLTRELEME                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Arama Alanı Dinleyicisi ─────────────────── */

if (searchInput && clearSearch) {
  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value;
    clearSearch.classList.toggle("visible", !!currentSearch);
    if (typeof renderAll === "function") renderAll();
  });

  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    currentSearch = "";
    clearSearch.classList.remove("visible");
    if (typeof renderAll === "function") renderAll();
    searchInput.focus();
  });
}

/* ─────────────────── Filtre Butonları Dinleyicisi ─────────────────── */

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    if (typeof renderAll === "function") renderAll();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV İÇE AKTARMA                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── CSV Referansları ─────────────────── */

const importCsvBtn = document.getElementById("importCsvBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importCsvInput = document.getElementById("importCsvInput");

/* ─────────────────── CSV İşleme ─────────────────── */

function processCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    showToast("CSV dosyası boş veya geçersiz", "error");
    return;
  }

  const getNewKey = () => {
    if (typeof database === "undefined") return null;
    if (typeof activeBasePath !== "undefined" && activeBasePath) {
      return database.ref(activeBasePath).push().key;
    }
    return database.ref().push().key;
  };

  const dataLines = lines.slice(1);
  const importPayload = {};

  dataLines.forEach((line) => {
    const row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    row.push(current.trim());

    if (row.length < 2 || !row[1]) return;

    const entryId = getNewKey();
    if (!entryId) return;

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
      if (typeof replaceUserDataInFirebase !== "function") {
        showToast("Aktif kullanıcı verisi bulunamadı", "error");
        return;
      }
      try {
        await replaceUserDataInFirebase(importPayload);
        showToast(`${importCount} kayıt sıfırdan yüklendi.`, "success");
      } catch (_error) {
        showToast("CSV aktarımı tamamlanamadı", "error");
      }
    },
  );
}

/* ─────────────────── CSV Dosya Seçici Dinleyicisi ─────────────────── */

if (importCsvBtn && importCsvInput) {
  importCsvBtn.addEventListener("click", () => importCsvInput.click());
  importCsvInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processCsv(ev.target.result);
    reader.readAsText(file);
    importCsvInput.value = "";
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV DIŞA AKTARMA                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    const list =
      typeof getFilteredSortedList === "function"
        ? getFilteredSortedList()
        : [];
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
      "imageUrl",
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
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
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
    URL.revokeObjectURL(url);
    showToast("Veriler CSV olarak yedeklendi", "success");
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÜNCELLEME YÖNETİCİSİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

if (window.electronAPI) {
  const updateBtn = document.getElementById("updateBtn");

  /* ─────────────────── Versiyon Gösterimi ─────────────────── */

  window.electronAPI.onAppVersion?.((version) => {
    const vEl = document.getElementById("versionDisplay");
    if (vEl) vEl.textContent = `v${version}`;
  });

  /* ─────────────────── Güncelleme Bulundu ─────────────────── */

  window.electronAPI.onUpdateAvailable?.((version) => {
    if (updateBtn) {
      updateBtn.classList.add("visible");
      updateBtn.style.display = "flex";
      updateBtn.innerText = `Güncelleme Mevcut v${version}`;
    }
  });

  /* ─────────────────── İndirme İlerlemesi ─────────────────── */

  window.electronAPI.onUpdateProgress?.((percent) => {
    if (!updateBtn) return;
    const p = Math.round(percent);
    if (p < 100) {
      updateBtn.innerText = `İndiriliyor: %${p}`;
    } else {
      updateBtn.innerText = `Kuruluyor...`;
      updateBtn.style.background = "var(--green, #10b981)";
      updateBtn.style.borderColor = "var(--green, #10b981)";
      updateBtn.style.color = "#fff";
    }
  });

  /* ─────────────────── İndirme Tamamlandı ─────────────────── */

  window.electronAPI.onUpdateDownloaded?.(() => {
    if (updateBtn) {
      updateBtn.innerText = "Yeniden Başlatılıyor...";
      updateBtn.style.background = "var(--green, #10b981)";
      updateBtn.style.borderColor = "var(--green, #10b981)";
      updateBtn.style.color = "#fff";
    }
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  window.electronAPI.onUpdateError?.(() => {
    if (updateBtn) {
      updateBtn.innerText = "Güncelleme Hatası";
      updateBtn.style.background = "var(--red, #ef4444)";
      updateBtn.style.borderColor = "var(--red, #ef4444)";
      updateBtn.style.color = "#fff";
      updateBtn.style.pointerEvents = "auto";
    }
  });

  /* ─────────────────── Güncelleme Butonu ─────────────────── */

  updateBtn?.addEventListener("click", () => {
    updateBtn.innerText = "Bağlanıyor...";
    updateBtn.style.pointerEvents = "none";
    window.electronAPI.launchUpdater();
  });
}
