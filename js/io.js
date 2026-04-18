/* show toast fonksiyon basligi */

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

/* show confirm fonksiyon basligi */

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

  /* onclick fonksiyon basligi */

  yesBtn.onclick = () => {
    dismiss();
    onConfirm();
  };
  noBtn.onclick = dismiss;
};

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

const importCsvBtn = document.getElementById("importCsvBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importCsvInput = document.getElementById("importCsvInput");

/* process csv fonksiyon basligi */

function processCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    showToast("CSV dosyası boş veya geçersiz", "error");
    return;
  }

  /* ─── KRİTİK DÜZELTME: userDataRef null olsa bile key üretilebilmeli ──────── */
  /* Orijinal kodda: userDataRef.push().key kullanılıyordu.                      */
  /* userDataRef henüz null ise (init tamamlanmamışsa) tüm satırlar atlanır,     */
  /* CSV import başarısız görünmez ama hiçbir şey aktarılmaz.                    */
  /* Düzeltme: activeBasePath'ten türetilen bir ref kullan;                      */
  /* o da yoksa database kökünden geçici bir key üret (veri yazmaz, key üretir). */
  const getNewKey = () => {
    if (typeof database === "undefined") return null;
    if (typeof activeBasePath !== "undefined" && activeBasePath) {
      return database.ref(activeBasePath).push().key;
    }
    /* activeBasePath yoksa database kökünden key üret - bu sadece ID, write değil */
    return database.ref().push().key;
  };

  const dataLines = lines.slice(1);
  const importPayload = {};

  dataLines.forEach((line) => {
    const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!match) return;

    const row = match.map((value) => value.replace(/^"|"$/g, "").trim());
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
        /* ─── KRİTİK DÜZELTME: allData'yı elle ATAMA ─────────────────────────── */
        /* Orijinal kodda: allData = importPayload yapılıyordu.                   */
        /* Bu, on("value") listener'ının Firebase'den dönecek güncel veriyle      */
        /* çakışmasına ve race condition'a yol açıyordu.                          */
        /* Düzeltme: listener zaten tetiklenecek ve allData'yı güncelleyecek.     */
        /* Elle atama kaldırıldı. Sadece başarı bildirimi göster.                 */
        showToast(`${importCount} kayıt sıfırdan yüklendi.`, "success");
      } catch (_error) {
        showToast("CSV aktarımı tamamlanamadı", "error");
      }
    },
  );
}

if (importCsvBtn && importCsvInput) {
  importCsvBtn.addEventListener("click", () => importCsvInput.click());
  importCsvInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    /* onload fonksiyon basligi */

    reader.onload = (ev) => processCsv(ev.target.result);
    reader.readAsText(file);
    importCsvInput.value = "";
  });
}

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

if (electronAPI) {
  electronAPI.onAppVersion((version) => {
    if (versionDisplay) versionDisplay.innerText = `v${version}`;
  });

  electronAPI.onUpdateAvailable((version) => {
    if (!updateBtn) return;

    updateBtn.classList.add("visible");
    updateBtn.style.pointerEvents = "auto";
    updateBtn.textContent = `🟨 Güncelleme Mevcut (v${version})`;

    /* onclick fonksiyon basligi */

    updateBtn.onclick = () => {
      /* Butona basıldıktan sonra her şey otomatik - dialog yok, onay yok */
      updateBtn.textContent = "⏳ İndiriliyor... 0%";
      updateBtn.style.pointerEvents = "none";
      updateBtn.style.color = "var(--text-dim)";
      electronAPI.startDownload();
    };
  });

  /* indirme ilerlemesini butonda göster */
  if (typeof electronAPI.onUpdateProgress === "function") {
    electronAPI.onUpdateProgress((percent) => {
      if (!updateBtn) return;
      updateBtn.textContent = `⏳ İndiriliyor... ${percent}%`;
    });
  }

  /* indirme bitti, kurulum başlıyor bildirimi */
  if (typeof electronAPI.onUpdateReady === "function") {
    electronAPI.onUpdateReady(() => {
      if (!updateBtn) return;
      updateBtn.textContent = "✅ Kuruluyor, yeniden başlıyor...";
      updateBtn.style.color = "var(--green)";
    });
  }

  electronAPI.onUpdateError(() => {
    if (updateBtn) {
      updateBtn.textContent = "❌ Güncelleme Hatası";
      updateBtn.style.color = "var(--red)";
      updateBtn.style.pointerEvents = "auto";
    }
  });
}
