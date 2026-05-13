/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CSV İÇERİ / DIŞARI AKTARMA                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { safeExternalUrl } from "./global-ut";
import { showToast, showConfirm, scheduleRender } from "./global-fn";
import { allData } from "./app-state";
import { db } from "./firebase-init";
import { replaceUserDataInFirebase } from "./firebase-inv";
import { getFilteredSortedList } from "./table";

/* ─────────────────── CSV Satır Parse ─────────────────── */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
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

/* ─────────────────── CSV Dosyasını İşle ─────────────────── */

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

    const entryId = db.userDataRef!.push().key!;
    importPayload[entryId] = {
      date: row[0] || new Date().toISOString().split("T")[0],
      component: row[1],
      brand: row[2] || "-",
      specs: row[3] || "-",
      price: parseFloat((row[4] || "").replace(/[^0-9.]/g, "")) || 0,
      vendor: row[5] || "-",
      status: row[6] || "sağlıklı",
      url: safeExternalUrl(row[7]),
      imageUrl: "",
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
        // 1. Race condition önlemi — allData anlık kopyası
        var dataSnapshot = Object.assign({}, allData);
        var deleteOldImages = Object.values(dataSnapshot)
          .filter((item: any) => item.imageUrl)
          .map((item: any) =>
            firebase.storage().refFromURL(item.imageUrl).delete().catch(() => {}),
          );
        await Promise.all(deleteOldImages);
        await replaceUserDataInFirebase(importPayload);
        showToast(`${importCount} kayıt sıfırdan yüklendi.`, "success");
        scheduleRender();
      } catch (_) {
        showToast("CSV aktarımı tamamlanamadı", "error");
      }
    },
  );
}

/* ─────────────────── CSV Dosya Seçici ─────────────────── */

const importCsvBtn = document.getElementById(
  "importCsvBtn",
) as HTMLElement | null;
const importCsvInput = document.getElementById(
  "importCsvInput",
) as HTMLInputElement | null;

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
/*                          CSV DIŞA AKTARMA                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

const exportCsvBtn = document.getElementById(
  "exportCsvBtn",
) as HTMLElement | null;

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    const list: any[] = getFilteredSortedList();
    if (!list.length) {
      showToast("Dışa aktarılacak veri yok", "warn");
      return;
    }

    const headers = [
      "Tarih", "Bileşen", "Marka", "Özellikler", "Fiyat",
      "Satıcı", "Durum", "URL", "GörselURL", "Puan", "Görüş",
    ];

    const csvContent = [
      headers.join(","),
      ...list.map((item) =>
        [
          item.date || "", item.component || "", item.brand || "-",
          item.specs || "-", item.price || "0", item.vendor || "-",
          item.status || "sağlıklı", item.url || "", item.imageUrl || "",
          item.star || 0, item.opinion || "-",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""').replace(/[\r\n]/g, " ")}"`)
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
/*                          TÜM LİSTEYİ SİL                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

const deleteAllBtn = document.getElementById(
  "deleteAllBtn",
) as HTMLElement | null;

if (deleteAllBtn) {
  deleteAllBtn.addEventListener("click", () => {
    const itemCount = Object.keys(allData).length;
    if (!itemCount) {
      showToast("Silinecek kayıt bulunamadı", "warn");
      return;
    }

    showConfirm(
      "Tüm verileri gerçekten silmek istiyor musunuz?",
      async () => {
        try {
          // 1. Race condition önlemi — allData anlık kopyası
          var dataSnapshot = Object.assign({}, allData);
          var deleteOldImages = Object.values(dataSnapshot)
            .filter((item: any) => item.imageUrl)
            .map((item: any) =>
              firebase.storage().refFromURL(item.imageUrl).delete().catch(() => {}),
            );
          await Promise.all(deleteOldImages);
          await replaceUserDataInFirebase({});
          showToast("Tüm kayıtlar silindi", "success");
        } catch (_) {
          showToast("Silme işlemi tamamlanamadı", "error");
        }
      },
      { yesText: "Onay" },
    );
  });
}
