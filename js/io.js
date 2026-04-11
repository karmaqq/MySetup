/* ─── TOAST SİSTEMİ ──────────────────────────────────────────────────────────── */
function showToast(message, type = "info", duration = 3200) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { success: "✓", error: "✕", warn: "⚠", info: "i" };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "i"}</span><span>${message}</span>`;
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
}

function showConfirm(message, onConfirm) {
  const toast = document.createElement("div");
  toast.className = "toast toast-confirm";
  toast.innerHTML = `<span>${message}</span><div class="toast-actions"><button class="toast-yes">Evet, Sil</button><button class="toast-no">İptal</button></div>`;
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
  toast.querySelector(".toast-yes").onclick = () => {
    dismiss();
    onConfirm();
  };
  toast.querySelector(".toast-no").onclick = dismiss;
}

/* ─── CSV DIŞA AKTAR ─────────────────────────────────────────────────────────── */
// getFilteredSortedList() → table.js'de tanımlı; buton tıklandığında çağrılır.
function exportCSV() {
  const list = getFilteredSortedList();
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
    "Link",
  ];

  const rows = list.map((i) =>
    [
      i.date,
      i.component,
      i.brand,
      i.specs,
      i.price,
      i.vendor,
      i.status,
      i.url || "",
    ]
      .map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mysetup_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${list.length} kayıt dışa aktarıldı`, "success");
}

/* ─── CSV İÇE AKTAR ──────────────────────────────────────────────────────────── */
function processCsv(csv) {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length < 2) return;

  showConfirm("Veriler sıfırlanacak. Onaylıyor musunuz?", () => {
    dataRef.remove().then(() => {
      let importCount = 0;
      lines.slice(1).forEach((line) => {
        const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
        let cols = line.match(regex) || [];
        if (cols.length === 0) cols = line.split(",");

        cols = cols.map((c) =>
          c.replace(/^"|"$/g, "").replace(/""/g, '"').trim(),
        );

        if (cols.length >= 7) {
          let rawPrice = cols[4].replace(/[^\d.,]/g, "");
          if (rawPrice.includes(",") && rawPrice.includes(".")) {
            rawPrice = rawPrice.replace(/\./g, "").replace(",", ".");
          } else if (rawPrice.includes(",")) {
            rawPrice = rawPrice.replace(",", ".");
          }

          const newItem = {
            date: cols[0] || new Date().toISOString().split("T")[0],
            component: cols[1] || "-",
            brand: cols[2] || "-",
            specs: cols[3] || "-",
            price: parseFloat(rawPrice) || 0,
            vendor: cols[5] || "-",
            status: (cols[6] || "saglikli").toLowerCase(),
            url: cols[7] || "",
          };
          dataRef.push(newItem);
          importCount++;
        }
      });
      showToast(`${importCount} kayıt başarıyla yüklendi.`, "success");
    });
  });
}

/* ─── CSV UI TETİKLEYİCİLERİ ────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importCsvInput = document.getElementById("importCsvInput");

  if (exportBtn) exportBtn.onclick = exportCSV;

  if (importBtn && importCsvInput) {
    importBtn.onclick = () => importCsvInput.click();
    importCsvInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => processCsv(ev.target.result);
      reader.readAsText(file);
      importCsvInput.value = "";
    };
  }
});

/* ─── GÜNCELLEME SİSTEMİ (IPC) ──────────────────────────────────────────────── */
if (ipcRenderer) {
  ipcRenderer.on("app_version", (event, version) => {
    if (versionDisplay) versionDisplay.innerText = `v${version}`;
  });

  // Sadece güncelleme bulunduğunda tetiklenir
  ipcRenderer.on("update_available", (event, version) => {
    if (!updateBtn) return;

    updateBtn.style.display = "flex";
    updateBtn.style.pointerEvents = "auto";
    updateBtn.innerHTML = `Güncelleme Mevcut`;

    updateBtn.onclick = () => {
      // 1. Butonu kilitle ve yazıyı değiştir
      updateBtn.innerHTML = "Güncelleme Yükleniyor...";
      updateBtn.style.pointerEvents = "none";
      updateBtn.style.color = "var(--text-dim)";

      // 2. Arka planda indirmeyi başlat (bittiğinde main.js programı kapatacak)
      ipcRenderer.send("start_download");
    };
  });

  // Hata durumunda butonu eski haline getir
  ipcRenderer.on("update_error", () => {
    if (updateBtn && updateBtn.style.display === "flex") {
      updateBtn.innerHTML = "Güncelleme Başarısız";
      updateBtn.style.pointerEvents = "auto";
      updateBtn.style.color = "var(--red)";
    }
  });
}
