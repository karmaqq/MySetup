# AGENTS.md — MySetup v2.5.3

> Bu dosya, MySetup projesine kod müdahalesi yapacak her yapay zeka ajanı, editör eklentisi veya geliştirici için zorunlu okuma belgesidir.
> Projeyi ilk kez gören bir ajanın hata yapmaması için gereken tüm yapısal bilgi burada tanımlanmıştır.

---

## 0. Ajanın Çalışma Prensipleri

Bu dosya ve `OPTIMIZATIONS.md`, ajanın her işlemindeki mutlak referansıdır:

1. **AGENTS.md** → Mutlak kural kitabıdır; projeye dair tüm teknik ve yazımsal kurallar buradadır.
2. **OPTIMIZATIONS.md** → Proje sağlık durumu referansıdır; tüm bulgular çözülmüştür.
3. **Kullanıcı talimatı** → Her zaman 1. önceliktir. Kullanıcı "yapma" derse yapılmaz, "yap" derse yapılır.
4. **Güncel veri kullanımı** → Ajan, kendi önceki deneyimlerinden hatırladığı kuralları değil, her zaman bu iki dosyadaki en güncel hali referans alır.
5. **İşlem öncesi ve sonrası kontrol** → Her kod değişikliği öncesi ve sonrası bu iki dosya okunur ve kurallara uygun hareket edilir.
6. **Kendi yöntemini dayatma** → Kod değişikliği yaparken kendi bildiği yöntemi değil, bu dosyadaki yönergeleri uygular.
7. **Gelişime açık tasarım** → Proje daima gelişmeye uygun şekilde dizayn edilmeli; yenilikçi ve gelişime açık fonksiyonlar kullanılmalıdır.
8. **Modüler yapı ve harita sistemi** → Dosya yapısı ne kadar çok olursa olsun her zaman modüler olmalıdır. Her dosya ve fonksiyon birbiri ile bağlantılı bir harita sistemi kullanmalıdır (bu harita AGENTS.md içinde bulunur; bkz. Bölüm 3, 4, 5).
9. **Temiz kod zorunluluğu** → İşlemi bitmiş, üzerinde uğraşılmayan bir fonksiyon daima temiz ve çalışır vaziyette bırakılmalıdır.

---

## 1. Proje Mimarisi

MySetup, **Electron** çatısı üzerine kurulu bir masaüstü envanter uygulamasıdır. İki bağımsız süreç vardır:

**Main Process (Node.js):** `main.js`, `preload.js`, `js/updater.js`
**Renderer Process (Tarayıcı):** `index.html` ve tüm `js/` + `css/` dosyaları

Renderer tarafında `import` / `export` / `require` kesinlikle kullanılamaz. Bundler yoktur. Tüm paylaşılan değişkenler global scope üzerinden erişilir.

---

## 2. Dosya Haritası

### Main Process

| Dosya           | Sorumluluk                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| `main.js`       | Electron penceresi, CSP başlıkları, uygulama yaşam döngüsü, güncelleme başlatma |
| `preload.js`    | IPC köprüsü; yalnızca bu dosyadan `contextBridge.exposeInMainWorld` çağrılır    |
| `js/updater.js` | `electron-updater` kurulumu; `autoDownload: false` kasıtlı                      |

### Renderer Process — JavaScript (yükleme sırası bu şekilde korunmalı)

| Dosya              | Sorumluluk                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `js/utils.js`      | **Tüm global değişkenler**, DOM referansları, yardımcı fonksiyonlar, `scheduleRender`, `formatTimeAgo`, `DATE_FORMAT`, `parseDateInput`, `parsePriceInput` |
| `js/firebase.js`   | Firebase init, `allData` CRUD, realtime listener yönetimi, `enrichItem()`, **post CRUD**, `initPostsListener`, yorum/yanıt CRUD |
| `js/table.js`      | Render motoru, filtre/sıralama, istatistik önbelleği, CRUD UI eylemleri, event delegation                                |
| `js/io.js`         | Toast/confirm sistemi, arama debounce, CSV içe/dışa aktarma, tüm listeyi sil                                           |
| `js/updater-ui.js` | Güncelleme butonu ve IPC olayları (renderer tarafı)                                                                    |
| `js/editmodal.js`  | Düzenleme modali, görsel yükleme/önizleme, yıldız derecelendirme, klavye kısayolları                                   |
| `js/auth.js`       | Firebase Auth, oturum durumu, giriş/kayıt formları, şifre kontrolü                                     |
| `js/userset.js`    | Hesap ayarları, kullanıcı adı/şifre değiştirme, hesap silme                                                            |
| `js/posts.js`      | **Post sistemi ana modül**, oluşturma, silme, akış yönetimi, sayfalama, listener başlatma  |
| `js/posts-render.js` | Post/yorum/yanıt HTML render, görsel yükleme, feed DOM işlemleri |
| `js/posts-actions.js` | Beğeni & silme aksiyonları, yorum/yanıt gönderimi, gerçek zamanlı yorum listener'ı, event delegation |
| `js/posts-profile.js` | Profil sekmesi yükleme, `_loadPostsChunk`, beğeni değişikliği, sayfa değişimi |

### Renderer Process — CSS

| Dosya               | Sorumluluk                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `css/base.css`      | CSS değişkenleri (`:root`), reset, toast, loading, scroll, genel layout, responsive, sayfa düzeni |
| `css/sidebar.css`   | Logo, versiyon, nav menü, update butonu, user info, logout                                        |
| `css/home.css`      | 700px akış içeriği, karşılama ekranı                                                              |
| `css/profile.css`   | 700px profil içeriği, card, hesap ayarları butonu                                         |
| `css/inventory.css` | İstatistik kartları, arama, filtre, import/export, tablo, durum menüsü                            |
| `css/editmodal.css` | Düzenleme modali, floating görsel önizleme, yıldız sistemi                                        |
| `css/auth.css`      | Auth overlay, giriş/kayıt panelleri                                                               |
| `css/userset.css`   | Ayarlar modalleri, kullanıcı adı düzenleme, tehlike alanı                                         |

### Diğer

| Dosya          | Sorumluluk                                                                   |
| -------------- | ---------------------------------------------------------------------------- |
| `index.html`   | Tek sayfa; tüm HTML yapısı, script yükleme sırası, SVG template'ler          |
| `cors.json`    | Firebase Storage CORS; `gsutil cors set` ile uygulanır, doğrudan düzenlenmez |
| `package.json` | Bağımlılıklar ve `electron-builder` yapılandırması                           |

---

## 3. Bağımlılık Zinciri

```
utils.js        → Hiçbir şeye bağımlı değil; diğer her dosya buna bağımlıdır
firebase.js     → utils.js'e bağımlı (allData, normalizeTr, _statsCache)
table.js        → utils.js + firebase.js'e bağımlı
io.js           → utils.js + table.js + firebase.js'e bağımlı
updater-ui.js   → utils.js'e bağımlı (window.electronAPI)
editmodal.js    → utils.js + firebase.js + io.js'e bağımlı
auth.js         → utils.js + firebase.js + editmodal.js + userset.js'e bağımlı
userset.js      → utils.js + firebase.js + auth.js'e bağımlı
posts.js        → utils.js + firebase.js + posts-render.js + posts-actions.js + posts-profile.js'e bağımlı
posts-render.js → utils.js + firebase.js + posts.js'e bağımlı
posts-actions.js→ utils.js + firebase.js + posts-render.js + io.js'e bağımlı
posts-profile.js→ utils.js + firebase.js + posts-render.js + posts-actions.js'e bağımlı
```

Bu sıra `index.html` içindeki `<script>` etiketlerinde sabittir. **Asla değiştirilemez.**

---

## 4. Global Değişkenler

Aşağıdaki değişkenler yalnızca `js/utils.js` içinde `let` veya `const` ile tanımlanır. Başka hiçbir dosyada yeniden tanımlanamaz; yalnızca doğrudan atama yapılabilir:

| Değişken              | Tip            | Tanımlandığı Dosya | Açıklama                                            |
| --------------------- | -------------- | ------------------ | -------------------------------------------------- |
| `allData`             | `{}`           | utils.js (satır 126) | Tüm Firebase verisinin anlık görüntüsü              |
| `currentSearch`       | `string`       | utils.js (satır 127) | Aktif arama sorgusu                                 |
| `currentStatusFilter` | `string`       | utils.js (satır 128) | Aktif durum filtresi (`"all"` veya normalize değer) |
| `currentSort`         | `{ col, dir }` | utils.js (satır 129) | Aktif sıralama sütunu ve yönü                       |
| `editingId`           | `string\|null` | utils.js (satır 130) | Açık edit modalının kayıt ID'si                     |
| `_statsCache`         | `{}`           | utils.js (satır 155) | İstatistik önbelleği                                |
| `_commentListenerRefs` | `{}`           | utils.js (satır 15)  | Açık yorum listener referansları                     |
| `_currentPage`        | `null`         | utils.js (satır 13)  | Aktif sayfa adı                                     |
| `_isAnimating`        | `false`        | utils.js (satır 14)  | Sayfa geçiş animasyonu kontrolü                     |

### posts.js Global Durum Değişkenleri (posts.js içinde tanımlı)

| Değişken              | Tip            | Açıklama                                            |
| --------------------- | -------------- | -------------------------------------------------- |
| `allPosts`            | `{}`           | Tüm post verisinin anlık görüntüsü                   |
| `selectedPostImage`   | `null`         | Seçilen post görseli                                |
| `_postsListenerActive`| `false`        | Post listener aktif mi                              |
| `_oldestLoadedKey`    | `null`         | En eski yüklenen post anahtarı                       |
| `_hasMorePosts`       | `false`        | Daha fazla post var mı                              |
| `_loadingMore`        | `false`        | Post yükleniyor mu                                   |
| `_profileTab`         | `null`         | Aktif profil sekmesi                                |
| `_userPostsVisible`   | `Set`          | Görünür kullanıcı postları (BULGU-14)               |
| `_likedPostsVisible`  | `Set`          | Görünür beğenilen postlar (BULGU-14)               |

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

**Önemli:** `updateStatsCacheOnChange` içinde `normalizeTr(item.status)` YERİNE `item._statusNorm` kullanılmalıdır. `rebuildStatsCache` içinde de aynı kural geçerlidir.

### `deleteAllInFolder(ref)` — `js/firebase.js`

Storage'daki kullanıcı dosyalarını özyinelemeli siler. **Yalnızca hesap silme akışında** çağrılabilir.

### `_loadPostsChunk(cfg)` — `js/posts-profile.js`

Profil sekmesi veri yükleme işlemlerini birleştiren ortak fonksiyondur. `config` nesnesi ile çalışır (BULGU-07 çözümü).

### `_initPostImage(img)` — `js/posts-render.js`

Post görsellerinin yüklendiğinde aspect ratio kontrolü yapar. CSP uyumlu `addEventListener` kullanır (BULGU-12 çözümü).

---

## 6. Fonksiyon Haritası

### utils.js (13 fn)

`showPage`, `isAnyModalOpen`, `scheduleRender`, `normalizeTr`, `escHtml`, `escAttr`, `safeExternalUrl`, `applyPriceFormat`, `parseDateInput`, `parsePriceInput`, `formatTimeAgo`, `formatDateTime`, `DATE_FORMAT`

### firebase.js (23 fn)

**Envanter:** `enrichItem`, `initUserDataRef`, `addComponentToFirebase`, `replaceUserDataInFirebase`, `updateComponentInFirebase`, `updateComponentStatusInFirebase`, `deleteComponentFromFirebase`, `uploadImageToFirebase`, `deleteAllInFolder`  
**Post:** `addPostToFirebase`, `deletePostFromFirebase`, `togglePostLike`, `getUserPostsOnce`, `getUserLikesOnce`, `getPostsByIds`  
**Yorum:** `addCommentToFirebase`, `deleteCommentFromFirebase`, `toggleCommentLike`, `addReplyToFirebase`, `deleteReplyFromFirebase`, `toggleReplyLike`, `initUserLikesListener`, `removeUserLikesListener`

### table.js (23 fn)

`getFilteredSortedList`, `rebuildStatsCache`, `updateStatsCacheOnChange`, `updateStats`, `updateResultCount`, `updateSortIcons`, `getStatusClassName`, `buildStatusCellInnerHTML`, `buildCombinedSpecsCellHTML`, `buildRowHTML`, `buildGroupRowHTML`, `createRowEl`, `buildRowsFragment`, `renderTableRows`, `renderAll`, `_countVisibleItems`, `isItemVisible`, `addOrUpdateTableRow`, `removeTableRow`, `updateItemStatus`, `deleteItem`, `initiateAddRow`, `submitNewItem`, `initTableBodyEvents`

### io.js (4 fn + event handlers)

`showToast`, `showConfirm`, `parseCsvLine`, `processCsv`

### posts.js (~429 satır)

`initPosts`, `_teardownPosts`, `_startPostsListener`, `_checkHasMorePosts`, `_listenForNewPosts`, `_getNewestTimestamp`, `_loadMorePosts`, `_renderLoadMoreBtn`, `_removeLoadMoreBtn`, `createPost`, `_uploadAndSavePost`, `_savePost`, `_handlePostImageSelect`, `_removePostImage`, `clearPostDraft`

### posts-render.js (~545 satır)

`_renderPostHTML`, `_renderCommentComposerHTML`, `_renderCommentThreadHTML`, `_renderReplyHTML`, `_initPostImage`, `_handlePostImageLoad`, `_prependPostToFeed`, `_appendPostToFeed`, `_patchPostCard`, `_patchPostLikes`, `_softRemovePost`, `_renderEmptyFeed`, `_patchCommentLikeBtn`, `_patchReplyLikeBtn`

### posts-actions.js (~628 satır)

`_togglePostLike`, `_toggleCommentLike`, `_toggleReplyLike`, `_confirmDeletePost`, `_confirmDeleteComment`, `_confirmDeleteReply`, `_submitComposer`, `_startReplyMode`, `_cancelReplyMode`, `_toggleCommentSection`, `_openRepliesSection`, `_initCommentListener`, `_refreshCommentThread`, `_updateCommentCount`, `_onlyLikesChanged`, click/keydown delegation, zaman güncellemesi

### posts-profile.js (~302 satır)

`updateProfilePosts`, `switchProfileTab`, `_initUserPostsTab`, `_initLikedPostsTab`, `_loadPostsChunk`, `_onUserLikesChanged`, `_appendOrPrependToProfileTab`, `_renderProfileLoadMoreBtn`, `_removeProfileLoadMoreBtn`, `_onPageChange`, profil sekme event listener'ları

### editmodal.js (17 fn)

`applyAdaptiveSize`, `refreshPreview`, `handleImageFile`, `_resetPreviewInstant`, `updateStars`, `openEditModal`, `closeEditModal`, `saveEditModal`, modal event listeners, klavye kısayolları

### auth.js (6 fn)

`initNavigation`, `hideLoading`, `getAuthErrorMessage`, `onUserLoggedIn`, `onUserLoggedOut`, `validatePasswords`

### userset.js (7 fn)

`closeSettingsModal`, `closeChangePassModal`, `closeDeleteModal`, `openSettingsModal`, `goBackToSettings`, `resetUsernameEditState`

### updater-ui.js (2 fn)

`startDotAnimation`, `stopDotAnimation`

---

## 7. Altın Kural: Yorum Stili

**Bu kural ihlal edilemez. Kod değişikliği yapmadan önce mutlaka okunmalıdır.**

Projedeki her `.js` ve `.css` dosyası aynı yorum diline sahiptir. Ajan kendi yorum stilini dayatamaz, standart dışı yorum ekleyemez, mevcut yorum bloklarını değiştiremez.

### 7.1 Bölüm Başlığı

Dosyada mantıksal olarak yeni bir ana grup açılıyorsa kullanılır. İki satır çerçeve, ortada başlık:

```js
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

CSS dosyalarında aynı kural geçerlidir.

### 7.2 Alt Grup Başlığı

Bir bölüm içinde tematik olarak gruplanmış kod bloğu başlamadan önce kullanılır:

```js
/* ─────────────────── Başlık ─────────────────── */
```

### 7.3 Fonksiyon İçi Yorum

Bir fonksiyon birden fazla adım içeriyorsa, yalnızca adım başları numaralandırılır. Satır içi `//` veya gövdeye gömülü `/* */` kesinlikle yasaktır:

```js
function submitNewItem(tr, inputs) {
  // 1. Zorunlu alan kontrolü
  // 2. Tarihi ISO formatına çevir
  // 3. Firebase'e gönder
}
```

Tek adımlı fonksiyonlara yorum eklenmez.

### 7.4 Yasak Yorum Kalıpları

Aşağıdakilerin hiçbiri projede yer alamaz:

```js
// Bu fonksiyon X'i yapıyor                   ← YASAK: açıklayıcı satır içi yorum
const x = a + b; // toplam                    ← YASAK: satır sonu yorumu
/* Burada şunu yaptık çünkü... */             ← YASAK: gövde içi blok yorum
// TODO: ileride düzelt                        ← YASAK: işaretleyici yorum
```

---

## 8. Yapamayacakları (Yasak İşlemler)

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

## 9. Yapabilecekleri (İzin Verilen İşlemler)

- `js/utils.js`'deki yardımcı fonksiyon listesine yeni fonksiyon eklemek
- Yeni harici kaynak gerekiyorsa hem `APP_CSP` hem ilgili directive güncellenmek şartıyla CDN eklemek
- `css/base.css → :root` içine yeni CSS değişkeni eklemek
- `addComponentToFirebase`, `updateComponentInFirebase` gibi mevcut Firebase yazma fonksiyonlarını kullanmak
- `showToast`, `showConfirm` fonksiyonlarını her dosyadan çağırmak
- Yeni modal eklemek; eklenen her yeni `.modal-overlay` için `MutationObserver`'ın gözlemleyeceği listeye dahil etmek (`table.js` başındaki IIFE)
- `preload.js`'e yeni IPC kanalı eklemek — her kanal için `onceListener` pattern'i kullanmak
- `cors.json`'ı yalnızca Firebase Console'dan Storage CORS ayarı için güncellemek

---

## 10. Firebase SDK

**Compat SDK v9.22.1** — CDN üzerinden yüklenir (`index.html`). Modular SDK sentaksı yasaktır.

```html
<!-- Doğru -->
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>

<!-- Yasak -->
import { initializeApp } from 'firebase/app';
```

`firebase.apps.length` kontrolü `firebase.js`'de yapılıyor; ikinci `initializeApp` çağrısı hata üretir.

---

## 11. CSP Yapısı

CSP, `main.js → setupCspHeaders()` içinde tanımlı `APP_CSP` dizisiyle yönetilir.

Kritik kısıtlamalar:

- `'unsafe-eval'` **yoktur** ve eklenemez
- `font-src 'self' data:'` — harici font CDN'i için bu direktif güncellenmeli
- Yeni bir harici kaynak gerektiğinde yalnızca `APP_CSP` dizisine eklenir; başka bir yere yazılmaz

---

## 12. Kullanıcı Adı Benzersizliği

Kullanıcı adı değiştirme (`userset.js → saveBtn`) Firebase transaction ile korunur:

- Transaction commit edilmeden eski kullanıcı adı silinemez
- Bu iki adım hiçbir zaman ayrılmamalı veya sırası değiştirilmemelidir

Kayıt akışında (`auth.js`) ise `once("value")` kontrolü + `set` yazımı non-atomiktir; TOCTOU riski mevcuttur.

---

## 13. Doğrulama Prosedürü

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
- Post oluşturma, beğenme, yorum/yanıt ekleme
- Post görsel yükleme ve kaldırma
- Profil sekmeleri (Gönderilerim / Beğenilenler)

---

## 14. OPTIMIZATIONS.md ile İlişki

Bekleyen optimizasyon bulguları `OPTIMIZATIONS.md` dosyasında belgelenmiştir. Tüm bulgular çözülmüştür ve durumları `✅ Uygulandı` olarak işaretlenmiştir. Kod değişikliği yapmadan önce ilgili bulgu okunmalı, değişiklik sonrası tablodaki durum kontrol edilmelidir.

---

_Son güncelleme: 2026-05-04 — MySetup v2.5.3 — Tüm bulgular çözülmüştür_
