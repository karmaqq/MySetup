# AGENTS.md — MySetup v2.7.6

MySetup, **Electron 33** masaüstü envanter uygulaması. Tamamen TypeScript, esbuild ile derleniyor.

---

## 🚀 Hızlı Başlangıç

```bash
npm run build:ts    # Derle (esbuild, ~0.05s)
npm run start       # Çalıştır
npm run dev         # Derle + Çalıştır
npm run build       # Derle + electron-builder (installer)
```

Projeye ilk müdahalede: `npm run dev` ile başlat, hata varsa düzelt, tekrar dene.

---

## 🏗 Mimari

**İki bağımsız Electron süreci, dört ayrı derleme çıktısı:**

| Süreç | Kaynak | Derlenen | Format |
|---|---|---|---|
| Main | `src/main/main.ts`, `src/main/preload.ts`, `src/updater/updater.ts` | `dist/main.js`, `dist/preload.js`, `dist/updater.js` | CJS (transpile, bundle değil) |
| Renderer | `src/renderer/index.ts` (+18 modül) | `dist/renderer.js` | IIFE (tek bundle) |

**Build sistemi:** `node build.mjs` — esbuild ile 4 çıktıyı da 0.05s'de üretir.

**Önemli:** Renderer TEK bir IIFE bundle'dır (`dist/renderer.js`). `index.html` yalnızca şu script'leri yükler:
1. 4 Firebase CDN script (compat SDK v9.22.1)
2. `js/firebase-config.js` (API anahtarları — `.gitignore`'da)
3. `dist/renderer.js`

`tsconfig.json` → renderer tip kontrolü, `tsconfig.main.json` → main process tip kontrolü.

---

## 📁 Dosya Haritası

### Renderer (src/renderer/)

Her dosyanın **tek bir sorumluluğu** vardır:

| Dosya | Görevi |
|---|---|
| `index.ts` | **Entry point.** Tüm modülleri import eder. İmport sırası asla değiştirilmez. |
| `firebase-init.ts` | Firebase başlatma, paylaşılan `db` nesnesi. Hiçbir renderer modülüne bağımlı değildir. |
| `utils.ts` | **Tüm global değişkenler**, DOM ref'leri, yardımcı fonksiyonlar. Diğer her dosya buna bağımlıdır. |
| `firebase-core.ts` | `enrichItem()`, `initUserDataRef()` |
| `firebase-inv.ts` | Envanter CRUD (`addComponentToFirebase`, `updateComponentInFirebase`, `uploadImageToFirebase`, `deleteAllInFolder`) |
| `firebase-user.ts` | `deleteUserAccount()` |
| `firebase-post.ts` | Post/Yorum/Yanıt CRUD, beğeni, listener'lar |
| `table.ts` | Tablo render motoru, filtre/sıralama, istatistik önbelleği, CRUD UI, event delegation |
| `io.ts` | Toast/confirm bildirimleri, arama, CSV içe/dışa aktarım, silme onayları |
| `auth.ts` | Firebase Auth, giriş/kayıt, oturum yönetimi |
| `userset.ts` | Kullanıcı ayarları, kullanıcı adı/şifre değiştirme, hesap silme UI |
| `editmodal.ts` | Düzenleme modali, görsel önizleme/yükleme, yıldız, klavye kısayolları |
| `updater-ui.ts` | Güncelleme butonu animasyonu |
| `post-comment.ts` | Yorum/yanıt HTML render, composer HTML, beğeni butonu DOM güncelleme |
| `posts-render.ts` | Post kartı HTML render, feed DOM, sayfalama, `initPosts()`, `_teardownPosts()` |
| `posts-create.ts` | Post oluşturma, görsel seçimi |
| `posts-actions.ts` | Beğeni, yorum/yanıt gönderme, gerçek zamanlı yorum listener, event delegation, composer, zaman güncellemesi |
| `post-view.ts` | Post view aç/kapa, render, yorum listener, scroll, F5 koruması |
| `profile.ts` | Profil sekmeleri, chunk yükleme |

### Main Process (src/main/)

| Dosya | Görevi |
|---|---|
| `main.ts` | Electron pencere, CSP, yaşam döngüsü |
| `preload.ts` | IPC köprüsü — sadece burada `contextBridge.exposeInMainWorld` |

### Updater (src/updater/)

| Dosya | Görevi |
|---|---|
| `updater.ts` | `electron-updater` kurulumu, `autoDownload: false` (kasıtlı) |

### CSS (css/)

| Dosya | Görevi |
|---|---|
| `base.css` | CSS değişkenleri (`:root`, `clr-` prefix), reset, layout, responsive |
| `sidebar.css` | Logo, menü, kullanıcı bilgisi |
| `home.css` | Karşılama ekranı |
| `profile.css` | Profil sayfası |
| `inventory.css` | Tablo, istatistik, arama, filtre, butonlar |
| `editmodal.css` | Düzenleme modali, görsel önizleme |
| `auth.css` | Giriş/kayıt overlay |
| `userset.css` | Ayarlar modalı |
| `posts.css` | Post kartları, create formu |
| `post-view.css` | Post view sayfası |
| `post-comment.css` | Yorum/yanıt stilleri |

### Types (src/renderer/types/)

| Dosya | Görevi |
|---|---|
| `firebase.d.ts` | Firebase compat SDK tip stubları (`declare namespace firebase`) |
| `global.d.ts` | `Window` interface genişletmesi (`electronAPI`, `__FB_CONFIG__`, `_viewingPostId`) |

---

## 🔗 İmport Zinciri (Renderer)

```
firebase-init.ts  →  db nesnesini dışa aktarır, hiçbir renderer modülüne bağımlı değil
utils.ts          →  Global değişkenler + yardımcılar, hiçbir renderer modülüne bağımlı değil
firebase-core.ts  →  firebase-init.ts + utils.ts'e bağımlı
```

Bu sıra `index.ts`'deki import sırasıyla korunur. **Asla bozulmaz.**

---

## 🌐 Cross-Module State (ÖNEMLİ)

esbuild IIFE bundle modüler yapıyı korur. Bir modülde `export let x` olarak tanımlanan değişken, başka bir modülde `import { x }` ile alındığında **read-only binding** olur. Bu nedenle:

### Utils'te tanımlı global değişkenler (sadece utils.ts'de):

| Değişken | Tip | Setter |
|---|---|---|
| `allData` | `Record<string, any>` | Doğrudan mutation (`delete`, `[id] =`) |
| `currentSearch` | `string` | `setCurrentSearch(v)` |
| `currentStatusFilter` | `string` | `setCurrentStatusFilter(v)` |
| `currentSort` | `{ col, dir }` | Doğrudan mutation |
| `editingId` | `string \| null` | `setEditingId(v)` |
| `_currentPage` | `string` | Doğrudan mutation |
| `_statsCache` | `StatsCache` | Doğrudan mutation |
| `_commentListenerRefs` | `Record<string, any>` | Doğrudan mutation |

### Window üzerinden erişilen değişkenler/fonksiyonlar:

Bazı değerler modül sınırlarını aşmak için `(window as any)` üzerinden paylaşılır:

| İsim | Tip | Tanımlandığı Yer | Kullanıldığı Yer |
|---|---|---|---|
| `allPosts` | `Record<string, any>` | `posts-render.ts` | `posts-actions.ts`, `io.ts`, `firebase-user.ts` |
| `_viewingPostId` | `string \| null` | `utils.ts` (Object.defineProperty) | `post-view.ts`, `posts-render.ts` |
| `_profileTab` | `string \| null` | `profile.ts` | `utils.ts`, `post-view.ts` |
| `_postsListenerActive` | `boolean` | `posts-render.ts` | `posts-actions.ts` |
| `openPostView` | `function` | `post-view.ts` | `posts-actions.ts` |
| `closePostView` | `function` | `post-view.ts` | Event handler'lar |
| `renderAll` | `function` | `table.ts` | `utils.ts` (scheduleRender) |
| `updateProfilePosts` | `function` | `profile.ts` | `utils.ts` (showPage) |
| `clearPostDraft` | `function` | `posts-create.ts` | `utils.ts` (showPage) |
| `_onUserLikesChanged` | `function` | `profile.ts` | `posts-render.ts` (initPosts) |
| `_onUserPostsChanged` | `function` | `profile.ts` | `posts-render.ts` (initPosts) |
| `_onPageChange` | `function` | `profile.ts` | `utils.ts` (showPage) |
| `_handleDeletedPostView` | `function` | `post-view.ts` | `posts-render.ts` |
| `_restorePostViewOnLoad` | `function` | `post-view.ts` | `posts-render.ts` (initPosts) |
| `_startTimeUpdateInterval` | `function` | `posts-actions.ts` | `posts-render.ts` (initPosts) |
| `_stopTimeUpdateInterval` | `function` | `posts-actions.ts` | `posts-render.ts` (_teardownPosts) |

**Kural:** Yeni bir cross-module değişken eklerken ya utils.ts'e setter ekle ya da window'a ata.

---

## 🔥 Firebase

**Compat SDK v9.22.1** — CDN üzerinden, global `firebase` nesnesi ile kullanılır.

```typescript
// DOĞRU
const user = firebase.auth().currentUser;
const ref = firebase.database().ref("posts");
const storageRef = firebase.storage().ref();

// YANLIŞ (YASAK)
import { initializeApp } from "firebase/app";
```

**Tip stubları:** `src/renderer/types/firebase.d.ts` — `declare namespace firebase` içinde tüm kullanılan API'ler tanımlıdır.

**Önemli kurallar:**
- `firebase-init.ts` dışında `initializeApp` çağrılamaz
- `enrichItem()` ham veriyi `allData`'ya yazmadan önce çağrılmalıdır (`_searchTag`, `_statusNorm` ekler)
- `initUserDataRef()` başında `userDataRef.off()` vardır — kaldırılamaz, listener birikmesine yol açar

---

## ✍️ Kodlama Kuralları

### Yorum Stili (Kesin Kural)

**Bölüm başlığı:**
```
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

**Alt grup:**
```
/* ─────────────────── Başlık ─────────────────── */
```

**Fonksiyon içi adım (gerekirse):**
```ts
function foo(): void {
  // 1. Adım bir
  // 2. Adım iki
}
```

**Yasak:**
```ts
// Satır içi açıklama                    ← YASAK
const x = a + b; // satır sonu yorum     ← YASAK
/* TODO: ileride */                      ← YASAK
```

### Genel Kurallar

- `escAttr` ve `escHtml` ardışık uygulanmaz (çift escape)
- CSS değişkenleri yalnızca `base.css :root` içinde tanımlanır
- `'unsafe-eval'` CSP'ye eklenemez
- `autoUpdater.autoDownload` her zaman `false`'tur
- `package.json → build.publish` içindeki `owner`/`repo` değiştirilmez
- Renderer'a ayrı `<script>` eklenmez, tek bundle `dist/renderer.js` kullanılır
- Main process'te `preload.ts` dışında `contextBridge` çağrılmaz

---

## 🚫 Yaygın Hatalar

1. **`window.showPage is not a function`** → `showPage`'i doğrudan import et, `(window as any)` ile çağırma
2. **Imported binding read-only hatası** → `export let` değerini başka modülde reassign edemezsin, setter kullan
3. **Firebase modular SDK kullanmak** → compat SDK (`firebase.auth()`, `firebase.database()`) kullan
4. **`details.requestHeaders` hatası** → `(details as any).requestHeaders` ile geç
5. **`.d.ts` güncellemeyi unutmak** → Yeni window property'si eklediğinde `global.d.ts`'yi de güncelle

---

## ✅ Doğrulama

```bash
npm run build:ts          # esbuild derleme
npx tsc --noEmit          # Renderer tip kontrolü
npx tsc --noEmit -p tsconfig.main.json  # Main tip kontrolü
npm run start             # Çalıştır
```

Manuel test: auth → giriş → tablo CRUD → post sistemi → profil → CSV → hesap silme.
