# AGENTS.md

## Zorunlu Kısıtlamalar

- **Bundler yok.** Tüm JS dosyaları `index.html` içinde `<script>` etiketiyle doğrudan yüklenir. `import/export`, `require`, CommonJS sentaksı renderer tarafında yasaktır; yalnızca `main.js`, `preload.js` ve `js/updater.js` Node ortamında çalışır.
- **Script yükleme sırası bozulmamalı:** `utils.js → firebase.js → table.js → io.js → updater-ui.js → editmodal.js → auth.js → userset.js`. Aralarındaki global değişken bağımlılıkları bu sıraya göre çözümlenir.
- **`allData`, `currentSearch`, `currentStatusFilter`, `currentSort`, `editingId`** ve tüm DOM referansları `utils.js` içinde tanımlıdır. Bu değişkenler diğer dosyalarda `let`/`const` ile yeniden tanımlanamaz; doğrudan atama yapılır.
- **Firebase compat SDK v9.22.1 kullanılıyor** (`firebase-app-compat`, `firebase-database-compat`, `firebase-auth-compat`, `firebase-storage-compat`). Modular SDK sentaksı (`import { initializeApp } from 'firebase/app'`) kullanılamaz.
- **`preload.js`** `contextIsolation: true` ve `sandbox: true` ile çalışır. `ipcRenderer` doğrudan renderer'a açılamaz; yalnızca `contextBridge.exposeInMainWorld` üzerinden geçer.
- **CSP `main.js` içinde** `setupCspHeaders()` ile tanımlanır. `'unsafe-eval'` mevcut değil. Yeni harici kaynak eklenmesi gerekirse `APP_CSP` dizisine eklenmeli.
- **Kullanıcı adı benzersizliği** Firebase transaction ile korunur (`userset.js → saveBtn click`). Eski username silinmeden önce transaction commit edilmesi zorunludur; bu iki adım ayrılmamalı.

## Doğrulama — Bitirmeden Önce

```bash
electron .          # Uygulama hatasız açılmalı
```

Otomatik test altyapısı yok. Manuel kontrol zorunlu:

- Auth overlay → giriş → ana tablo render
- Kayıt ekleme, düzenleme, silme
- Görsel yükleme (Firebase Storage)
- CSV içe/dışa aktarma

## Repo Özgü Kurallar

- **`enrichItem()`** her Firebase okuma/yazma sonrası çağrılmalı; `_searchTag` ve `_statusNorm` alanları bu fonksiyon tarafından eklenir. Ham Firebase verisi bu alanlar olmadan `allData`'ya yazılamaz.
- **`userDataRef.off()`** `initUserDataRef()` başında çağrılır. Yeni listener eklerken bu çağrıyı kaldırma; aksi hâlde birden fazla listener birikir.
- **`renderAll()`** herhangi bir modal açıkken tam render yapmaz; `_pendingRender = true` set eder. Modal kapanınca `MutationObserver` render'ı tetikler. Bu akışı bypass etme.
- **Firebase Storage CORS** yalnızca `mysetup-8dcd5.firebaseapp.com` için tanımlıdır (`cors.json`). Electron `file://` üzerinden çalışır; Storage istekleri main process CSP override'ı ile geçer.
- **`normalizeTr()`** Türkçe karakter eşleştirmesi için tüm arama ve durum karşılaştırmalarında kullanılmalı. Ham string karşılaştırması yapılmamalı.

## Önemli Dosya Konumları

| Dosya            | Amaç                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `js/utils.js`    | Tüm global değişkenler + DOM referansları + yardımcı fonksiyonlar |
| `js/firebase.js` | Firebase init, `allData` okuma/yazma CRUD, listener yönetimi      |
| `js/table.js`    | Render motoru, filtreleme, sıralama, CRUD UI                      |
| `js/io.js`       | Toast, confirm dialog, arama debounce, CSV işleme                 |
| `preload.js`     | Electron IPC köprüsü — renderer'a sadece buradan API açılır       |
| `main.js`        | `APP_CSP` tanımı, pencere ayarları                                |
| `cors.json`      | Firebase Storage CORS — `gsutil cors set` ile uygulanır           |

## Değişiklik Güvenlik Kuralları

- **Firebase Realtime Database kuralları** bu repoda bulunmuyor; kural değişiklikleri Firebase Console'dan ayrıca yapılmalı.
- **`package.json` → `build.publish`** GitHub release ayarını içerir. `owner`/`repo` değiştirilirse auto-updater bozulur.
- `autoUpdater.autoDownload = false` kasıtlı; kullanıcı onayı olmadan indirme başlatma.
- **`deleteAllInFolder`** (`userset.js`) Storage'daki tüm kullanıcı dosyalarını siler. Bu fonksiyonu hesap silme dışında başka bir akışta çağırma.

## Kod Yazım Kuralları

### Yorum Başlıkları

**Bölüm başlığı** (dosyada yeni bir grup açarken):

```
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

**Normal başlık** (bölüm içindeki alt gruplar):

```
/* ─────────────────── Başlık ─────────────────── */
```

**Fonksiyon içinde** satır içi yorum (`//` veya `/* */`) **yasak**. Birden fazla adım varsa numaralandır:

```js
function submitNewItem(tr, inputs) {
  // 1. Zorunlu alan kontrolü
  // 2. Tarihi ISO formatına çevir
  // 3. Firebase'e gönder
}
```

→ Sadece adım başlarında tek satır yorum; kodun içine yorum gömülmez.

### Girinti

- 2 boşluk (mevcut kodla tutarlı)
- İç içe her blok +2 boşluk
- `return` / değişken atamaları hizaya göre; ekstra girinti ekleme

### Proje'ye Özgü Örnek

```js
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          VERİ YAZMA                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kayıt Güncelle ─────────────────── */

function updateComponentInFirebase(id, itemData) {
  return database.ref(activeBasePath + "/" + id).update(itemData);
}

/* ─────────────────── Kayıt Sil ─────────────────── */

function deleteComponentFromFirebase(id) {
  return database.ref(activeBasePath + "/" + id).remove();
}
```

## Bilinen Tuzaklar

- **`openEditModal` içinde `setTimeout(80ms)`** image event binding için kullanılır. Bu süreyi kaldırırsan görsel yükleme event'leri birden fazla kez bağlanır (`_eventsBound` flag'i olmakla birlikte timing kritik).
- **`addOrUpdateTableRow`** date-sıralaması aktifken `renderAll()`'a düşer; büyük veri setlerinde bu yavaşlık beklenen davranıştır.
- **`escAttr` → `escHtml` çağrısı** çift tırnak karakterini iki kez escape eder (`&quot;` → `&amp;quot;`). HTML attribute'larına veri yazarken bunu göz önünde bulundur.
- **`openModalCount`** `userset.js` içinde tanımlı ama hiçbir yerde okunmuyor — dead code, referans alma.
- Firebase compat SDK `firebase.apps.length` kontrolü `firebase.js`'de yapılıyor; aynı HTML'e ikinci kez `firebase.initializeApp` çağrısı `already initialized` hatasına yol açar.
