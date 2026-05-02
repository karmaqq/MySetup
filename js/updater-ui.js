/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     GÜNCELLEME ARAYÜZÜ YÖNETİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Electron Ortam Kontrolü ─────────────────── */

if (window.electronAPI) {
  const updateBtn = document.getElementById("updateBtn");
  const updateBtnSpan = updateBtn?.querySelector("span");
  let dotInterval = null;

  /* ─────────────────── Versiyon Gösterimi ─────────────────── */

  window.electronAPI.onAppVersion?.((version) => {
    const vEl = document.getElementById("versionDisplay");
    if (vEl) vEl.textContent = `v${version}`;
  });

  /* ─────────────────── Nokta Animasyonunu Başlat ─────────────────── */

  function startDotAnimation() {
    if (dotInterval) clearInterval(dotInterval);
    let step = 0;
    const steps = ["", ".", "..", "..."];
    dotInterval = setInterval(() => {
      if (updateBtnSpan) {
        updateBtnSpan.textContent = `Yeniden Başlatılıyor${steps[step % 4]}`;
      }
      step++;
    }, 250);
  }

  /* ─────────────────── Nokta Animasyonunu Durdur ─────────────────── */

  function stopDotAnimation() {
    if (dotInterval) {
      clearInterval(dotInterval);
      dotInterval = null;
    }
  }

  /* ─────────────────── Güncelleme Bulundu ─────────────────── */

  window.electronAPI.onUpdateAvailable?.((version) => {
    if (!updateBtn || !updateBtnSpan) return;
    updateBtn.classList.add("visible");
    updateBtnSpan.textContent = `Güncelleme Mevcut v${version}`;
    updateBtn.style.setProperty("--progress", "0%");
  });

  /* ─────────────────── İndirme İlerlemesi ─────────────────── */

  window.electronAPI.onUpdateProgress?.((percent) => {
    if (!updateBtn || !updateBtnSpan) return;
    updateBtn.classList.add("visible", "downloading");
    updateBtn.classList.remove("ready");
    const p = Math.round(percent);
    updateBtn.style.setProperty("--progress", `${p}%`);
    updateBtnSpan.textContent = `İndiriliyor %${p}`;
  });

  /* ─────────────────── İndirme Tamamlandı ─────────────────── */

  window.electronAPI.onUpdateDownloaded?.(() => {
    if (!updateBtn || !updateBtnSpan) return;
    updateBtn.classList.add("visible", "ready");
    updateBtn.classList.remove("downloading");
    updateBtn.style.setProperty("--progress", "100%");
    startDotAnimation();
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  window.electronAPI.onUpdateError?.((errMessage) => {
    if (!updateBtn || !updateBtnSpan) return;
    stopDotAnimation();
    updateBtn.classList.add("visible");
    updateBtn.classList.remove("downloading", "ready");
    updateBtn.style.setProperty("--progress", "0%");
    updateBtn.style.background = "var(--red, #ef4444)";
    updateBtn.style.borderColor = "var(--red, #ef4444)";
    updateBtn.style.color = "#fff";
    updateBtn.style.pointerEvents = "auto";
    updateBtnSpan.textContent = "Güncelleme Hatası";
    document.getElementById("userInfo")?.classList.remove("has-update");

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
    if (!updateBtnSpan) return;
    stopDotAnimation();
    updateBtnSpan.textContent = "Bağlanıyor...";
    updateBtn.style.pointerEvents = "none";
    updateBtn.style.setProperty("--progress", "0%");
    window.electronAPI.launchUpdater();
  });
}
