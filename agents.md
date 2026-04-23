# AGENTS.md — MySetup

> Electron + Firebase Realtime Database + Firebase Auth  
> Bundler yok. Framework yok. Vanilla JS + CSS + HTML.

---

## 🔒 Evrensel Kısıtlamalar (Her Dosyada Geçerli)

- `.env.bat` **asla commit'e girmez** — `GH_TOKEN` içerir. `.gitignore`'da olsa da patch/diff/yedek olarak bile oluşturma.
- `update.bat` **asla commit'e girmez** — `.gitignore`'da, yeniden oluşturma.
- `dist/` ve `node_modules/` **asla commit'e girmez**.
- Renderer tarafında (`js/*.js`) `require()` veya herhangi bir Node.js API'si **kullanılamaz** — sadece `preload.js`'in `contextBridge` ile açtığı metodlar kullanılabilir.
- Firebase **sadece `js/firebase.js`'den init edilir**. Başka hiçbir dosyada `initializeApp()` çağrısı olamaz.
- Durum değerleri **sabit Türkçe string**'lerdir: `sağlıklı`, `bozuk`, `yedek`, `atıldı`. Hiçbir dosyada bu değerler değiştirilemez, çevrilemez, yeni değer eklenemez — aynı anda tüm bağımlı dosyalar güncellenmeden.

---

## 📁 Dosya Bazlı Agent Talimatları

---

### `main.js` — Electron Ana Süreç

**Sorumluluğu:** `BrowserWindow` oluşturma, `electron-updater` yönetimi, IPC kanallarını dinleme, uygulama yaşam döngüsü.

**Yapılabilecekler:**

- Yeni IPC kanalı eklenebilir (`ipcMain.handle`) — ancak mutlaka `preload.js`'de de `contextBridge`'e açılmalıdır, aksi halde renderer'dan erişilemez.
- `autoUpdater` event'leri değiştirilebilir.

**Yapılamayacaklar:**

- `webPreferences.nodeIntegration: true` **yapılamaz** — güvenlik ihlali.
- `webPreferences.contextIsolation: false` **yapılamaz** — preload köprüsü çöker.
- `webPreferences.preload` yolu değiştirilemez, aksi halde tüm IPC köprüsü çöker.
- `autoUpdater.setFeedURL()` elle çağrılamaz — `package.json`'daki `publish` config'i yeterlidir.

**Kritik bağımlılık:**

- `electron-updater` paketi `dependencies`'de (runtime'da gerekli), `electron` ise `devDependencies`'de. Bu ayrım kasıtlıdır, değiştirme.

**Bilinen tuzak:**

- `app.getVersion()` değeri `package.json`'daki `version` alanından okunur ve renderer'a `#versionDisplay`'e yazılır. Versiyon string'ini JS veya HTML'de hardcode etme.

---

### `preload.js` — IPC Köprüsü

**Sorumluluğu:** Ana süreç ile renderer arasındaki tek güvenli iletişim kanalı. `contextBridge.exposeInMainWorld()` ile renderer'a API yüzeyini açar.

**Yapılabilecekler:**

- `ipcRenderer.invoke()` ile yeni metod açılabilir — ancak `main.js`'de eşleşen `ipcMain.handle()` olmadan çalışmaz.

**Yapılamayacaklar:**

- Mevcut bir metod **kaldırılamaz veya yeniden adlandırılamaz** — renderer'daki çağrılar sessizce `undefined` döner, runtime hatası bile vermez.
- Node.js modülleri (`fs`, `path`, `os` vb.) doğrudan renderer'a expose edilemez — sarmalayıcı (wrapper) fonksiyon yazılmalıdır.
- `event.sender` üzerinden renderer'a geri referans tutma.

**Bilinen tuzak:**

- Bu dosyada yapılan her değişiklik, Electron'u yeniden başlatmadan etkili olmaz. Geliştirme sırasında hot-reload çalışmaz.

---

### `js/firebase.js` — Firebase Başlatma ve Export

**Sorumluluğu:** Firebase uygulamasını init eder, `database` ve `auth` referanslarını diğer modüllere export eder.

**Yapılabilecekler:**

- Firebase config sabitleri güncellenebilir (API key rotasyonu vb.).

**Yapılamayacaklar:**

- `initializeApp()` **sadece bir kez** çağrılır. Koşullu veya lazy init ekleme — compat SDK bunu tolere etmez.
- Bu dosyadan UI manipülasyonu (DOM erişimi) yapılamaz.
- Firebase servis referansları (`database`, `auth`) bu dosya dışında oluşturulamaz.

**Kritik bağımlılık:**

- `index.html`'deki script yükleme sırası: `utils.js` → **`firebase.js`** → `table.js` → `io.js` → `modal.js` → `auth.js`. `firebase.js` ikinci sıradadır; ondan önce yüklenen `utils.js` Firebase referanslarına **erişemez**.
- Sonraki tüm modüller bu dosyanın export ettiği referanslara bağımlıdır. Bu dosya yüklenmezse tüm uygulama çöker.

**Bilinen tuzak:**

- Firebase compat SDK (`firebase-*-compat.js`) CDN'den yüklenir. Offline ortamlarda bu dosya yüklenemezse `firebase` global değişkeni tanımsız kalır ve sonraki tüm script'ler hata verir. Bunu handle etmeden hata yönetimi ekleme.

---

### `js/auth.js` — Kimlik Doğrulama

**Sorumluluğu:** Login, register, logout, şifre değiştirme, hesap silme akışları. `firebase.auth()` çağrıları burada yapılır.

**Yapılabilecekler:**

- Yeni auth akışı (örn. şifremi unuttum) eklenebilir.
- Hata mesajları (`loginError`, `regError`) güncellenebilir.

**Yapılamayacaklar:**

- `onAuthStateChanged` callback'i **kaldırılamaz veya taşınamaz** — bu callback `#authOverlay`'i gizler ve `#mainScroll`'u gösterir; uygulama bu event olmadan hiç açılmaz.
- Auth hata kodları (`auth/wrong-password`, `auth/email-already-in-use` vb.) Firebase'e özel string'lerdir, değiştirilemez.
- Re-authentication (`reauthenticateWithCredential`) şifre değiştirme ve hesap silme akışlarında zorunludur — kaldırılamaz.

**Kritik bağımlılık:**

- `js/firebase.js`'den `auth` referansına bağımlı.
- `#authOverlay`, `#authLoading`, `#mainScroll`, `#userInfo`, `#userEmail`, `#loginForm`, `#registerForm` DOM elementleri bu dosya tarafından yönetilir. Bu ID'ler `index.html`'den kaldırılamaz.

**Bilinen tuzak:**

- `#userEmail` element ID'si yanıltıcıdır — bu element kullanıcının **display name**'ini gösterir, email'ini değil. ID'yi düzeltirken tüm `auth.js` referanslarını da güncelle.
- "Beni Hatırla" checkbox'ı (`#rememberMe`) Firebase persistence ayarını değiştirir (`LOCAL` vs `SESSION`). Checkbox kaldırılırsa persistence varsayılan kalır ama kullanıcı her oturumda login olmak zorunda kalır.

---

### `js/table.js` — Tablo Render ve Sıralama

**Sorumluluğu:** Firebase'den gelen envanter verilerini `<tbody id="tableBody">`'ye render eder. Sıralama, filtreleme, arama sonuçlarını tabloya yansıtır.

**Yapılabilecekler:**

- Yeni sütun eklenebilir — ancak `index.html`'deki `<thead>` ve `<tfoot>` ile senkronize edilmelidir.
- Sıralama kriterleri genişletilebilir.

**Yapılamayacaklar:**

- `#tableBody`, `#resultCount`, `#totalCostDisplay`, `#statTotal`, `#statCount`, `#statHealthy`, `#statExpensive` ID'leri değiştirilemez.
- Fiyat formatlaması Türkçe locale ile yapılmalıdır (`tr-TR`, `₺`). `toLocaleString('en-US')` veya `$` sembolü kullanılamaz.
- Durum değerleri (`sağlıklı`, `bozuk`, `yedek`, `atıldı`) tablo render'ında CSS class olarak da kullanılıyor olabilir — string değiştirirken CSS'i de kontrol et.

**Kritik bağımlılık:**

- `js/firebase.js`'den `database` referansına bağımlı.
- `js/utils.js`'deki yardımcı fonksiyonlara bağımlı (script yükleme sırası gereği `utils.js` önce gelir).
- Firebase'den veri `onValue()` listener ile dinlenir — bu listener kaldırılırsa tablo gerçek zamanlı güncellenmez.

**Bilinen tuzak:**

- Firebase Realtime Database `onValue()` her veri değişikliğinde tüm listeyi döker. Tablo her güncellemede **tamamen yeniden render edilir**. Büyük veri setleri için performans sorunu yaratır ama mevcut yapı buna göre kurulu; parçalı güncelleme eklersen mevcut render mantığını tamamen refactor etmen gerekir.

---

### `js/modal.js` — Ürün Ekleme / Düzenleme Modalı

**Sorumluluğu:** `#editModal`'ı açar/kapatır, form verilerini okur, Firebase'e yazar (ekleme ve güncelleme). ESC tuşu ile kapatma burada handle edilir.

**Yapılabilecekler:**

- Yeni form alanı eklenebilir — `index.html`'deki `#editModal` içine ve Firebase yazma işlemine aynı anda eklenmelidir.
- Validasyon kuralları genişletilebilir.

**Yapılamayacaklar:**

- `#editModal`, `#modalClose`, `#modalCancel`, `#modalSave` ID'leri değiştirilemez.
- `#editComponent` alanı zorunludur (`required` işaretli) — bu kısıtlama kaldırılamaz, Firebase'de bileşensiz kayıt oluşturmaz.
- Tarih formatı `GG.AA.YYYY` (Türkçe) olarak saklanır — ISO 8601'e (`YYYY-MM-DD`) dönüştürme yapılırken mevcut kayıtlar bozulur.

**Kritik bağımlılık:**

- `js/firebase.js`'den `database` referansına bağımlı.
- `js/utils.js`'deki toast/yardımcı fonksiyonlara bağımlı.
- `#editDatePicker` (gizli `<input type="date">`) ve `#editDate` (görünür text input) birlikte çalışır — birini kaldırırsan tarih seçici çöker.

**Bilinen tuzak:**

- Modal'ın hem "yeni kayıt ekle" hem de "mevcut kaydı düzenle" modunu aynı form üzerinden yönettiği tahmin ediliyor. `#modalSave` click handler'ında hangi modda olduğunu belirleyen state değişkeni (muhtemelen bir `editingKey` veya `currentItemId` değişkeni) sıfırlanmadan modal kapatılırsa bir sonraki "yeni kayıt" işlemi eski kaydın üzerine yazar.

---

### `js/io.js` — CSV İçe/Dışa Aktarma

**Sorumluluğu:** `#importCsvBtn` ve `#exportCsvBtn` butonlarını yönetir. CSV parse ve generate işlemlerini yapar.

**Yapılabilecekler:**

- Export formatına yeni sütun eklenebilir — ancak import parse mantığıyla senkronize olmalıdır.

**Yapılamayacaklar:**

- CSV sütun sırası veya başlık adları değiştirilemez — mevcut kullanıcıların daha önce export ettiği dosyaları import edemez hale gelirler.
- Fiyat değerleri CSV'de nokta (`.`) ile mi virgül (`,`) ile mi saklandığı tutarlı olmalıdır — Türkçe locale `1.234,56` formatı kullanır, bunu bozmak import'u kırar.
- `#importCsvInput` (`<input type="file">`) doğrudan kullanıcı etkileşimi gerektirir — programmatik `.click()` dışında tetiklenemez (Electron güvenlik kısıtlaması).

**Kritik bağımlılık:**

- Import işlemi sonunda Firebase'e yazma için `js/firebase.js`'den `database` referansına bağımlı.
- `js/table.js`'nin render fonksiyonuna bağımlı olabilir (import sonrası tabloyu yenile).

**Bilinen tuzak:**

- CSV import'ta encoding sorunu yaşanabilir — Türkçe karakterler (`ğ`, `ş`, `ı`, `ü`, `ö`, `ç`) Windows'ta Excel ile açılan CSV'lerde `windows-1254` encoding'e dönüşebilir. Import parser'ı `UTF-8` dışı encoding'e karşı korumalı olup olmadığını kontrol et.

---

### `js/utils.js` — Yardımcı Fonksiyonlar

**Sorumluluğu:** Toast bildirimleri, tarih formatları, para formatı gibi tüm modüllerin kullandığı ortak yardımcı fonksiyonlar.

**Yapılabilecekler:**

- Yeni yardımcı fonksiyon eklenebilir.

**Yapılamayacaklar:**

- Mevcut fonksiyon **adları değiştirilemez** — `table.js`, `modal.js`, `auth.js`, `io.js` doğrudan bu fonksiyonları global scope'tan çağırır; import/export sistemi yoktur.
- `#toastContainer` ID'si değiştirilemez — toast sistemi bu ID'yi arar.
- Para formatı fonksiyonu `tr-TR` locale ve `₺` sembolü kullanmalıdır, değiştirilemez.

**Kritik bağımlılık:**

- **Script yükleme sırasında birinci gelir.** Sonraki tüm dosyalar `utils.js`'nin fonksiyonlarına bağımlıdır. Bu dosyada syntax hatası olursa tüm uygulama sessizce çöker.

**Bilinen tuzak:**

- Bundler olmadığı için bu dosyadaki tüm fonksiyonlar `window` global'ine yazılır. Fonksiyon adı `window`'daki built-in ile çakışırsa sessiz override yaşanır — `close`, `open`, `print`, `fetch` gibi adlar kullanılamaz.

---

### `css/base.css` — Temel Stiller

**Sorumluluğu:** Reset, CSS değişkenleri (renkler, spacing, tipografi), genel body/html stilleri.

**Yapılabilecekler:**

- CSS custom property değerleri güncellenebilir — tüm dosyalar bu değişkenleri kullanıyorsa otomatik yansır.

**Yapılamayacaklar:**

- CSS değişken **adları** değiştirilemez (örn. `--accent`, `--bg`, `--text` gibi isimler) — diğer 7 CSS dosyası bu adları referans alır, tek bir isim değişikliği birden fazla dosyayı kırar.
- Font tanımlamaları değiştirilirken `index.html`'deki Google Fonts `<link>` ile senkronize olunmalıdır.
- `.hidden` utility class'ı burada tanımlıdır (veya tanımlı olmalıdır) — `display: none` ile implement edilir; JS bu class'ı `classList.add/remove` ile toggle eder. `!important` eklenirse bazı override'lar çalışmaz.

---

### `css/modal.css` — Modal Stilleri

**Sorumluluğu:** `#editModal`, `#userSettingsModal`, `#changePasswordModal`, `#deleteAccountModal` modallarının görsel stili.

**Yapılabilecekler:**

- Modal boyutu, animasyon, renk güncellenebilir.

**Yapılamayacaklar:**

- `.modal-overlay` class'ı hem görünürlük (`display: none/flex`) hem de backdrop için kullanılıyorsa — sadece birini değiştirmek modal açma/kapama mantığını bozar.
- `.hidden` utility class'ı `base.css`'de tanımlıysa `modal.css`'de redefine etme.

---

### `css/auth.css` — Auth Ekranı Stilleri

**Sorumluluğu:** `#authOverlay`, `#authLoading`, login/register formları.

**Yapılamayacaklar:**

- `#authOverlay` ve `#authLoading` için `display` property'si JS tarafından (`auth.js`) dinamik olarak yönetilir — CSS'de `!important` ile override etme, auth akışı görünmez hale gelir.

---

### `css/table.css` — Tablo Stilleri

**Sorumluluğu:** `#mainTable`, `thead`, `tbody`, `tfoot`, sıralama ikonları, durum badge'leri.

**Yapılamayacaklar:**

- Durum badge class adları (`.saglikli`, `.bozuk`, `.yedek`, `.atildi` veya benzeri) `table.js`'deki dinamik class assignment ile eşleşmelidir — CSS class adını değiştirirken JS'i de güncelle.
- `tfoot` (`.control-panel-footer`) kaldırılamaz — "Ürün Ekle" butonu ve toplam maliyet göstergesi buradadır.

---

### `css/toolbar.css` — Araç Çubuğu Stilleri

**Sorumluluğu:** Arama kutusu, filtre butonları, import/export butonları.

**Yapılamayacaklar:**

- `.filter-btn.active` class'ı `table.js` veya `io.js` tarafından programatik olarak toggle edilir — bu class kaldırılırsa aktif filtre görsel feedback'i kaybolur.

---

### `css/header.css` — Başlık Stilleri

**Sorumluluğu:** `.top-bar`, `.brand-area`, `.stats-row`, `.stat-card` stilleri.

**Yapılamayacaklar:**

- `.stats-row` ve içindeki `#statTotal`, `#statCount`, `#statHealthy`, `#statExpensive` elementleri JS tarafından doldurulur — bu elementleri `display: none` ile gizlersen JS hata vermez ama istatistikler kullanıcıya gösterilmez.

---

### `css/toast.css` — Bildirim Stilleri

**Sorumluluğu:** `#toastContainer` ve toast animasyonları.

**Yapılamayacaklar:**

- Toast pozisyonlaması `fixed` olmalıdır — `absolute` yapılırsa scroll sırasında kaybolur.
- `#toastContainer` ID'si `utils.js`'de hardcode'dur, değiştirilemez.

---

### `css/updater.css` — Güncelleme Butonu Stilleri

**Sorumluluğu:** `#updateBtn` güncelleme bildirimi butonu.

**Not:** Bu buton normalde gizlidir (`hidden` class), yeni sürüm algılandığında `main.js`/`electron-updater` tarafından gösterilir. Görünür hale getirme mantığı `main.js`'dedir, CSS'de değil.

---

### `index.html` — Tek Sayfa Giriş Noktası (805 satır)

**Sorumluluğu:** Tüm HTML yapısı. Modal'lar, auth formları, tablo, toolbar hepsi burada inline tanımlıdır.

**Yapılabilecekler:**

- Yeni modal eklenebilir — `#pageWrapper` içine, `.modal-overlay` wrapper ile.
- Yeni istatistik kartı (`#statsRow`) eklenebilir.

**Yapılamayacaklar:**

- **Script yükleme sırası değiştirilemez:** `utils.js` → `firebase.js` → `table.js` → `io.js` → `modal.js` → `auth.js`
- Aşağıdaki ID'ler kaldırılamaz veya değiştirilemez:

| ID                                                                                                   | Kullanan Dosya           |
| ---------------------------------------------------------------------------------------------------- | ------------------------ |
| `#authOverlay`, `#authLoading`, `#mainScroll`                                                        | `auth.js`                |
| `#tableBody`, `#resultCount`, `#totalCostDisplay`                                                    | `table.js`               |
| `#toastContainer`                                                                                    | `utils.js`               |
| `#editModal`, `#modalSave`, `#modalClose`, `#modalCancel`                                            | `modal.js`               |
| `#importCsvBtn`, `#exportCsvBtn`, `#importCsvInput`                                                  | `io.js`                  |
| `#searchInput`, `#clearSearch`                                                                       | `table.js`               |
| `#statTotal`, `#statCount`, `#statHealthy`, `#statExpensive`                                         | `table.js`               |
| `#updateBtn`, `#versionDisplay`                                                                      | `main.js` / `preload.js` |
| `#userInfo`, `#userEmail`, `#logoutBtn`                                                              | `auth.js`                |
| `#editDate`, `#editDatePicker`, `#editCalIcon`                                                       | `modal.js`               |
| `#editComponent`, `#editBrand`, `#editSpecs`, `#editPrice`, `#editVendor`, `#editStatus`, `#editUrl` | `modal.js`               |

- Firebase CDN script'leri (`firebase-app-compat.js`, `firebase-database-compat.js`, `firebase-auth-compat.js`) kaldırılamaz — bundler olmadığı için `js/firebase.js` bu global'lere bağımlıdır.
- `<html lang="tr">` değiştirilemez — tarih/para formatlaması TR locale'e bağlıdır.

**Bilinen tuzak:**

- Dosyanın başında BOM karakteri (`﻿`) var (satır 1). Dosyayı farklı bir editor'da açıp kaydedersen BOM kaybolabilir ve encoding sorunları çıkabilir. UTF-8 BOM'lu kaydet.

---

### `package.json` — Proje Manifest ve Build Config

**Yapılabilecekler:**

- `description`, `author` güncellenebilir.
- `devDependencies` sürümleri güncellenebilir (aşağıdaki uyarılara dikkat et).

**Yapılamayacaklar:**

- `build.publish` bloğu (`provider`, `owner`, `repo`) **değiştirilemez** — `electron-updater` bu config'i release URL'i bulmak için kullanır; yanlış değer tüm kullanıcıların otomatik güncellemesini kırar.
- `build.artifactName: "MySetup-Installer.exe"` değiştirilemez — `electron-updater` bu ismi arar; farklı isimde build olursa güncelleme bulunamaz.
- `main: "main.js"` değiştirilemez.
- `electron-updater` **`dependencies`'de** kalmalıdır (runtime bağımlılığı); `devDependencies`'e taşınamaz.
- `build.appId: "com.mysetup.app"` değiştirilemez — Windows kayıt defteri bu ID ile oluşturulur; değişirse güncelleme kurulumları çakışır ve kullanıcıda iki ayrı uygulama kaydı oluşur.

**Bilinen tuzak:**

- `version` alanı `update.bat` tarafından PowerShell ile okunup yazılır. Elle değiştirirsen semver formatından (`X.Y.Z`) sapma — `alpha`, `beta`, `rc` suffix'leri bat script'ini bozar.

---

### `update.bat` — Release Betiği (`.gitignore`'da)

> ⚠️ Bu dosya repository'de **bulunmaz**. Değiştirme, yeniden oluşturma veya commit etme. Aşağıdaki notlar yalnızca bu dosya üzerinde aktif çalışmak gerekirse geçerlidir.

**Kritik sorun — Patch ≥ 10'da versiyon mantığı bozulur:**

```bat
if "!vPat!"=="9" (...)   ← string karşılaştırma; "10" != "9" için geçmez
```

Versiyon yönetimine dokunulacaksa `npm version patch --no-git-tag-version` kullanılmalıdır.

**GH_TOKEN güvenliği:**

- Token `.env.bat`'tan okunur. Bu dosya yoksa betik durur. Token'ı hardcode etme, log'a basma, echo ile gösterme.

---

## ✅ Bitirmeden Önce Kontrol Listesi

- [ ] `npm start` ile uygulama açılıyor mu?
- [ ] Login / register çalışıyor mu?
- [ ] Ürün ekle / düzenle / sil çalışıyor mu?
- [ ] CSV export → import döngüsü çalışıyor mu? (Türkçe karakter kontrolü dahil)
- [ ] Filtreler (`sağlıklı`, `bozuk`, `yedek`, `atıldı`) çalışıyor mu?
- [ ] `npm run build` başarıyla tamamlanıyor mu?
- [ ] `git status` — `.env.bat`, `update.bat`, `dist/` commit'e girmiyor mu?

---

## 📍 Kritik Konum Özeti

| Dosya            | Amaç                                                 |
| ---------------- | ---------------------------------------------------- |
| `main.js`        | Electron ana süreç, updater, pencere yönetimi        |
| `preload.js`     | IPC köprüsü — Node ↔ Renderer                        |
| `js/firebase.js` | Firebase init, `database` ve `auth` export'u         |
| `js/auth.js`     | Auth akışları, `onAuthStateChanged`                  |
| `js/table.js`    | Tablo render, sıralama, filtreleme, istatistikler    |
| `js/modal.js`    | Ürün ekle/düzenle modal'ı, Firebase yazma            |
| `js/io.js`       | CSV içe/dışa aktarma                                 |
| `js/utils.js`    | Toast, format yardımcıları (global scope)            |
| `css/base.css`   | CSS değişkenleri, reset — tüm CSS'in temeli          |
| `index.html`     | Tek HTML dosyası, tüm DOM yapısı ve script yüklemesi |
| `package.json`   | Build config, publish config, versiyon               |
| `.env.bat`       | `GH_TOKEN` — **asla commit'e girmez**                |
