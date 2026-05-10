# AGENTS.md — MySetup v3.0.9

Elektron 33 masaüstü envanter uygulaması. Tamamen TypeScript (191 fonksiyon), esbuild ile derlenir. Firebase Realtime Database + Auth + Storage kullanır.

**Yazar:** Karma (`shbkarma@gmail.com`)

---

## Hızlı Başlangıç

```bash
npm run build:ts    # Derle (esbuild ~0.05s)
npm run start       # Çalıştır
npm run dev         # Derle + Çalıştır
npm run build       # Derle + electron-builder (NSIS installer)
npm run build:full  # clean + build + electron-builder
```

---

## Mimari

İki bağımsız Electron süreci, beş ayrı esbuild çıktısı:

| Süreç | Kaynak | Derlenen | Format |
|---|---|---|---|
| Main | `src/main/main.ts` | `dist/main.js` | CJS (transpile, bundle yok) |
| Preload | `src/main/preload.ts` | `dist/preload.js` | CJS (transpile, bundle yok) |
| Updater | `src/updater/updater.ts` | `dist/updater.js` | CJS (transpile, bundle yok) |
| Renderer | `src/renderer/index.ts` (+19 modül) | `dist/renderer.js` | IIFE (tek bundle, minify) |
| CSS | `css/index.css` (12 dosya) | `dist/styles.css` | CSS bundle (minify) |

**Build sistemi:** `node build.mjs` — esbuild ile beş çıktıyı da paralel üretir (`--watch` modu destekler).

Renderer TEK bir IIFE bundle'dir (`dist/renderer.js`). CSS 12 ayrı dosyadan tek bundle'a derlenir (`dist/styles.css`). `index.html` yalnızca:
1. Firebase CDN script'leri (compat SDK v9.22.1: app, database, auth, storage)
2. `js/firebase-config.js` (API anahtarları — `.gitignore`'da)
3. `dist/renderer.js`
4. `dist/styles.css`

**Production build'de** (`node build.mjs`):
- Renderer: `minify: true`, `sourcemap: false` — kod okunamaz
- CSS: `minify: true` — yorumlar ve boşluklar temizlenir

**Watch modunda** (`--watch`):
- Renderer: `minify: false`, `sourcemap: true` — geliştirme için okunabilir
- CSS: `minify: false` — geliştirme için okunabilir

---

## Firebase

**Compat SDK v9.22.1** — CDN üzerinden global `firebase` nesnesi ile kullanılır.

```typescript
// DOĞRU
const user = firebase.auth().currentUser;
const ref = firebase.database().ref("posts");
const storageRef = firebase.storage().ref();

// YANLIŞ (YASAK)
import { initializeApp } from "firebase/app";
```

### Veritabanı Yapısı

```
/posts/{postId}
  ├── uid, username, content, imageUrl
  ├── createdAt (timestamp), phraseIndex
  ├── likes/{userId}: true
  └── comments/{commentId}
        ├── uid, username, text, createdAt
        ├── likes/{userId}: true
        └── replies/{replyId}
              ├── uid, username, text, createdAt
              └── likes/{userId}: true

/users/{userId}/components/{itemId}
  ├── date, component, brand, specs, price, vendor, status
  ├── url, imageUrl, star, opinion
  └── _searchTag, _statusNorm (runtime'da enrichItem ile eklenir)

/userPosts/{userId}/{postId}: timestamp
/userLikes/{userId}/{postId}: timestamp
/usernames/{usernameKey}: uid
```

### Firebase Kuralları

- `firebase-init.ts` dışında `initializeApp` çağrılamaz
- `enrichItem()` ham veriyi `allData`'ya yazmadan önce çağrılmalıdır
- `initUserDataRef()` başında `userDataRef.off()` vardır — kaldırılamaz

---

## Proje Yapısı

```
mysetup/
├── build.mjs               # esbuild yapı sistemi
├── package.json             # v3.0.9, electron 33, electron-updater
├── tsconfig.json            # Renderer tip kontrolü (DOM lib)
├── tsconfig.main.json       # Main process tip kontrolü (Node lib)
├── index.html               # Ana sayfa (1070 satır, inline SVG template'ler)
├── js/
│   └── firebase-config.js   # Firebase API anahtarları (.gitignore)
├── css/                     # 12 CSS kaynak dosyası + index.css (bundle girişi)
├── assets/                  # icon.ico
├── scripts/
│   └── clean-locales.js     # electron-builder afterPack
└── src/
    ├── main/
    │   ├── main.ts          # Pencere, CSP, yaşam döngüsü (124 satır)
    │   └── preload.ts       # IPC contextBridge (46 satır)
    ├── updater/
    │   └── updater.ts       # electron-updater kurulumu (82 satır)
    └── renderer/
        ├── index.ts         # Entry point, tüm modülleri import eder
        ├── utils.ts         # Global değişkenler, yardımcılar (495 satır)
        ├── firebase-init.ts # Firebase başlatma, db referansları (43 satır)
        ├── firebase-core.ts # enrichItem, initUserDataRef (134 satır)
        ├── firebase-inv.ts  # Envanter CRUD + Storage (61 satır)
        ├── firebase-post.ts # Post/yorum/yanıt CRUD (257 satır)
        ├── firebase-user.ts # Hesap silme (79 satır)
        ├── auth.ts          # Giriş/kayıt, oturum yönetimi (331 satır)
        ├── io.ts            # Toast/confirm bildirimleri (156 satır)
        ├── editmodal.ts     # Düzenleme modalı, görsel yükleme (343 satır)
        ├── table.ts         # Tablo render, sıralama, CRUD (676 satır)
        ├── toolbar.ts       # İstatistik, arama, filtre, CSV (417 satır)
        ├── profile.ts       # Profil sekmeleri (438 satır)
        ├── posts-create.ts  # Post oluşturma, görsel seçimi (187 satır)
        ├── posts-render.ts  # Post akışı render, sayfalama (464 satır)
        ├── posts-actions.ts # Beğeni, yorum gönderme, event delegation (618 satır)
        ├── post-view.ts     # Post view aç/kapa, yorumlar (541 satır)
        ├── post-comment.ts  # Yorum/yanıt HTML render (192 satır)
        ├── updater-ui.ts    # Güncelleme butonu animasyonu (118 satır)
        ├── userset.ts       # Hesap ayarları, şifre değiştirme (384 satır)
        └── types/
            ├── firebase.d.ts # Firebase compat SDK tipleri
            └── global.d.ts   # Window interface genişletmesi
```

---

## Fonksiyon Dağılımı

| Dosya | Sayı |
|---|---|
| `src/main/main.ts` | 2 |
| `src/main/preload.ts` | 7 |
| `src/renderer/index.ts` | 0 |
| `src/renderer/auth.ts` | 6 |
| `src/renderer/editmodal.ts` | 8 |
| `src/renderer/firebase-core.ts` | 2 |
| `src/renderer/firebase-init.ts` | 1 |
| `src/renderer/firebase-inv.ts` | 7 |
| `src/renderer/firebase-post.ts` | 17 |
| `src/renderer/firebase-user.ts` | 1 |
| `src/renderer/io.ts` | 7 |
| `src/renderer/post-comment.ts` | 6 |
| `src/renderer/post-view.ts` | 11 |
| `src/renderer/posts-actions.ts` | 12 |
| `src/renderer/posts-create.ts` | 6 |
| `src/renderer/posts-render.ts` | 20 |
| `src/renderer/profile.ts` | 19 |
| `src/renderer/table.ts` | 19 |
| `src/renderer/toolbar.ts` | 6 |
| `src/renderer/updater-ui.ts` | 2 |
| `src/renderer/userset.ts` | 8 |
| `src/renderer/utils.ts` | 26 |
| `src/updater/updater.ts` | 2 |
| **Toplam** | **195** |

---

## Build Sistemi

`build.mjs` — esbuild ile 4 çıktı üretir:

- **Renderer:** `bundle: true, format: "iife", globalName: "__mySetup", platform: "browser", target: "es2020"`
- **Main/Preload/Updater:** `bundle: false, format: "cjs", platform: "node", target: "node16"`
- **CSS:** `bundle: true, minify: true` — 12 CSS dosyası `css/index.css` üzerinden tek bundle'a derlenir

Renderer tek IIFE bundle'dır. Circular dependency (`toolbar.ts` ↔ `table.ts`) esbuild tarafından runtime'da çözülür.

---

## İmport Zinciri (Renderer)

```
firebase-init.ts  →  db nesnesi, 0 bağımlılık
utils.ts          →  Global değişkenler + yardımcılar, 0 bağımlılık
firebase-core.ts  →  firebase-init + utils + toolbar + table
toolbar.ts        →  utils + table + io + firebase-init + firebase-inv
table.ts          →  utils + firebase-inv + io + editmodal + toolbar
```

Bu sıra `index.ts`'deki import sırasıyla korunur. **Asla bozulmaz.**

---

## Cross-Module State

esbuild IIFE bundle'ında `export let` değerleri başka modüllerde read-only binding'dir. Mutasyon için setter veya `(window as any)` kullanılır.

### Utils'te tanımlı global değişkenler

| Değişken | Tip | Setter |
|---|---|---|
| `allData` | `Record<string, any>` | Doğrudan mutation |
| `currentSearch` | `string` | `setCurrentSearch(v)` |
| `currentStatusFilter` | `string` | `setCurrentStatusFilter(v)` |
| `currentSort` | `{ col, dir }` | Doğrudan mutation |
| `editingId` | `string \| null` | `setEditingId(v)` |
| `_currentPage` | `string` | Doğrudan mutation |
| `_statsCache` | `StatsCache` | Doğrudan mutation |
| `_commentListenerRefs` | `Record<string, any>` | Doğrudan mutation |

### Window üzerinden paylaşılan değişkenler

| İsim | Tanımlandığı Yer | Kullanıldığı Yer |
|---|---|---|
| `allPosts` | `posts-render.ts` | `posts-actions.ts`, `io.ts`, `firebase-user.ts` |
| `_viewingPostId` | `utils.ts` (Object.defineProperty) | `post-view.ts`, `posts-render.ts` |
| `_profileTab` | `profile.ts` | `utils.ts`, `post-view.ts` |
| `_postsListenerActive` | `posts-render.ts` | `posts-actions.ts` |
| `openPostView` / `closePostView` | `post-view.ts` | `posts-actions.ts`, event handler'lar |
| `renderAll` | `table.ts` | `utils.ts` (scheduleRender) |
| `updateProfilePosts` | `profile.ts` | `utils.ts` (showPage) |
| `clearPostDraft` | `posts-create.ts` | `utils.ts` (showPage) |
| `_onUserLikesChanged` / `_onUserPostsChanged` | `profile.ts` | `posts-render.ts` (initPosts) |
| `_onPageChange` | `profile.ts` | `utils.ts` (showPage) |
| `_handleDeletedPostView` / `_restorePostViewOnLoad` | `post-view.ts` | `posts-render.ts` |
| `_startTimeUpdateInterval` / `_stopTimeUpdateInterval` | `posts-actions.ts` | `posts-render.ts` |

---

## Main Process Detayları

### main.ts (124 satır)
- **CSP:** Sıkı Content-Security-Policy (Firebase domain'leri, `style-src 'self'`, `img-src 'self' data: firebasestorage`)
- **CORS:** Firebase Storage için Access-Control-Allow-Origin dinamik olarak eklenir
- **Pencere:** `titleBarStyle: "hidden"`, `titleBarOverlay` (36px), `sandbox: true`, `contextIsolation: true`
- **Geliştirme:** F5 ile reload (globalShortcut), development modda updater atlanır
- **Güncelleme:** `did-finish-load`'da versiyon gönderilir, `checkForUpdates()` çağrılır

### preload.ts (46 satır)
- **contextBridge:** `window.electronAPI` üzerinden 6 fonksiyon açılır:
  - `onAppVersion(cb)`, `onUpdateAvailable(cb)`, `onUpdateProgress(cb)`, `onUpdateDownloaded(cb)`, `onUpdateError(cb)`, `launchUpdater()`
- Tüm listener'lar `once` veya `removeAllListeners` ile tekil kullanılır

### updater.ts (82 satır)
- `autoUpdater.autoDownload = false` (manuel indirme)
- `allowPrerelease = false`, `channel = "latest"`
- 5 event: `update-available`, `download-progress`, `update-downloaded`, `error`, `launch_updater` IPC
- `checkForUpdates()` yalnızca production'da (`app.isPackaged`) çalışır

---

## Renderer Detayları

### Sayfa Sistemi (SPA)
| Sayfa | CSS Sınıfı | İçerik |
|---|---|---|
| `homePage` | `page-650` | Post oluşturma + post akışı |
| `profilePage` | `page-650` | Profil kartı + sekmeler (gönderilerim/beğenilenler) |
| `postViewPage` | `page-650` | Post detay + yorumlar (sticky composer) |
| `inventoryPage` | `page-1250` | İstatistik kartları + toolbar + veri tablosu |

Sayfa geçişleri `utils.ts` `showPage()` ile yapılır (opacity animasyonu, 320ms). `sessionStorage` ile son sayfa hatırlanır.

### Tablo Sistemi (Envanter)
- 6 sütun: Tarih, Bileşen, Özellikler, Fiyat, Satıcı, Durum
- Virtual scroll: ilk 40 satır anında, kalanı rAF ile kademeli
- Gruplama: tarihe göre gruplanır, satıcı alt gruplarıyla
- Sıralama: tüm sütunlar sıralanabilir, tek tıkla asc/desc toggle
- Filtreleme: durum butonları + canlı arama (debounce 180ms)
- Satır içi düzenleme: çift tıkla modal açar, Shift+ok tuşlarıyla gezinme
- Yeni kayıt: tablo altında inline satır (`+ Ürün Ekle`)
- CRUD: Firebase Realtime Database ile gerçek zamanlı senkronizasyon

### Post Sistemi
- Sayfalama: 20'şerli, limitToLast + endAt, "Daha Fazla Göster" butonu
- Gerçek zamanlı: `child_added`/`child_changed`/`child_removed` listener'lar
- Beğeniler: Firebase transaction ile optimistic UI (hatada geri al)
- Yorumlar: her post için ayrı listener (en fazla 10 eşzamanlı), `child_added`/`child_changed`/`child_removed`
- Zaman göstergeleri: 5 dakikada bir interval ile güncellenir, `document.hidden` kontrolü
- Profil sekmeleri: kullanıcının postları ve beğenileri ayrı listener'larla takip

### Bildirim Sistemi (io.ts)
- Toast: bildirim kutusu (3.2sn otomatik kapanma), 4 tip (success, error, warn, info)
- Confirm: onay diyalogu (15sn timeout), post/yorum/yanıt silme işlemleri
- Silme: animasyonlu (opacity + translateY, 0.3s)

### Klavye Kısayolları
| Kısayol | Aksiyon |
|---|---|
| `Ctrl+F` | Arama kutusuna odaklan |
| `Ctrl+Enter` | Post yayınla / modal kaydet |
| `Escape` | Modal kapat / yeni satır iptal |
| `Shift+← / → / ↑ / ↓` | Modal'da önceki/sonraki kayda git |
| `Enter` (comment input) | Yorum gönder |
| `Enter` (yeni satır input) | Yeni kayıt ekle |
| `F5` (dev mode) | Electron sayfasını yenile |

---

## CSS (12 dosya)

| Dosya | Görevi |
|---|---|
| `base.css` | Sayfa yapısı, CSS değişkenleri (`:root`), reset |
| `sidebar.css` | Logo, navigasyon, güncelleme butonu, kullanıcı bilgisi |
| `auth.css` | Giriş/kayıt panelleri |
| `home.css` | Post akışı sayfası |
| `posts.css` | Post kartları, oluşturma alanı |
| `post-view.css` | Post view sayfası, sticky composer |
| `post-comment.css` | Yorum ve yanıt stilleri |
| `profile.css` | Profil kartı, sekmeler |
| `table.css` | Veri tablosu yapısı, yeni ürün satırı |
| `toolbar.css` | İstatistik kartları, arama, filtre, CSV |
| `editmodal.css` | Düzenleme modalı, görsel önizleme |
| `userset.css` | Hesap ayarları, şifre değiştirme, hesap silme |

**Yeni CSS dosyası eklerken** `css/index.css`'e `@import` satırı eklenmelidir, aksi halde bundle'a dahil olmaz.

---

## Paket Yapılandırması

**Bağımlılıklar:**
- `electron` ^33.0.0, `electron-builder` ^26.8.1, `electron-updater` ^6.8.3
- `esbuild` ^0.28.0, `typescript` ^6.0.3, `@types/node` ^25.6.2

**electron-builder:**
- `appId: com.mysetup.app`, `publish: github (karmaqq/MySetup)`
- `win: nsis` — oneClick false, allowToChangeInstallationDirectory true
- `files:` dist/**/*, index.html, assets/**/*, js/firebase-config.js
- Prodüksiyon build: `npm run build`

---

## Kodlama Kuralları

### Yorum Stili (Kesin Kural)

Tüm yorumlar **blok halinde** ve **Türkçe** yazılır. Projede 3 seviye yorum hiyerarşisi vardır.

#### 1. Bölüm Başlığı (Section Header) — 3 satır

Her `.ts` dosyasının en tepesinde, dosyanın ne işe yaradığını belirten bölüm başlığı bulunur:

```
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

- Toplam: **3 satır**
- Kullanılan karakterler: `=`, `*`
- Üst ve alt çizgi: tam 90 karakter (`/* ` + 84 `=` + ` */` = 90)
- Orta satır: `/* ` + boşluk + metin + boşluk + `*/` — metin sağa yaslı olacak şekilde boşluklarla doldurulur
- Metin uzunluğu max ~60 karakter, fazlası alt satıra geçer
- **Her dosyada yalnızca 1 tane** — dosyanın ilk 3 satırı

#### 2. Ara Bölüm Başlığı (Sub Section) — 1 satır

Aynı dosya içinde farklı mantıksal bölümleri ayırmak için kullanılır:

```
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          ALT BÖLÜM ADI                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

- Toplam: **3 satır**
- 1. seviye ile aynı format
- Dosyada birden fazla olabilir (örneğin `auth.ts`: Oturum Yönetimi, Giriş Formu, Kayıt Formu)

#### 3. Alt Başlık (Subheader) — 1 satır

Bir bölüm içindeki spesifik bir grubu veya fonksiyon grubunu ayırmak için kullanılır:

```
/* ─────────────────── Başlık ─────────────────── */
```

- Toplam: **1 satır**
- Kullanılan karakter: `─`
- Başlangıç: `/* ` + 18 tane `─`
- Bitiş: 18 tane `─` + ` */`
- Metin ortalanır: 18 boşluk + metin + 18 boşluk şeklinde değil, `─` karakterleri metnin etrafında simetrik olacak şekilde

#### 4. Fonksiyon İçi Adım (Step Comment) — isteğe bağlı

Fonksiyon içinde kritik adımları belirtmek için kullanılır (sadece gerçekten gerekliyse):

```ts
function foo(): void {
  // 1. Adım bir
  // 2. Adım iki
}
```

- Toplam: adım başına **1 satır**
- Format: `// N. Metin`
- N sayısı 1'den başlar, artarak devam eder
- Maksimum 5 adım — daha fazlası fonksiyonun bölünmesi gerektiğini gösterir

### HTML Yorumları

`index.html` içinde de aynı hiyerarşi HTML yorum formatıyla kullanılır:

```html
<!-- ══════════════════════════════════════════════════════════════════ -->
<!--                          BÖLÜM ADI                               -->
<!-- ══════════════════════════════════════════════════════════════════ -->

<!-- ─────────────────── Alt Başlık ─────────────────── -->
```

- HTML yorumlarında `=` karakteri 66 adet kullanılır (CSS/TS'dekinden daha kısa)
- Aynı 3 seviye hiyerarşisi geçerlidir

### Yasak Yorum Tipleri

Aşağıdaki yorum türleri **kesinlikle yasaktır**:

```
const x = a + b; // satır sonu yorum     ← YASAK
// Satır içi açıklama                    ← YASAK
/* TODO: ileride */                      ← YASAK
// @ts-ignore                            ← YASAK (bunun yerine as any kullan)
console.log("debug");                    ← YASAK (production'da)
```

Yasak olma sebepleri:
1. **Satır sonu yorum** — kod okunurluğunu bozar, diff'leri kirletir
2. **Satır içi açıklama** — ne yapıldığı değil, ne yapılmaya çalışıldığı yazılmalı
3. **TODO/FIXME/HACK** — birikmeye yol açar, asla temizlenmez
4. **@ts-ignore** — tip güvenliğini devre dışı bırakır, alternatifi `as any`
5. **console.log** — production build'de temizlenmezse kalır

### Zorunlu Yorum Kuralları

Her `.ts` dosyası **mutlaka** şunları içermelidir:
- İlk 3 satır: 1. seviye bölüm başlığı
- Her `export function` öncesi: 3. seviye alt başlık (1 satır `/* ── */`)
- Birden fazla mantıksal grup varsa: 2. seviye ara bölüm başlığı (3 satır `/* == */`)

### Genel Kurallar

- `escAttr` ve `escHtml` ardışık uygulanmaz (çift escape)
- CSS değişkenleri yalnızca `base.css :root` içinde tanımlanır
- `'unsafe-eval'` CSP'ye eklenemez
- `autoUpdater.autoDownload` her zaman `false`
- `package.json → build.publish` içindeki `owner`/`repo` değiştirilmez
- Renderer'a ayrı `<script>` eklenmez, tek bundle kullanılır
- Main process'te `preload.ts` dışında `contextBridge` çağrılmaz
- `firebase-init.ts` dışında `initializeApp` çağrılamaz
- `enrichItem()` ham veriyi `allData`'ya yazmadan önce çağrılmalıdır
- `initUserDataRef()` başında `userDataRef.off()` vardır — kaldırılamaz
- Yeni CSS dosyası eklendiğinde `css/index.css`'e `@import` satırı eklenmelidir

---

## Yaygın Hatalar

1. **`window.showPage is not a function`** — `showPage`'i doğrudan import et, `(window as any)` ile çağırma
2. **Imported binding read-only** — `export let` değerini başka modülde reassign edemezsin, setter kullan
3. **Firebase modular SDK kullanmak** — compat SDK kullan (`firebase.auth()`, `firebase.database()`)
4. **`details.requestHeaders` hatası** — `(details as any).requestHeaders` ile geç
5. **`.d.ts` güncellemeyi unutmak** — Yeni window property'si eklediğinde `global.d.ts`'yi de güncelle

---

## Doğrulama

```bash
npm run build:ts          # esbuild derleme
npx tsc --noEmit          # Renderer tip kontrolü
npx tsc --noEmit -p tsconfig.main.json  # Main tip kontrolü
npm run start             # Çalıştır
```
