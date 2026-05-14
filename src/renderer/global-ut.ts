/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GENEL AMAÇLI ARAÇ FONKSİYONLARI                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Türkçe Karakter Normalizasyonu ─────────────────── */

const _TR_MAP: Record<string, string> = {
  ı: "i",
  ğ: "g",
  ü: "u",
  ş: "s",
  ö: "o",
  ç: "c",
  İ: "i",
  Ğ: "g",
  Ü: "u",
  Ş: "s",
  Ö: "o",
  Ç: "c",
};

export function normalizeTr(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ığüşöçİĞÜŞÖÇ]/g, function (c) { return _TR_MAP[c] || c; });
}

/* ─────────────────── Karakter Kaçış ─────────────────── */

function escapeString(str: string): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const escHtml = escapeString;
export const escAttr = escapeString;

/* ─────────────────── Güvenli URL ─────────────────── */

export function escUrl(url: string): string {
  if (!url) return "";
  try {
    const p = new URL(url);
    if (p.protocol !== "http:" && p.protocol !== "https:") return "";
    return escAttr(p.toString());
  } catch (_) {
    return "";
  }
}

export function safeExternalUrl(value: string): string {
  if (!value) return "";
  var normalized = value.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = "https://" + normalized;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

/* ─────────────────── Para Birimi Formatlayıcı ─────────────────── */

export const CURRENCY_FORMAT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ─────────────────── Tarih Formatlayıcı ─────────────────── */

const _dateCache = new Map<string, string>();
const _DATECACHE_MAX = 50;

export const DATE_FORMAT = (dateString: string): string => {
  if (!dateString) return "-";
  if (_dateCache.has(dateString)) {
    const val = _dateCache.get(dateString)!;
    _dateCache.delete(dateString);
    _dateCache.set(dateString, val);
    return val;
  }
  const date = new Date(dateString);
  const result = isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("tr-TR");
  if (_dateCache.size >= _DATECACHE_MAX) {
    const firstKey = _dateCache.keys().next().value;
    if (firstKey !== undefined) _dateCache.delete(firstKey);
  }
  _dateCache.set(dateString, result);
  return result;
};

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return day + "." + month + "." + year + " " + hours + ":" + minutes;
}

/* ─────────────────── Zaman Farkı Formatlayıcı ─────────────────── */

export const POST_PHRASES = [
  "dedi ki;",
  "şöyle düşündü;",
  "demişti ki;",
  "fikrini paylaştı.",
  "artık içinde tutamadı ve şöyle dedi;",
  "böyle düşünmekteydi;",
  "tam olarak şundan bahsetti;",
  "bir düşünce geliştirmiş;",
  "bunu sadece kendisin bildiğini sanıyordu;",
  "tuvalette aklına bu düşünce geldi;",
  "bunun sadece düşüncede kalmamasını istedi.",
  "kediler yardımı ile şu fikre ulaştı;",
  "bunu söylerken hiç utanmadı.",
  "bir an bile düşünmeden şunu dedi;",
  "şöyle buyurdu;",
  "fikrini beyan etti;",
];

export function formatTimeAgo(
  timestamp: number,
  phraseIndex?: number,
  skipPhrase?: boolean,
): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let timeText = "az önce";
  if (minutes >= 1 && minutes < 60) timeText = minutes + " dakika önce";
  else if (hours >= 1 && hours < 24) timeText = hours + " saat önce";
  else if (days >= 1 && days < 7) timeText = days + " gün önce";
  else if (days >= 7 && days < 365)
    timeText = Math.floor(days / 7) + " hafta önce";
  else if (days >= 365) timeText = Math.floor(days / 365) + " yıl önce";

  if (skipPhrase) return timeText;
  const idx =
    phraseIndex !== undefined && phraseIndex !== null
      ? phraseIndex
      : 0;
  return timeText + " " + POST_PHRASES[idx];
}

/* ─────────────────── Fiyat Giriş Formatlama ─────────────────── */

export function applyPriceFormat(inputEl: HTMLInputElement): void {
  if (!inputEl) return;
  let value = inputEl.value.replace(/[^0-9,]/g, "");
  const parts = value.split(",");

  if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");

  if (value) {
    let [integerPart, decimalPart] = value.split(",");
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    inputEl.value =
      decimalPart !== undefined ? `${integerPart},${decimalPart}` : integerPart;
  } else {
    inputEl.value = "";
  }
}

/* ─────────────────── Tarih Giriş Parse ─────────────────── */

export function parseDateInput(raw: string): string {
  const parts = (raw || "").trim().split(/[./-]/);
  let result: string | undefined;
  if (parts.length === 3) {
    result =
      parts[0].length <= 2
        ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
        : raw.trim();
  }
  if (!result || isNaN(new Date(result).getTime())) {
    result = new Date().toISOString().split("T")[0];
  }
  return result;
}

/* ─────────────────── Fiyat Giriş Parse ─────────────────── */

export function parsePriceInput(value: string): number {
  return parseFloat((value || "").replace(/\./g, "").replace(",", ".")) || 0;
}

/* ─────────────────── Modal Durum Kontrolü ─────────────────── */

export function isAnyModalOpen(): boolean {
  return !!document.querySelector(".modal-overlay.active");
}

/* ─────────────────── Avatar Yardımcısı ─────────────────── */

export function getAvatarLetter(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}

/* ─────────────────── Nesne Fark Kontrolü ─────────────────── */

export function _onlyFieldChanged<T>(
  oldObj: T,
  newObj: T,
  fields: (keyof T)[],
): boolean {
  for (const field of fields) {
    if (oldObj[field] !== newObj[field]) return false;
  }
  return true;
}

export function _onlyCommentLikesChanged(
  oldComment: any,
  newComment: any,
): boolean {
  if (!oldComment || !newComment) return false;
  if (!_onlyFieldChanged(oldComment, newComment, ["text", "uid"])) return false;
  const oldRC = oldComment.replies ? Object.keys(oldComment.replies).length : 0;
  const newRC = newComment.replies ? Object.keys(newComment.replies).length : 0;
  if (oldRC !== newRC) return false;
  return true;
}

/* ─────────────────── Storage Klasör Temizleme ─────────────────── */

export async function deleteAllInFolder(ref: firebase.storage.StorageReference): Promise<void> {
  const list = await ref.listAll();
  const BATCH = 10;
  var batchPromises: Promise<any>[] = [];
  var totalItems = list.items.length;
  for (var bi = 0; bi < totalItems; bi += BATCH) {
    var slice = list.items.slice(bi, bi + BATCH);
    batchPromises.push(
      Promise.all(
        slice.map(function (item) { return item.delete(); }),
      ),
    );
  }
  var prefixPromises: Promise<any>[] = [];
  for (var pi = 0; pi < list.prefixes.length; pi++) {
    prefixPromises.push(deleteAllInFolder(list.prefixes[pi]));
  }
  await Promise.all(batchPromises.concat(prefixPromises));
}
