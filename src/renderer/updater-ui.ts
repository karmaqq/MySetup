/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     GÜNCELLEME ARAYÜZÜ YÖNETİMİ                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { showToast } from "./global-fn";

/* ─────────────────── Versiyon Gösterimi ─────────────────── */

const vEl = document.getElementById("versionDisplay");
if (typeof __IS_WEB__ !== "undefined" && __IS_WEB__) {
  if (vEl) vEl.textContent = "" + (typeof __APP_VERSION__ !== "undefined" ? "Web v" + __APP_VERSION__ : "");
} else if (window.electronAPI) {
  window.electronAPI.onAppVersion?.((version) => {
    if (vEl) vEl.textContent = "v" + version;
  });
}

/* ─────────────────── Electron Ortam Kontrolü ─────────────────── */

if (window.electronAPI) {
  const updateBtn = document.getElementById("updateBtn") as HTMLElement | null;
  const updateBtnSpan = updateBtn?.querySelector("span") as HTMLElement | null;
  let dotInterval: number | null = null;

  /* ─────────────────── Nokta Animasyonunu Başlat ─────────────────── */

  function startDotAnimation() {
    if (dotInterval) clearInterval(dotInterval);
    let step = 0;
    const steps = ["", ".", "..", "..."];

    if (updateBtnSpan) {
      let dotsEl = updateBtnSpan.querySelector(".update-dots") as HTMLElement | null;
      if (!dotsEl) {
        updateBtnSpan.textContent = "Yeniden Başlatılıyor";
        dotsEl = document.createElement("span");
        dotsEl.className = "update-dots";
        updateBtnSpan.appendChild(dotsEl);
      }

      dotInterval = window.setInterval(() => {
        if (dotsEl) dotsEl.textContent = steps[step % 4];
        step++;
      }, 250);
    }
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
    updateBtnSpan.textContent = "Yeniden Başlatılıyor";
    updateBtn.style.pointerEvents = "none";
    startDotAnimation();
    window.electronAPI.launchUpdater();
  });

  /* ─────────────────── Güncelleme Hatası ─────────────────── */

  window.electronAPI.onUpdateError?.((errMessage) => {
    if (!updateBtn || !updateBtnSpan) return;
    stopDotAnimation();
    updateBtn.classList.add("visible", "error");
    updateBtn.classList.remove("downloading", "ready");
    updateBtn.style.setProperty("--progress", "0%");
    updateBtnSpan.textContent = "Güncelleme Hatası";
    document.getElementById("userInfo")?.classList.remove("has-update");

    showToast(
      "Güncelleme başarısız: " + (errMessage || "Bilinmeyen hata"),
      "error",
      4000,
    );
  });

  /* ─────────────────── Güncelleme Butonu ─────────────────── */

  updateBtn?.addEventListener("click", () => {
    if (!updateBtnSpan) return;
    stopDotAnimation();
    if (updateBtn.classList.contains("ready")) {
      updateBtnSpan.textContent = "Yeniden Başlatılıyor";
      updateBtn.style.pointerEvents = "none";
      startDotAnimation();
      window.electronAPI.launchUpdater();
    } else {
      updateBtnSpan.textContent = "Bağlanıyor...";
      updateBtn.style.pointerEvents = "none";
      updateBtn.style.setProperty("--progress", "0%");
      window.electronAPI.launchUpdater();
    }
  });
}
