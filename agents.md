# AGENTS.md

## Zorunlu Kısıtlamalar

- **Bundler yok.** Renderer tarafında `import`/`export`/`require` yasak. Sadece `main.js`, `preload.js`, `js/updater.js` Node ortamında çalışır.
- **Script yükleme sırası kesinlikle korunmalı:** `utils.js → firebase.js → connect.js → table.js → io.js → updater-ui.js → editmodal.js → auth.js → userset.js`
- **Global değişkenler yalnızca `utils.js`'de tanımlanır.** `allData`, `currentSearch`, `currentStatusFilter`, `currentSort`, `editingId` başka dosyalarda `let`/`const` ile yeniden tanımlanamaz; doğrudan atama yapılır.
- **Firebase compat SDK v9.22.1** kullanılıyor. Modular SDK sentaksı (`import { initializeApp } from 'firebase/app'`) yasak.
- **`preload.js`** `contextIsolation: true`, `sandbox: true` ile çalışır. `ipcRenderer` doğrudan renderer'a açılamaz; yalnızca `contextBridge.exposeInMainWorld` üzerinden geçer.
- **CSP** `main.js → setupCspHeaders()` içinde tanımlı. `'unsafe-eval'` yok. Yeni harici kaynak gerekirse `APP_CSP` dizisine ekle.
- **Kullanıcı adı benzersizliği** Firebase transaction ile korunur (`userset.js → saveBtn click`). Eski kullanıcı adı silinmeden önce transaction commit edilmeli; bu iki adım hiçbir zaman ayrılmamalı.

---

## Bitirmeden Önce Doğrulama

```bash
electron .
```

Otomatik test altyapısı yok. Her değişiklik sonrası el ile kontrol:

- Auth overlay → giriş → ana tablo render
- Kayıt ekleme, düzenleme, silme
- Görsel yükleme (Firebase Storage)
- CSV içe/dışa aktarma

---

## Proje Haritası

| Dosya               | Sorumluluk                                                       |
| ------------------- | ---------------------------------------------------------------- |
| `js/utils.js`       | Tüm global değişkenler, DOM referansları, yardımcı fonksiyonlar  |
| `js/firebase.js`    | Firebase init, `allData` CRUD, listener yönetimi, `enrichItem()` |
| `js/connect.js`     | `.info/connected` listener → bağlantı durumu UI                  |
| `js/table.js`       | Render motoru, filtre/sıralama, CRUD UI, istatistik cache        |
| `js/io.js`          | Toast, confirm dialog, arama debounce, CSV işleme                |
| `js/updater-ui.js`  | Güncelleme butonu ve IPC olayları (renderer tarafı)              |
| `js/editmodal.js`   | Düzenleme modali, görsel yükleme/önizleme                        |
| `js/auth.js`        | Firebase Auth, oturum yönetimi, form validasyonu                 |
| `js/userset.js`     | Hesap ayarları, kullanıcı adı/şifre değiştirme, hesap silme      |
| `js/updater.js`     | `electron-updater` kurulumu (Node/main process)                  |
| `main.js`           | Electron pencere, CSP başlıkları, uygulama yaşam döngüsü         |
| `preload.js`        | IPC köprüsü — sadece buradan API aç                              |
| `css/base.css`      | CSS değişkenleri, reset, yerel font yükleme, toast               |
| `css/header.css`    | Header, stat kartlar, toolbar, filtreler                         |
| `css/table.css`     | Tablo, satır, durum menüsü, yeni kayıt satırı                    |
| `css/editmodal.css` | Düzenleme modali, floating önizleme                              |
| `css/auth.css`      | Auth overlay, giriş/kayıt panelleri                              |
| `css/userset.css`   | Ayarlar modalleri, premium modal                                 |
| `cors.json`         | Firebase Storage CORS — `gsutil cors set` ile uygulanır          |

---

## Kod Yazım Kuralları

### Yorum Başlıkları

**Bölüm başlığı** (dosyada yeni bir grup açarken):

```js
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

**Alt grup başlığı:**

```js
/* ─────────────────── Başlık ─────────────────── */
```

**Fonksiyon içi yorum:** Satır içi `//` veya `/* */` **yasak**. Birden fazla adım varsa numaralandır:

```js
function submitNewItem(tr, inputs) {
  // 1. Zorunlu alan kontrolü
  // 2. Tarihi ISO formatına çevir
  // 3. Firebase'e gönder
}
```

→ Yalnızca adım başlarında tek satır; kodun gövdesine yorum gömülmez.

### Girinti

- 2 boşluk; iç içe her blok +2 boşluk.

---

## Repo'ya Özgü Kurallar

- **`enrichItem()`** her Firebase okuma/yazma sonrası çağrılmalı. `_searchTag` ve `_statusNorm` bu fonksiyon tarafından eklenir. Ham Firebase verisi bu alanlar olmadan `allData`'ya yazılamaz.
- **`userDataRef.off()`** `initUserDataRef()` başında çağrılır. Bu çağrıyı kaldırma; listener birikir.
- **`renderAll()`** herhangi bir modal açıkken tam render yapmaz; `_pendingRender = true` set eder. Modal kapanınca `MutationObserver` tetikler. Bu akışı bypass etme.
- **`normalizeTr()`** tüm arama ve durum karşılaştırmalarında kullanılmalı. Ham string karşılaştırması yapılmamalı. Filtre değerleri (`_statusNorm`) `enrichItem()` tarafından önceden hesaplanmış; tekrar `normalizeTr()` çağrısı gereksiz.
- **`deleteAllInFolder`** (`userset.js`) Storage'daki tüm kullanıcı dosyalarını siler. Yalnızca hesap silme akışında kullanılabilir.
- **`package.json → build.publish`** `owner`/`repo` değiştirilirse auto-updater bozulur.
- **`autoUpdater.autoDownload = false`** kasıtlı; kullanıcı onayı olmadan indirme başlatılmaz.
- **Firebase Storage CORS** yalnızca `mysetup-8dcd5.firebaseapp.com` için tanımlı. Electron `file://` üzerinden çalışır; Storage istekleri main process CSP override'ı ile geçer.

---

## Değişiklik Güvenliği

- Firebase Realtime Database kuralları bu repoda yok; Firebase Console'dan ayrıca yönetilir.
- CSS değişkenleri yalnızca `css/base.css → :root` içinde tanımlanır; başka dosyalara ekleme.
- Yeni harici font/script kaynağı eklenecekse hem `APP_CSP` hem ilgili CSP directive güncellenmeli.
- `font-src 'self' data:` direktifi Google Fonts gibi harici font CDN'lerini engeller; yeni font assets'e yerel olarak eklenmelidir.

---

## Bilinen Tuzaklar

- **`openEditModal` içindeki `requestAnimationFrame` (çift rAF):** Görsel event bağlama için kritik timing. `imageFileInput._eventsBound` flag'i sonraki açılışlarda `onchange` kapanımındaki `id`'yi güncellemez; her açılışta `onchange` yeniden atanmalıdır (`imageUploadBtn.onclick` için flag korunabilir).
- **`escAttr` → içerik `escHtml`'den geçirilmişse** çift tırnak iki kez escape edilir (`&quot;` → `&amp;quot;`). Bir string her iki fonksiyondan ardışık geçirilmemeli.
- **`addOrUpdateTableRow`** tarih sıralaması (`currentSort.col === "date"`) aktifken her zaman `renderAll()`'a düşer; büyük veri setlerinde bu beklenen davranıştır.
- **`openModalCount`** (`userset.js`) ölü değişken; hiçbir yerde okunmuyor. Referans alma, silme güvenlidir.
- Firebase compat SDK'da `firebase.apps.length` kontrolü `firebase.js`'de yapılıyor; ikinci `initializeApp` çağrısı hata verir.
- **`connect.js`** hem realtime `.info/connected` listener hem 30 saniyelik polling ile aynı path'i izliyor (biri fazla — bkz. OPTIMIZASYON.md BULGU-02).

---

## OPTIMIZASYON.md Bulguları (Bekleyen / Uygulanabilir)

> Aşağıdaki düzeltmeler `OPTIMIZASYON.md`'de belgelenmiştir. Kod değişikliği yapılmadan önce ilgili bulgu gözden geçirilmeli, `electron .` ile doğrulanmalıdır.

| Bulgu                                                          | Dosya                          | Durum          |
| -------------------------------------------------------------- | ------------------------------ | -------------- |
| BULGU-01 — `renderAll()` içinde koşulsuz `rebuildStatsCache()` | `js/table.js`                  | ⏳ Uygulanmadı |
| BULGU-02 — `connect.js` çift bağlantı izleme                   | `js/connect.js`                | ⏳ Uygulanmadı |
| BULGU-03 — `normalizeTr()` fallback tekrarı                    | `js/table.js`                  | ⏳ Uygulanmadı |
| BULGU-04 — Google Fonts ağ bağımlılığı                         | `index.html`, `css/header.css` | ⏳ Uygulanmadı |
| BULGU-05 — `renderAll()` rAF debounce                          | `js/table.js`, `js/io.js`      | ⏳ Uygulanmadı |
| BULGU-06 — `firebase.js` listener sırası (race condition)      | `js/firebase.js`               | ⏳ Uygulanmadı |
| BULGU-07 — `openModalCount` ölü değişken                       | `js/userset.js`                | ⏳ Uygulanmadı |
| BULGU-08 — `connect.js` gereksiz `typeof` kontrolü             | `js/connect.js`                | ⏳ Uygulanmadı |
| BULGU-09 — `editmodal.js` image event binding (`id` kapanımı)  | `js/editmodal.js`              | ⏳ Uygulanmadı |
| BULGU-10 — `_dateCache` eviction stratejisi                    | `js/utils.js`                  | ⏳ Uygulanmadı |
| BULGU-11 — `updateItemStatus()` shallow copy                   | `js/table.js`                  | ⏳ Uygulanmadı |
| BULGU-12 — `buildStatusCellHTML` wrapper gereksiz              | `js/table.js`                  | ⏳ Uygulanmadı |
| BULGU-13 — `auth.js` SVG tekrarı                               | `js/auth.js`                   | ⏳ Uygulanmadı |
| BULGU-14 — `deleteAllInFolder` inline tanım                    | `js/userset.js`                | ⏳ Uygulanmadı |
| BULGU-15 — CSP `'unsafe-inline'` script                        | `main.js`                      | ⏳ Uygulanmadı |
| BULGU-16 — CSV karakter-karakter parse döngüsü                 | `js/io.js`                     | ⏳ Uygulanmadı |
| BULGU-17 — `escAttr`/`escHtml` çift escape                     | `js/utils.js`, `js/table.js`   | ⏳ Uygulanmadı |

Bir bulgu uygulandıktan sonra bu tabloda durumu **✅ Uygulandı** olarak güncelle.
