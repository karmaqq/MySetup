/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BİLDİRİM SİSTEMİ VE IO                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

import {
  toastContainer,
  searchInput,
  clearSearch,
  currentSearch,
  setCurrentSearch,
  setCurrentStatusFilter,
  allData,
  safeExternalUrl,
  scheduleRender,
} from "./utils";
import { getFilteredSortedList } from "./table";
import {
  deletePostFromFirebase,
  deleteCommentFromFirebase,
  deleteReplyFromFirebase,
} from "./firebase-post";
import { replaceUserDataInFirebase } from "./firebase-inv";
import { db } from "./firebase-init";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BİLDİRİM SİSTEMİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Toast Bildirimi Göster ─────────────────── */

export function showToast(message: string, type: string = "info", duration: number = 3200): void {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons: Record<string, string> = { success: "✓", error: "✕", warn: "⚠", info: "i" };
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
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ONAY DİYALOĞU                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function showConfirm(message: string, onConfirm: () => void, opts?: { yesText?: string; noText?: string }): void {
  if (!toastContainer) return;
  const existing = toastContainer.querySelector(".toast-confirm");
  if (existing) {
    existing.classList.remove("visible");
    existing.remove();
  }
  const yesText = (opts && opts.yesText) || "Evet, Devam Et";
  const noText = (opts && opts.noText) || "İptal";
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
  }

  const autoTimeout = setTimeout(_dismissConfirm, 15000);

  yesBtn.onclick = () => {
    _dismissConfirm();
    onConfirm();
  };
  noBtn.onclick = _dismissConfirm;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SİLME İŞLEMLERİ                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Genel silme onayı (post/yorum/yanıt) ─────────────────── */

function _confirmDelete(type: string, ids: Record<string, string>): void {
  const messages: Record<string, string> = {
    post: "Bu gönderiyi silmek istediğine emin misin?",
    comment: "Yorum silinsin mi?",
    reply: "Yanıt silinsin mi?",
  };
  const successMessages: Record<string, string> = {
    post: "Gönderi silindi",
    comment: "Yorum silindi",
    reply: "Yanıt silindi",
  };
  const fns: Record<string, () => Promise<any>> = {
    post: function () {
      const allPostsGlobal = (window as any).allPosts || {};
      return deletePostFromFirebase(ids.postId, allPostsGlobal[ids.postId]);
    },
    comment: function () {
      return deleteCommentFromFirebase(ids.postId, ids.commentId);
    },
    reply: function () {
      return deleteReplyFromFirebase(ids.postId, ids.commentId, ids.replyId);
    },
  };
  showConfirm(messages[type], function () {
    let animEl: HTMLElement | null = null;
    if (type === "comment") {
      animEl = document.getElementById(
        "commentThread-" + ids.postId + "-" + ids.commentId,
      );
    } else if (type === "reply") {
      animEl = document.querySelector('[data-reply-id="' + ids.replyId + '"]') as HTMLElement | null;
    }
    if (animEl) {
      animEl.style.transition = "opacity 0.3s, transform 0.3s";
      animEl.style.opacity = "0";
      animEl.style.transform = "translateY(4px)";
    }
    fns[type]()
      .then(function () {
        if (animEl)
          setTimeout(function () {
            animEl!.remove();
          }, 320);
        showToast(successMessages[type], "success");
      })
      .catch(function () {
        if (animEl) {
          animEl.style.opacity = "1";
          animEl.style.transform = "translateY(0)";
        }
        showToast("Silinemedi", "error");
      });
  });
}

/* Dışa aktarılan silme onay fonksiyonları */
export const _confirmDeletePost = (postId: string) => _confirmDelete("post", { postId });
export const _confirmDeleteComment = (postId: string, commentId: string) => _confirmDelete("comment", { postId, commentId });
export const _confirmDeleteReply = (postId: string, commentId: string, replyId: string) => _confirmDelete("reply", { postId, commentId, replyId });

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ARAMA VE FİLTRELEME                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Arama Alanı Dinleyicisi ─────────────────── */

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

/* ─────────────────── Filtre Butonları Dinleyicisi ─────────────────── */

const filterBtns = document.querySelectorAll(".filter-btn");
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setCurrentStatusFilter((btn as HTMLElement).dataset.status || "all");
    scheduleRender();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV İÇE AKTARMA                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
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

function processCsv(csvText: string): void {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    showToast("CSV dosyası boş veya geçersiz", "error");
    return;
  }

  const dataLines = lines.slice(1);
  const importPayload: Record<string, any> = {};

  dataLines.forEach((line) => {
    const row = parseCsvLine(line);
    if (row.length < 2 || !row[1]) return;

    const entryId = db.database?.ref(db.activeBasePath!).push().key;
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
      try {
        await replaceUserDataInFirebase(importPayload);
        showToast(`${importCount} kayıt sıfırdan yüklendi.`, "success");
        scheduleRender();
      } catch (_) {
        showToast("CSV aktarımı tamamlanamadı", "error");
      }
    },
  );
}

/* ─────────────────── CSV Dosya Seçici Dinleyicisi ─────────────────── */

const importCsvBtn = document.getElementById("importCsvBtn") as HTMLElement | null;
const importCsvInput = document.getElementById("importCsvInput") as HTMLInputElement | null;

if (importCsvBtn && importCsvInput) {
  importCsvBtn.addEventListener("click", () => importCsvInput.click());
  importCsvInput.addEventListener("change", (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processCsv((ev.target as any).result as string);
    reader.readAsText(file, "UTF-8");
    importCsvInput.value = "";
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV DIŞA AKTARMA                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

const exportCsvBtn = document.getElementById("exportCsvBtn") as HTMLElement | null;

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    const list: any[] = getFilteredSortedList();
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
          .map(
            (v) =>
              `"${String(v)
                .replace(/"/g, '""')
                .replace(/[\r\n]/g, " ")}"`,
          )
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

const deleteAllBtn = document.getElementById("deleteAllBtn") as HTMLElement | null;

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
        replaceUserDataInFirebase({})
          .then(() => {
            showToast("Tüm kayıtlar silindi", "success");
          })
          .catch(() => {
            showToast("Silme işlemi tamamlanamadı", "error");
          });
      },
      { yesText: "Onay" },
    );
  });
}
