/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GİRDİ / ÇIKTI İŞLEMLERİ                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           BİLDİRİM SİSTEMİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Toast Bildirimi Gösterme ─────────────────── */

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

/* ─────────────────── Onay Diyalogu Gösterme ─────────────────── */

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

const importCsvBtn = document.getElementById("importCsvBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importCsvInput = document.getElementById("importCsvInput");

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           CSV İÇE AKTARMA                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                        ELECTRON GÜNCELLEMELERİ                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

if (electronAPI) {
  electronAPI.onAppVersion((version) => {
    if (versionDisplay) versionDisplay.innerText = `v${version}`;
  });

  /* ─── Loading ekranı elemanları ─── */
  const authLoading = document.getElementById("authLoading");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const updateRingWrapper = document.getElementById("updateRingWrapper");
  const updateRingProgress = document.getElementById("updateRingProgress");
  const updateRingPercent = document.getElementById("updateRingPercent");
  const updateSteps = document.getElementById("updateSteps");
  const stepDownloadLabel = document.getElementById("stepDownloadLabel");
  const CIRCUMFERENCE = 2 * Math.PI * 52;

  let currentStep = 0;

  function showUpdateScreen() {
    if (authLoading) {
      authLoading.style.display = "";
      authLoading.style.opacity = "1";
      authLoading.style.transition = "none";
    }
    if (loadingSpinner) loadingSpinner.classList.add("hidden");
    if (updateRingWrapper) updateRingWrapper.classList.add("active");
    if (updateSteps) updateSteps.classList.add("active");
  }

  function setProgress(percent) {
    if (updateRingProgress) {
      const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
      updateRingProgress.style.strokeDashoffset = offset;
    }
    if (updateRingPercent) updateRingPercent.textContent = `${percent}%`;
  }

  function goToStep(stepNum) {
    if (!updateSteps || stepNum <= currentStep) return;
    const allSteps = updateSteps.querySelectorAll(".update-step");

    if (currentStep > 0) {
      const prev = updateSteps.querySelector(`[data-step="${currentStep}"]`);
      if (prev) {
        prev.classList.remove("active");
        prev.classList.add("done");
        setTimeout(() => prev.classList.add("exiting"), 300);
      }
    }

    currentStep = stepNum;

    setTimeout(
      () => {
        const next = updateSteps.querySelector(`[data-step="${stepNum}"]`);
        if (next) next.classList.add("active");
      },
      currentStep === 1 ? 0 : 350,
    );
  }

  /* ─── Otomatik güncelleme ayarı ─── */
  const autoUpdateCheckbox = document.getElementById("autoUpdateCheckbox");
  const isAutoUpdate = () => localStorage.getItem("autoUpdate") === "true";

  if (autoUpdateCheckbox) {
    autoUpdateCheckbox.checked = isAutoUpdate();
    autoUpdateCheckbox.addEventListener("change", () => {
      const enabled = autoUpdateCheckbox.checked;
      localStorage.setItem("autoUpdate", String(enabled));
      if (electronAPI.setAutoUpdate) electronAPI.setAutoUpdate(enabled);
    });
  }

  if (electronAPI.setAutoUpdate) {
    electronAPI.setAutoUpdate(isAutoUpdate());
  }

  /* ─── Güncelleme mevcut → header simge veya otomatik indir ─── */
  electronAPI.onUpdateAvailable((version) => {
    if (stepDownloadLabel) {
      stepDownloadLabel.innerHTML = `v${version} indiriliyor<span class="step-dots"></span>`;
    }

    if (isAutoUpdate()) {
      showUpdateScreen();
      goToStep(1);
      setProgress(0);
      setTimeout(() => {
        goToStep(2);
        electronAPI.startDownload();
      }, 1200);
      return;
    }

    if (!updateBtn) return;
    updateBtn.classList.add("visible");
    updateBtn.title = `Güncelleme Mevcut (v${version})`;

    updateBtn.onclick = () => {
      updateBtn.classList.remove("visible");
      showUpdateScreen();
      goToStep(1);
      setProgress(0);

      setTimeout(() => {
        goToStep(2);
        electronAPI.startDownload();
      }, 1200);
    };
  });

  /* ─── İndirme ilerlemesi ─── */
  if (typeof electronAPI.onUpdateProgress === "function") {
    electronAPI.onUpdateProgress((percent) => {
      setProgress(percent);
    });
  }

  /* ─── İndirme tamamlandı ─── */
  if (typeof electronAPI.onUpdateReady === "function") {
    electronAPI.onUpdateReady(() => {
      setProgress(100);
      goToStep(3);

      setTimeout(() => {
        goToStep(4);
      }, 1200);
    });
  }

  /* ─── Hata → geri dön ─── */
  electronAPI.onUpdateError(() => {
    if (updateRingWrapper) updateRingWrapper.classList.remove("active");
    if (updateSteps) updateSteps.classList.remove("active");
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");

    if (updateSteps) {
      updateSteps.querySelectorAll(".update-step").forEach((s) => {
        s.classList.remove("active", "done", "exiting");
      });
    }
    currentStep = 0;

    /* Güncelleme ekranı açıksa kapat, değilse dokunma */
    if (authLoading && authLoading.style.display !== "none") {
      if (typeof showToast === "function") {
        showToast("Güncelleme hatası oluştu", "error", 4000);
      }
      setTimeout(() => {
        if (authLoading) authLoading.style.display = "none";
      }, 2000);
    }
  });
}
