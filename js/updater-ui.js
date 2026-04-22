/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     GÜNCELLEME ARAYÜZÜ YÖNETİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Electron Ortam Kontrolü ─────────────────── */

if (window.electronAPI) {
  const updateBtn = document.getElementById("updateBtn");

  /* ─────────────────── Versiyon Gösterimi ─────────────────── */

  window.electronAPI.onAppVersion?.((version) => {
    const vEl = document.getElementById("versionDisplay");
    if (vEl) vEl.textContent = `v${version}`;
  });

  /* ─────────────────── Güncelleme Bulundu ─────────────────── */

  window.electronAPI.onUpdateAvailable?.((version) => {
    if (!updateBtn) return;
    updateBtn.classList.add("visible");
    updateBtn.style.display = "flex";
    updateBtn.innerText = `Güncelleme Mevcut v${version}`;
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
    if (!updateBtn) return;
    updateBtn.innerText = "Yeniden Başlatılıyor...";
    updateBtn.style.background = "var(--green, #10b981)";
    updateBtn.style.borderColor = "var(--green, #10b981)";
    updateBtn.style.color = "#fff";
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  window.electronAPI.onUpdateError?.((errMessage) => {
    // errMessage parametresi eklendi
    if (!updateBtn) return;
    updateBtn.innerText = "Güncelleme Hatası";
    updateBtn.style.background = "var(--red, #ef4444)";
    updateBtn.style.borderColor = "var(--red, #ef4444)";
    updateBtn.style.color = "#fff";
    updateBtn.style.pointerEvents = "auto";

    if (typeof showToast === "function") {
      showToast(
        "Güncelleme başarısız: " + (errMessage || "Bilinmeyen hata"),
        "error",
        4000,
      );
    }
  });

  /* ─────────────────── Güncelleme Butonu ─────────────────── */

  updateBtn?.addEventListener("click", () => {
    updateBtn.innerText = "Bağlanıyor...";
    updateBtn.style.pointerEvents = "none";
    window.electronAPI.launchUpdater();
  });
}
