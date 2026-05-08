# AGENTS.md — MySetup v2.7.2

> Bu dosya, MySetup projesine kod müdahalesi yapacak her yapay zeka ajanı, editör eklentisi veya geliştirici için zorunlu okuma belgesidir.
> Projeyi ilk kez gören bir ajanın hata yapmaması için gereken tüm yapısal bilgi burada tanımlanmıştır.

---

## 0. Ajanın Çalışma Prensipleri

Bu dosya ve `OPTIMIZATIONS.md`, ajanın her işlemindeki mutlak referansıdır:

1. **AGENTS.md** → Mutlak kural kitabıdır; projeye dair tüm teknik ve yazımsal kurallar buradadır.
2. **OPTIMIZATIONS.md** → Proje sağlık durumu referansıdır;
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

| Dosya                     | Sorumluluk                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/firebase-config.js`   | Firebase config (`.gitignore`'da; yoksa `firebase-core.js` fallback kullanır)                                                                                                                                    |
| `js/utils.js`             | **Tüm global değişkenler**, DOM referansları, yardımcı fonksiyonlar, `scheduleRender`, `formatTimeAgo`, `DATE_FORMAT`, `parseDateInput`, `parsePriceInput`                                                        |
| `js/firebase-core.js` | Firebase init, `enrichItem()`, `initUserDataRef()`                                                                                                                                                                |
| `js/firebase-inv.js`  | Envanter CRUD: `addComponentToFirebase`, `replaceUserDataInFirebase`, `updateComponentInFirebase`, `updateComponentStatusInFirebase`, `deleteComponentFromFirebase`, `uploadImageToFirebase`, `deleteAllInFolder` |
| `js/firebase-user.js` | `deleteUserAccount()` (hesap silme işlemleri)                                                                                                                                                                     |
| `js/firebase-post.js` | Post CRUD + yorum/yanıt CRUD + beğeni işlemleri + listener'lar (`addPostToFirebase`, `togglePostLike`, `addCommentToFirebase`, `initUserLikesListener`, vb.)                                                      |
| `js/table.js`         | Render motoru, filtre/sıralama, istatistik önbelleği, CRUD UI eylemleri, event delegation                                                                                                                         |
| `js/io.js`            | Toast/confirm sistemi, arama debounce, CSV içe/dışa aktarma, tüm listeyi sil, **post/yorum/yanıt silme onayları** (`_confirmDeletePost`, vb.)                                                                     |
| `js/updater-ui.js`    | Güncelleme butonu ve IPC olayları (renderer tarafı)                                                                                                                                                               |
| `js/editmodal.js`     | Düzenleme modali, görsel yükleme/önizleme, yıldız derecelendirme, klavye kısayolları                                                                                                                              |
| `js/auth.js`          | Firebase Auth, oturum durumu, giriş/kayıt formları, şifre kontrolü                                                                                                                                                |
| `js/userset.js`       | Hesap ayarları, kullanıcı adı/şifre değiştirme, hesap silme                                                                                                                                                       |
| `js/post-comment.js`  | Yorum/yanıt HTML render, composer HTML, beğeni butonu DOM güncelleme                                                                                                                                              |
| `js/posts-render.js`  | Post kartı HTML render, görsel yükleme, feed DOM işlemleri, **post listener başlatma**, sayfalama, `initPosts()`, `_teardownPosts()`                                                                              |
| `js/posts-create.js`  | **Post oluşturma**, görsel seçimi, Firebase'e kayıt                                                                                                                                                               |
| `js/posts-actions.js` | Beğeni aksiyonları, yorum/yanıt gönderimi, gerçek zamanlı yorum listener'ı, event delegation, composer state yönetimi                                                                                             |
| `js/profile.js`       | Profil sekmesi yükleme, `_loadPostsChunk`, beğeni değişikliği, sayfa değişimi                                                                                                                                     |
| `js/post-view.js`     | Post View açma/kapama, render, yorum listener, scroll yönetimi                                                                                                                                                    |

### Renderer Process — CSS

| Dosya                  | Sorumluluk                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `css/base.css`         | CSS değişkenleri (`:root` - `clr-` prefix), reset, toast, loading, scroll, genel layout, responsive, sayfa düzeni |
| `css/sidebar.css`      | Logo, versiyon, nav menü, update butonu, user info, logout                                                        |
| `css/home.css`         | 700px akış içeriği, karşılama ekranı                                                                              |
| `css/profile.css`      | 700px profil içeriği, card, hesap ayarları butonu                                                                 |
| `css/inventory.css`    | İstatistik kartları, arama, filtre, import/export, tablo, durum menüsü                                            |
| `css/editmodal.css`    | Düzenleme modali, floating görsel önizleme, yıldız sistemi                                                        |
| `css/auth.css`         | Auth overlay, giriş/kayıt panelleri                                                                               |
| `css/userset.css`      | Ayarlar modalleri, kullanıcı adı düzenleme, tehlike alanı                                                         |
| `css/posts.css`        | Post create ve postların dışarıdan nasıl görüneceğini belirler                                                    |
| `css/post-view.css`    | Post özel sayfasının nasıl görüneceğini belirler                                                                  |
| `css/post-comment.css` | Post yorumlarının ve yanıtlarının nasıl görüneceğini belirler                                                     |

### Diğer

| Dosya          | Sorumluluk                                                                   |
| -------------- | ---------------------------------------------------------------------------- |
| `index.html`   | Tek sayfa; tüm HTML yapısı, script yükleme sırası, SVG template'ler          |
| `cors.json`    | Firebase Storage CORS; `gsutil cors set` ile uygulanır, doğrudan düzenlenmez |
| `package.json` | Bağımlılıklar ve `electron-builder` yapılandırması                           |

---

## 3. Bağımlılık Zinciri

```
firebase-config.js → Hiçbir şeye bağımlı değil; sadece `window.__FB_CONFIG__` set eder
utils.js         → Hiçbir şeye bağımlı değil; diğer her dosya buna bağımlıdır
firebase-core.js  → utils.js + firebase-config.js'e bağımlı (_resolveFirebaseConfig)
```

Bu sıra `index.html` içindeki `<script>` etiketlerinde sabittir. **Asla değiştirilemez.**

---

## 4. Global Değişkenler

Aşağıdaki değişkenler yalnızca `js/utils.js` içinde `let` veya `const` ile tanımlanır. Başka hiçbir dosyada yeniden tanımlanamaz; yalnızca doğrudan atama yapılabilir:

| Değişken               | Tip            | Tanımlandığı Dosya   | Açıklama                                            |
| ---------------------- | -------------- | -------------------- | --------------------------------------------------- |
| `allData`              | `{}`           | utils.js (satır 126) | Tüm Firebase verisinin anlık görüntüsü              |
| `currentSearch`        | `string`       | utils.js (satır 127) | Aktif arama sorgusu                                 |
| `currentStatusFilter`  | `string`       | utils.js (satır 128) | Aktif durum filtresi (`"all"` veya normalize değer) |
| `currentSort`          | `{ col, dir }` | utils.js (satır 129) | Aktif sıralama sütunu ve yönü                       |
| `editingId`            | `string\|null` | utils.js (satır 130) | Açık edit modalının kayıt ID'si                     |
| `_statsCache`          | `{}`           | utils.js (satır 155) | İstatistik önbelleği                                |
| `_commentListenerRefs` | `{}`           | utils.js (satır 15)  | Açık yorum listener referansları                    |
| `_currentPage`         | `null`         | utils.js (satır 13)  | Aktif sayfa adı                                     |
| `_isAnimating`         | `false`        | utils.js (satır 14)  | Sayfa geçiş animasyonu kontrolü                     |
| `_pendingPageQueue`    | `[]`           | utils.js (satır 15)  | Bekleyen sayfa geçiş kuyruğu                        |
| `_viewingPostId`       | `string\|null` | utils.js (satır 17)  | Şu an görüntülenen post ID'si                       |

### posts-render.js Global Durum Değişkenleri (posts-render.js içinde tanımlı)

| Değişken               | Tip     | Açıklama                           |
| ---------------------- | ------- | ---------------------------------- |
| `allPosts`             | `{}`    | Tüm post verisinin anlık görüntüsü |
| `_postsListenerActive` | `false` | Post listener aktif mi             |
| `_postsQuery`          | `null`  | Post query referansı               |
| `_oldestLoadedKey`     | `null`  | En eski yüklenen post anahtarı     |
| `_hasMorePosts`        | `false` | Daha fazla post var mı             |
| `_loadingMore`         | `false` | Post yükleniyor mu                 |

### posts-create.js Global Durum Değişkenleri (posts-create.js içinde tanımlı)

| Değişken            | Tip    | Açıklama             |
| ------------------- | ------ | -------------------- |
| `selectedPostImage` | `null` | Seçilen post görseli |

### posts-actions.js Global Durum Değişkenleri (posts-actions.js içinde tanımlı)

| Değişken                  | Tip    | Açıklama                        |
| ------------------------- | ------ | ------------------------------- |
| `_composerTargetPostId`   | `null` | Composer'ın hedef post ID'si    |
| `_composerReplyCommentId` | `null` | Composer'ın hedef yorum ID'si   |
| `_composerReplyUsername`  | `null` | Composer'ın hedef kullanıcı adı |
| `_timeUpdateInterval`     | `null` | Zaman güncelleme interval'i     |

### profile.js Global Durum Değişkenleri (profile.js içinde tanımlı)

| Değişken                 | Tip     | Açıklama                              |
| ------------------------ | ------- | ------------------------------------- |
| `_profileTab`            | `null`  | Aktif profil sekmesi                  |
| `_userPostsVisible`      | `Set`   | Görünür kullanıcı postları (BULGU-14) |
| `_userPostsOldestTs`     | `null`  | En eski kullanıcı post timestamp'i    |
| `_hasMoreUserPosts`      | `false` | Daha fazla kullanıcı postu var mı     |
| `_loadingMoreUserPosts`  | `false` | Kullanıcı postu yükleniyor mu         |
| `_likedPostsVisible`     | `Set`   | Görünür beğenilen postlar (BULGU-14)  |
| `_likedPostsOldestTs`    | `null`  | En eski beğenilen post timestamp'i    |
| `_hasMoreLikedPosts`     | `false` | Daha fazla beğenilen post var mı      |
| `_loadingMoreLikedPosts` | `false` | Beğenilen post yükleniyor mu          |

### Modül-İçi İstisna Değişkenleri

Aşağıdaki değişkenler yalnızca tanımlandıkları dosyanın kapsamındadır ve `utils.js`'e taşınmaz:

| Değişken                | Dosya        | Açıklama                        |
| ----------------------- | ------------ | ------------------------------- |
| `_resetRafId`           | editmodal.js | Preview sıfırlama RAF referansı |
| `currentRating`         | editmodal.js | Aktif yıldız derecelendirmesi   |
| `_previousPage`         | post-view.js | Gelinen sayfa adı               |
| `_previousScrollTop`    | post-view.js | Kaydedilen scroll pozisyonu     |
| `_replyTargetCommentId` | post-view.js | Yanıt verilen yorum ID'si       |
| `_replyTargetUsername`  | post-view.js | Yanıt verilen kullanıcı adı     |
| `_pvActiveNavBtn`       | post-view.js | Korunan nav buton referansı     |

---

## 5. Kritik Fonksiyonlar ve Kuralları

### `enrichItem(item)` — `js/firebase-core.js`

Firebase'den gelen ham veriyi `allData`'ya yazmadan önce bu fonksiyondan geçirmek **zorunludur**. `_searchTag` ve `_statusNorm` alanlarını ekler. Bu alanlar olmadan arama ve filtreleme çalışmaz.

### `initUserDataRef(uid)` — `js/firebase-core.js`

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

### `deleteAllInFolder(ref)` — `js/firebase-inv.js`

Storage'daki kullanıcı dosyalarını özyinelemeli siler. **Yalnızca hesap silme akışında** çağrılabilir.

### `_loadPostsChunk(cfg)` — `js/profile.js`

Profil sekmesi veri yükleme işlemlerini birleştiren ortak fonksiyondur. `config` nesnesi ile çalışır (BULGU-07 çözümü).

### `_initPostImage(img)` — `js/posts-render.js`

Post görsellerinin yüklendiğinde aspect ratio kontrolü yapar. CSP uyumlu `addEventListener` kullanır (BULGU-12 çözümü).

### `_renderPostHTML(postId, postData)` — `js/posts-render.js`

Post kartı HTML'ini oluşturur. Yorumları ve composer'ı çağırır.

### `_renderCommentComposerHTML(postId)` — `js/post-comment.js`

Ortak yorum/yanıt giriş alanı HTML'ini döndürür.

### `_renderCommentThreadHTML(postId, commentId, commentData)` — `js/post-comment.js`

Yorum + yanıtları kapsayan blok HTML'ini oluşturur.

### `_renderReplyHTML(postId, commentId, replyId, replyData)` — `js/post-comment.js`

Tek yanıt satırı HTML'ini döndürür.

### `initPosts()` — `js/posts-render.js`

Post sistemini başlatır, listener'ları kurar, sayfalama ayarlarını yapar.

### `createPost()` — `js/posts-create.js`

Yeni post oluşturur, görsel varsa yükler ve Firebase'e kaydeder.

---

## 6. Fonksiyon Haritası

### utils.js (14 fn)

`showPage`, `isAnyModalOpen`, `scheduleRender`, `normalizeTr`, `escHtml`, `escAttr`, `safeExternalUrl`, `applyPriceFormat`, `parseDateInput`, `parsePriceInput`, `formatTimeAgo`, `formatDateTime`, `DATE_FORMAT`, `getPostCards`

### firebase-core.js (4 fn)

`enrichItem`, `initUserDataRef`

### firebase-inv.js (7 fn)

`addComponentToFirebase`, `replaceUserDataInFirebase`, `updateComponentInFirebase`, `updateComponentStatusInFirebase`, `deleteComponentFromFirebase`, `uploadImageToFirebase`, `deleteAllInFolder`

### firebase-user.js (1 fn)

`deleteUserAccount`

### firebase-post.js (17 fn)

`addPostToFirebase`, `deletePostFromFirebase`, `togglePostLike`, `getUserPostsOnce`, `getUserLikesOnce`, `getPostsByIds`, `getPostsRef`, `addCommentToFirebase`, `deleteCommentFromFirebase`, `toggleCommentLike`, `addReplyToFirebase`, `deleteReplyFromFirebase`, `toggleReplyLike`, `initUserLikesListener`, `removeUserLikesListener`, `initUserPostsListener`, `removeUserPostsListener`

### table.js (23 fn)

`getFilteredSortedList`, `rebuildStatsCache`, `updateStatsCacheOnChange`, `updateStats`, `updateResultCount`, `updateSortIcons`, `getStatusClassName`, `buildStatusCellInnerHTML`, `buildCombinedSpecsCellHTML`, `buildRowHTML`, `buildGroupRowHTML`, `createRowEl`, `buildRowsFragment`, `renderTableRows`, `renderAll`, `_countVisibleItems`, `isItemVisible`, `addOrUpdateTableRow`, `removeTableRow`, `updateItemStatus`, `deleteItem`, `initiateAddRow`, `submitNewItem`, `initTableBodyEvents`

### io.js (4 fn + event handlers + 3 delete fn)

`showToast`, `showConfirm`, `parseCsvLine`, `processCsv`, `_confirmDeletePost`, `_confirmDeleteComment`, `_confirmDeleteReply`

### post-comment.js (~200 satır)

`_renderCommentComposerHTML`, `_renderCommentThreadHTML`, `_renderReplyHTML`, `_patchCommentLikeBtn`, `_patchReplyLikeBtn`

### posts-render.js (~500 satır)

`_renderPostHTML`, `_initPostImage`, `_handlePostImageLoad`, `_prependPostToFeed`, `_appendPostToFeed`, `_patchPostCard`, `_patchPostLikes`, `_softRemovePost`, `_renderEmptyFeed`, `initPosts`, `_teardownPosts`, `_startPostsListener`, `_checkHasMorePosts`, `_listenForNewPosts`, `_getNewestTimestamp`, `_loadMorePosts`, `_renderLoadMoreBtn`, `_removeLoadMoreBtn`

### posts-create.js (~180 satır)

`createPost`, `_uploadAndSavePost`, `_savePost`, `_handlePostImageSelect`, `_removePostImage`, `clearPostDraft`

### posts-actions.js (~560 satır)

`_togglePostLike`, `_toggleCommentLike`, `_toggleReplyLike`, `_submitComposer`, `_startReplyMode`, `_cancelReplyMode`, `_openRepliesSection`, `_initCommentListener`, `_refreshCommentThread`, `_updateCommentCount`, `_onlyLikesChanged`, click/keydown delegation, zaman güncellemesi

### profile.js (~375 satır)

`updateProfilePosts`, `switchProfileTab`, `_initUserPostsTab`, `_initLikedPostsTab`, `_loadPostsChunk`, `_onUserLikesChanged`, `_onUserPostsChanged`, `_appendOrPrependToProfileTab`, `_renderProfileLoadMoreBtn`, `_removeProfileLoadMoreBtn`, `_onPageChange`, profil sekme event listener'ları

### editmodal.js (17 fn)

`applyAdaptiveSize`, `refreshPreview`, `handleImageFile`, `_resetPreviewInstant`, `updateStars`, `openEditModal`, `closeEditModal`, `saveEditModal`, modal event listeners, klavye kısayolları

### auth.js (6 fn)

`initNavigation`, `hideLoading`, `getAuthErrorMessage`, `onUserLoggedIn`, `onUserLoggedOut`, `validatePasswords`

### userset.js (7 fn)

`closeSettingsModal`, `closeChangePassModal`, `closeDeleteModal`, `openSettingsModal`, `goBackToSettings`, `resetUsernameEditState`

### updater-ui.js (2 fn)

`startDotAnimation`, `stopDotAnimation`

### post-view.js (~450 satır)

`openPostView`, `closePostView`, `_renderPostViewContent`, `_initPostViewCommentListener`, `_updatePostViewCommentCount`, `_setPostViewReplyTarget`, `_clearPostViewReplyTarget`, `_submitPostViewComment`

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
- `firebase.js` içindeki kodları izole etmeden yeni firebase dosyası eklemek (v2.8.0 kuralı)

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
- Firebase işlemlerini mantıksal parçalara bölmek (`firebase-core`, `firebase-inv`, `firebase-user`, `firebase-post`) (v2.8.0 yeniliği)

---

## 10. Firebase SDK

**Compat SDK v9.22.1** — CDN üzerinden yüklenir (`index.html`). Modular SDK sentaksı yasaktır.

```html
<!-- Doğru -->
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>

<!-- Yasak -->
import { initializeApp } from 'firebase/app';
```

`firebase.apps.length` kontrolü `firebase-core.js`'de yapılıyor; ikinci `initializeApp` çağrısı hata üretir.

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
- Firebase dosya yapısı: `firebase-core.js`, `firebase-inv.js`, `firebase-user.js`, `firebase-post.js` ayrımı

---
