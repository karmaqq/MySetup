# AGENTS.md — MySetup v2.4.2

> Bu dosya, MySetup projesine kod müdahalesi yapacak her yapay zeka ajanı, editör eklentisi veya geliştirici için zorunlu okuma belgesidir.
> Projeyi ilk kez gören bir ajanın hata yapmaması için gereken tüm yapısal bilgi burada tanımlanmıştır.

---

## 1. Altın Kural: Yorum Stili

**Bu kural ihlal edilemez. Kod değişikliği yapmadan önce mutlaka okunmalıdır.**

Projedeki her `.js` ve `.css` dosyası aynı yorum diline sahiptir. Ajan kendi yorum stilini dayatamaz, standart dışı yorum ekleyemez, mevcut yorum bloklarını değiştiremez.

### 1.1 Bölüm Başlığı

Dosyada mantıksal olarak yeni bir ana grup açılıyorsa kullanılır. İki satır çerçeve, ortada başlık:

```js
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

CSS dosyalarında aynı kural geçerlidir.

### 1.2 Alt Grup Başlığı

Bir bölüm içinde tematik olarak gruplanmış kod bloğu başlamadan önce kullanılır:

```js
/* ─────────────────── Başlık ─────────────────── */
```

### 1.3 Fonksiyon İçi Yorum

Bir fonksiyon birden fazla adım içeriyorsa, yalnızca adım başları numaralandırılır. Satır içi `//` veya gövdeye gömülü `/* */` kesinlikle yasaktır:

```js
function submitNewItem(tr, inputs) {
  // 1. Zorunlu alan kontrolü
  // 2. Tarihi ISO formatına çevir
  // 3. Firebase'e gönder
}
```

Tek adımlı fonksiyonlara yorum eklenmez.

### 1.4 Yasak Yorum Kalıpları

Aşağıdakilerin hiçbiri projede yer alamaz:

```js
// Bu fonksiyon X'i yapıyor                   ← YASAK: açıklayıcı satır içi yorum
const x = a + b; // toplam                    ← YASAK: satır sonu yorumu
/* Burada şunu yaptık çünkü... */             ← YASAK: gövde içi blok yorum
// TODO: ileride düzelt                        ← YASAK: işaretleyici yorum
```

---

## 2. Proje Mimarisi

MySetup, **Electron** çatısı üzerine kurulu bir masaüstü envanter uygulamasıdır. İki bağımsız süreç vardır:

**Main Process (Node.js):** `main.js`, `preload.js`, `js/updater.js`
**Renderer Process (Tarayıcı):** `index.html` ve tüm `js/` + `css/` dosyaları

Renderer tarafında `import` / `export` / `require` kesinlikle kullanılamaz. Bundler yoktur. Tüm paylaşılan değişkenler global scope üzerinden erişilir.

---

## 3. Dosya Haritası

### Main Process

| Dosya           | Sorumluluk                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| `main.js`       | Electron penceresi, CSP başlıkları, uygulama yaşam döngüsü, güncelleme başlatma |
| `preload.js`    | IPC köprüsü; yalnızca bu dosyadan `contextBridge.exposeInMainWorld` çağrılır    |
| `js/updater.js` | `electron-updater` kurulumu; `autoDownload: false` kasıtlı                      |

### Renderer Process — JavaScript (yükleme sırası bu şekilde korunmalı)

| Dosya              | Sorumluluk                                                                            |
| ------------------ | ------------------------------------------------------------------------------------- |
| `js/utils.js`      | **Tüm global değişkenler**, DOM referansları, yardımcı fonksiyonlar, `scheduleRender` |
| `js/firebase.js`   | Firebase init, `allData` CRUD, realtime listener yönetimi, `enrichItem()`             |
| `js/table.js`      | Render motoru, filtre/sıralama, istatistik önbelleği, CRUD UI eylemleri               |
| `js/io.js`         | Toast/confirm sistemi, arama debounce, CSV içe/dışa aktarma                           |
| `js/updater-ui.js` | Güncelleme butonu ve IPC olayları (renderer tarafı)                                   |
| `js/editmodal.js`  | Düzenleme modali, görsel yükleme/önizleme, yıldız derecelendirme                      |
| `js/auth.js`       | Firebase Auth, oturum durumu, giriş/kayıt formları                                    |
| `js/userset.js`    | Hesap ayarları, kullanıcı adı/şifre değiştirme, hesap silme                           |

### Renderer Process — CSS

| Dosya               | Sorumluluk                                                         |
| ------------------- | ------------------------------------------------------------------ |
| `css/base.css`      | CSS değişkenleri (`:root`), reset, toast, genel layout, responsive |
| `css/header.css`    | Üst bar, istatistik kartları, araç çubuğu, filtreler               |
| `css/table.css`     | Tablo, satır stilleri, durum menüsü, yeni kayıt satırı             |
| `css/editmodal.css` | Düzenleme modali, floating görsel önizleme, yıldız sistemi         |
| `css/auth.css`      | Auth overlay, giriş/kayıt panelleri                                |
| `css/userset.css`   | Ayarlar modalleri, kullanıcı adı düzenleme, tehlike alanı          |

### Diğer

| Dosya          | Sorumluluk                                                                   |
| -------------- | ---------------------------------------------------------------------------- |
| `index.html`   | Tek sayfa; tüm HTML yapısı, script yükleme sırası, SVG template'ler          |
| `cors.json`    | Firebase Storage CORS; `gsutil cors set` ile uygulanır, doğrudan düzenlenmez |
| `package.json` | Bağımlılıklar ve `electron-builder` yapılandırması                           |

---

## 4. Bağımlılık Zinciri

```
utils.js        → Hiçbir şeye bağımlı değil; diğer her dosya buna bağımlıdır
firebase.js     → utils.js'e bağımlı (allData, normalizeTr, _statsCache)
table.js        → utils.js + firebase.js'e bağımlı
io.js           → utils.js + table.js + firebase.js'e bağımlı
updater-ui.js   → utils.js'e bağımlı (window.electronAPI)
editmodal.js    → utils.js + firebase.js + io.js'e bağımlı
auth.js         → utils.js + firebase.js + editmodal.js + userset.js'e bağımlı
userset.js      → utils.js + firebase.js + auth.js'e bağımlı
```

Bu sıra `index.html` içindeki `<script>` etiketlerinde sabittir. **Asla değiştirilemez.**

---

## 5. Kritik Fonksiyonlar ve Kuralları

### `enrichItem(item)` — `js/firebase.js`

Firebase'den gelen ham veriyi `allData`'ya yazmadan önce bu fonksiyondan geçirmek **zorunludur**. `_searchTag` ve `_statusNorm` alanlarını ekler. Bu alanlar olmadan arama ve filtreleme çalışmaz.

### `initUserDataRef(uid)` — `js/firebase.js`

Başında `userDataRef.off()` çağrısı vardır; bu satır kaldırılamaz. Kaldırılırsa listener'lar birikir ve aynı event birden fazla kez tetiklenir.

### `renderAll()` — `js/table.js`

Herhangi bir `.modal-overlay.active` varken tam render yapmaz; `_pendingRender = true` set eder. Modal kapanınca `MutationObserver` tetikler ve render başlar. Bu akış bypass edilemez.

### `scheduleRender()` — `js/utils.js`

`renderAll`'ı doğrudan çağırmak yerine her zaman bu fonksiyon kullanılır. `requestAnimationFrame` üzerinden debounce sağlar; aynı frame'de birden fazla çağrıyı birleştirir.

### `normalizeTr(s)` — `js/utils.js`

Tüm arama ve durum karşılaştırmaları bu fonksiyondan geçer. Ham string karşılaştırması yapılamaz. `_statusNorm` zaten `enrichItem` tarafından set edilmiştir; üzerine tekrar `normalizeTr` çağırmak gereksizdir.

### `updateStatsCacheOnChange` + `rebuildStatsCache` — `js/table.js`

İstatistik önbelleği (`_statsCache`) tüm hesaplamalar için temel referanstır. Firebase listener'larında her kayıt değişiminde `updateStatsCacheOnChange` çağrılır; tüm liste sıfırlanıp hesaplanması gereken durumlarda `rebuildStatsCache` kullanılır.

### `deleteAllInFolder(ref)` — `js/firebase.js`

Storage'daki kullanıcı dosyalarını özyinelemeli siler. **Yalnızca hesap silme akışında** çağrılabilir.

---

## 6. Global Değişkenler

Aşağıdaki değişkenler yalnızca `js/utils.js` içinde `let` veya `const` ile tanımlanır. Başka hiçbir dosyada yeniden tanımlanamaz; yalnızca doğrudan atama yapılabilir:

| Değişken              | Tip            | Açıklama                                            |
| --------------------- | -------------- | --------------------------------------------------- |
| `allData`             | `{}`           | Tüm Firebase verisinin anlık görüntüsü              |
| `currentSearch`       | `string`       | Aktif arama sorgusu                                 |
| `currentStatusFilter` | `string`       | Aktif durum filtresi (`"all"` veya normalize değer) |
| `currentSort`         | `{ col, dir }` | Aktif sıralama sütunu ve yönü                       |
| `editingId`           | `string\|null` | Açık edit modalının kayıt ID'si                     |
| `_statsCache`         | `{}`           | İstatistik önbelleği                                |

---

## 7. Yapamayacakları (Yasak İşlemler)

**Aşağıdakiler hiçbir koşulda yapılamaz:**

- Renderer tarafında `import`, `export`, `require` kullanmak
- `utils.js` dışında global değişken (`allData`, `currentSearch` vb.) tanımlamak
- Script yükleme sırasını değiştirmek
- `userDataRef.off()` çağrısını `initUserDataRef` başından kaldırmak
- `enrichItem()` çağrısını atlayarak ham veri `allData`'ya yazmak
- `renderAll()` içindeki modal kontrolünü bypass etmek
- CSS değişkenlerini `base.css/:root` dışında bir yerde tanımlamak
- `'unsafe-eval'` direktifini CSP'ye eklemek
- `autoUpdater.autoDownload`'ı `true` yapmak
- `preload.js` dışında `ipcRenderer`'ı renderer'a açmak
- `package.json → build.publish` içindeki `owner`/`repo` değerlerini değiştirmek
- Firebase modular SDK sentaksı (`import { initializeApp }`) kullanmak
- `escAttr` ve `escHtml`'i aynı string'e ardışık uygulamak (çift escape)

---

## 8. Yapabilecekleri (İzin Verilen İşlemler)

- `js/utils.js`'deki yardımcı fonksiyon listesine yeni fonksiyon eklemek
- Yeni harici kaynak gerekiyorsa hem `APP_CSP` hem ilgili directive güncellenmek şartıyla CDN eklemek
- `css/base.css → :root` içine yeni CSS değişkeni eklemek
- `addComponentToFirebase`, `updateComponentInFirebase` gibi mevcut Firebase yazma fonksiyonlarını kullanmak
- `showToast`, `showConfirm` fonksiyonlarını her dosyadan çağırmak
- Yeni modal eklemek; eklenen her yeni `.modal-overlay` için `MutationObserver`'ın gözlemleyeceği listeye dahil etmek (`table.js` başındaki IIFE)
- `preload.js`'e yeni IPC kanalı eklemek — her kanal için `onceListener` pattern'i kullanmak
- `cors.json`'ı yalnızca Firebase Console'dan Storage CORS ayarı için güncellemek

---

## 9. Firebase SDK

**Compat SDK v9.22.1** — CDN üzerinden yüklenir (`index.html`). Modular SDK sentaksı yasaktır.

```html
<!-- Doğru -->
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>

<!-- Yasak -->
import { initializeApp } from 'firebase/app';
```

`firebase.apps.length` kontrolü `firebase.js`'de yapılıyor; ikinci `initializeApp` çağrısı hata üretir.

---

## 10. CSP Yapısı

CSP, `main.js → setupCspHeaders()` içinde tanımlı `APP_CSP` dizisiyle yönetilir.

Kritik kısıtlamalar:

- `'unsafe-eval'` **yoktur** ve eklenemez
- `font-src 'self' data:'` — harici font CDN'i için bu direktif güncellenmeli
- Yeni bir harici kaynak gerektiğinde yalnızca `APP_CSP` dizisine eklenir; başka bir yere yazılmaz

---

## 11. Kullanıcı Adı Benzersizliği

Kullanıcı adı değiştirme (`userset.js → saveBtn`) Firebase transaction ile korunur:

- Transaction commit edilmeden eski kullanıcı adı silinemez
- Bu iki adım hiçbir zaman ayrılmamalı veya sırası değiştirilmemelidir

Kayıt akışında (`auth.js`) ise `once("value")` kontrolü + `set` yazımı non-atomiktir; TOCTOU riski mevcuttur (OPTIMIZATIONS.md BULGU-06).

---

## 12. Doğrulama Prosedürü

Otomatik test altyapısı yoktur. Her değişiklik sonrası manuel kontrol:

```bash
electron .
```

Kontrol listesi:

- Auth overlay → giriş → ana tablo render
- Kayıt ekleme (inline satır), düzenleme (modal), silme (confirm toast)
- Görsel yükleme — Firebase Storage
- CSV içe aktarma ve dışa aktarma
- Arama (Latin ve Türkçe karakterle)
- Durum filtresi ve sıralama
- Kullanıcı adı ve şifre değiştirme
- Hesap silme akışı

---

## 13. Bilinen Tuzaklar

| Konu                                  | Açıklama                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `normalizeTrSearch`                   | Türkçe karakter girildiğinde arama çalışmaz (OPTIMIZATIONS.md BULGU-01). Düzeltilmeden kullanılmamalı                        |
| `imageUploadBtn._eventsBound`         | `onclick`'i sadece bir kez bağlar; farklı kayıtlar arasında modal geçişinde `imagePreview` kapanımı kayabilir (BULGU-08)     |
| `escAttr` + `escHtml` ardışık         | Aynı string ikisinden geçirilirse `&quot;` → `&amp;quot;` olur                                                               |
| `addOrUpdateTableRow`                 | Tarih sıralaması aktifken her zaman `renderAll()`'a düşer; beklenen davranıştır                                              |
| Firebase çift `getFilteredSortedList` | `child_added/changed/removed` listener'larında `scheduleRender` + `updateResultCount` birlikte çağrılıyor (BULGU-02)         |
| `@font-face` blokları                 | `base.css`'deki yerel font tanımları artık ölü kod; fontlar CDN üzerinden geliyor (BULGU-05 + BULGU-10 birlikte uygulanmalı) |

---

## 14. OPTIMIZATIONS.md ile İlişki

Bekleyen optimizasyon bulguları `OPTIMIZATIONS.md` dosyasında belgelenmiştir. Kod değişikliği yapmadan önce ilgili bulgu okunmalı, değişiklik sonrası tablodaki durum `✅ Uygulandı` olarak güncellenmelidir.
