/*--- zorunlu - agents.md yorum kurallarına uy ---*/

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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAMA VE FİLTRELEME                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Arama Alanı Dinleyicisi ─────────────────── */

if (searchInput && clearSearch) {
  let _searchDebounce = null;

  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value;
    clearSearch.classList.toggle("visible", !!currentSearch);
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      if (typeof renderAll === "function") renderAll();
    }, 180);
  });

  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    currentSearch = "";
    clearTimeout(_searchDebounce);
    clearSearch.classList.remove("visible");
    if (typeof renderAll === "function") renderAll();
    searchInput.focus();
  });
}

/* ─────────────────── Arama Klavye Kısayolu ─────────────────── */

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const tag = document.activeElement.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      if (typeof searchInput !== "undefined" && searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }
});

/* ─────────────────── Filtre Butonları Dinleyicisi ─────────────────── */

const filterBtns = document.querySelectorAll(".filter-btn");
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    if (typeof renderAll === "function") renderAll();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SİLME İŞLEMLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Post silme onayı ─────────────────── */

function _confirmDeletePost(postId) {
  var postData = allPosts[postId];
  showConfirm("Bu gönderiyi silmek istediğine emin misin?", function () {
    deletePostFromFirebase(postId, postData)
      .then(function () {
        showToast("Gönderi silindi.", "success");
      })
      .catch(function () {
        showToast("Gönderi silinemedi.", "error");
      });
  });
}

/* ─────────────────── Yorum silme onayı ─────────────────── */

function _confirmDeleteComment(postId, commentId) {
  showConfirm("Yorum silinsin mi?", function () {
    const thread = document.getElementById(
      "commentThread-" + postId + "-" + commentId,
    );
    if (thread) {
      thread.style.transition = "opacity 0.3s, transform 0.3s";
      thread.style.opacity = "0";
      thread.style.transform = "translateY(4px)";
      setTimeout(function () {
        thread.remove();
      }, 320);
    }
    deleteCommentFromFirebase(postId, commentId)
      .then(function () {
        showToast("Yorum silindi.", "success");
      })
      .catch(function () {
        showToast("Yorum silinemedi.", "error");
        if (thread) {
          thread.style.opacity = "1";
          thread.style.transform = "translateY(0)";
        }
      });
  });
}

/* ─────────────────── Yanıt silme onayı ─────────────────── */

function _confirmDeleteReply(postId, commentId, replyId) {
  showConfirm("Yanıt silinsin mi?", function () {
    const replyEl = document.querySelector(
      '[data-reply-id="' + replyId + '"]',
    );
    if (replyEl) {
      replyEl.style.transition = "opacity 0.3s, transform 0.3s";
      replyEl.style.opacity = "0";
      replyEl.style.transform = "translateY(4px)";
      setTimeout(function () {
        replyEl.remove();
      }, 320);
    }
    deleteReplyFromFirebase(postId, commentId, replyId)
      .then(function () {
        showToast("Yanıt silindi.", "success");
      })
      .catch(function () {
        showToast("Yanıt silinemedi.", "error");
        if (replyEl) {
          replyEl.style.opacity = "1";
          replyEl.style.transform = "translateY(0)";
        }
      });
   });
}

/* ─────────────────── CSV İşleme ─────────────────── */

function parseCsvLine(line) {
  var result = [];
  var inQuote = false;
  var current = "";
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
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

function processCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    showToast("CSV dosyası boş veya geçersiz", "error");
    return;
  }

  const getNewKey = () => {
    if (typeof database === "undefined" || !activeBasePath) return null;
    return database.ref(activeBasePath).push().key;
  };

  const dataLines = lines.slice(1);
  const importPayload = {};

  dataLines.forEach((line) => {
    const row = parseCsvLine(line);
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
      if (typeof replaceUserDataInFirebase !== "function") {
        showToast("Aktif kullanıcı verisi bulunamadı", "error");
        return;
      }
      try {
        await replaceUserDataInFirebase(importPayload);
        showToast(`${importCount} kayıt sıfırdan yüklendi.`, "success");
        if (typeof renderAll === "function") renderAll();
      } catch (_) {
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
    reader.readAsText(file, "UTF-8");
    importCsvInput.value = "";
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV DIŞA AKTARMA                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Dışa Aktarma Dinleyicisi ─────────────────── */

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
          .map((v) => `"${String(v).replace(/"/g, '""').replace(/[\r\n]/g, ' ')}"`)
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
/*                          TÜM LİSTEYİ SİL                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Silme Onay Diyaloğu ─────────────────── */

window.showConfirm = function (message, onConfirm, opts) {
  if (!toastContainer) return;
  var yesText = (opts && opts.yesText) || "Evet, Devam Et";
  var noText = (opts && opts.noText) || "İptal";
  const toast = document.createElement("div");
  toast.className = "toast toast-confirm";
  const text = document.createElement("div");
  const actions = document.createElement("div");
  const yesBtn = document.createElement("button");
  const noBtn = document.createElement("button");

  text.textContent = message;
  actions.className = "toast-actions";
  yesBtn.className = "toast-yes";
  noBtn.className = "toast-no";
  yesBtn.type = "button";
  noBtn.type = "button";
  yesBtn.textContent = yesText;
  noBtn.textContent = noText;
  actions.append(yesBtn, noBtn);
  toast.append(text, actions);
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  function _dismissConfirm() {
    if (autoTimeout) clearTimeout(autoTimeout);
    toast.classList.remove("visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };

  const autoTimeout = setTimeout(_dismissConfirm, 15000);

  yesBtn.onclick = () => {
    _dismissConfirm();
    onConfirm();
  };
  noBtn.onclick = _dismissConfirm;
};

const deleteAllBtn = document.getElementById("deleteAllBtn");

if (deleteAllBtn) {
  deleteAllBtn.addEventListener("click", () => {
    const itemCount = Object.keys(allData).length;
    if (!itemCount) {
      showToast("Silinecek kayıt bulunamadı", "warn");
      return;
    }

    showConfirm(
      "Tüm verileri gerçekten silmek istiyor musunuz?",
      () => {
        if (typeof replaceUserDataInFirebase !== "function") {
          showToast("İşlem yapılamadı", "error");
          return;
        }
        replaceUserDataInFirebase({})
          .then(() => {
            showToast("Tüm kayıtlar silindi", "success");
          })
          .catch(() => {
            showToast("Silme işlemi tamamlanamadı", "error");
          });
      },
      { yesText: "Onay" }
    );
  });
}
