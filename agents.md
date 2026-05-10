# AGENTS.md — MySetup v3.2.0

**Yazar:** Karma (`shbkarma@gmail.com`) · Electron 33 + TypeScript + Firebase Compat SDK v9.22.1

---

## Yorum Kuralları (Kesin Kural)

Tüm yorumlar **Türkçe** ve **blok halinde** yazılır. 3 seviye hiyerarşi:

**1. Dosya Başlığı** — her `.ts` dosyasının ilk 3 satırı, dosyada yalnızca 1 adet:

```ts
/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BÖLÜM ADI                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
```

Üst/alt çizgi: `/* ` + 84 `═` + ` */` = 90 karakter

**2. Ara Bölüm** — aynı dosyada mantıksal gruplar arası, aynı format, birden fazla olabilir.

**3. Alt Başlık** — fonksiyon grubu önü, 1 satır:

```ts
/* ─────────────────── Başlık ─────────────────── */
```

**Yasak yorum türleri:**

```ts
const x = a + b; // satır sonu yorum     ← YASAK
// açıklama satırı                        ← YASAK
/* TODO / FIXME */                        ← YASAK
// @ts-ignore                             ← YASAK (yerine: as any)
console.log(...)                          ← YASAK (production'da)
```

**HTML yorumları** (`index.html`) aynı hiyerarşiyi izler, `═` sayısı 66'dır:

```html
<!-- ══════════════════════════════════════════════════════════════════ -->
<!--                          BÖLÜM ADI                               -->
<!-- ══════════════════════════════════════════════════════════════════ -->
```

---

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

## Proje Yapısı

```
mysetup/
├── build.mjs                      # esbuild yapı sistemi
├── build.web.mjs                  # esbuild (Netlify)
├── update.mjs                     # otomasyonlu commit - build
├── package.json                   # v3.0.9, electron 33, electron-updater
├── tsconfig.json                  # Renderer tip kontrolü (DOM lib)
├── tsconfig.main.json             # Main process tip kontrolü (Node lib)
├── index.html                     # Ana sayfa
├── js/
│   └── firebase-config.js         # Firebase API anahtarları
├── css/                           # 12 CSS kaynak dosyası + index.css (bundle girişi)
├── assets/                        # icon.ico
│   └── fonts/                     # yerel font dosyaları 4 woff2
├── scripts/
│   └── clean-locales.js           # electron-builder afterPack (tr/en pak hariç temizleme)
└── src/
    ├── main/
    │   ├── main.ts           (2)  # Pencere, CSP, yaşam döngüsü (124 satır)
    │   └── preload.ts        (7)  # IPC contextBridge (46 satır)
    ├── updater/
    │   └── updater.ts        (2)  # electron-updater kurulumu (82 satır)
    └── renderer/
        ├── index.ts          (0)  # Entry point, tüm modülleri import eder
        ├── utils.ts          (26) # Global değişkenler, yardımcılar (495 satır)
        ├── firebase-init.ts  (1)  # Firebase başlatma, db referansları (43 satır)
        ├── firebase-core.ts  (2)  # enrichItem, initUserDataRef (134 satır)
        ├── firebase-inv.ts   (7)  # Envanter CRUD + Storage (61 satır)
        ├── firebase-post.ts  (17) # Post/yorum/yanıt CRUD (257 satır)
        ├── firebase-user.ts  (1)  # Hesap silme (79 satır)
        ├── auth.ts           (1)  # Giriş/kayıt, oturum yönetimi (331 satır)
        ├── io.ts             (7)  # Toast/confirm bildirimleri (156 satır)
        ├── editmodal.ts      (8)  # Düzenleme modalı, görsel yükleme (343 satır)
        ├── table.ts          (19) # Tablo render, sıralama, CRUD (676 satır)
        ├── toolbar.ts        (6)  # İstatistik, arama, filtre, CSV (417 satır)
        ├── profile.ts        (19) # Profil sekmeleri (438 satır)
        ├── posts-create.ts   (6)  # Post oluşturma, görsel seçimi (187 satır)
        ├── posts-render.ts   (20) # Post akışı render, sayfalama (464 satır)
        ├── posts-actions.ts  (12) # Beğeni, yorum gönderme, event delegation (618 satır)
        ├── post-view.ts      (11) # Post view aç/kapa, yorumlar (541 satır)
        ├── post-comment.ts   (6)  # Yorum/yanıt HTML render (192 satır)
        ├── updater-ui.ts     (2)  # Güncelleme butonu animasyonu (118 satır)
        ├── userset.ts        (8)  # Hesap ayarları, şifre değiştirme (384 satır)
        └── types/
            ├── firebase.d.ts      # Firebase compat SDK tipleri
            └── global.d.ts        # Window interface genişletmesi
```

## **Toplam: 195 fonksiyon** - **her eklemede güncelle**

Import sırası `index.ts`'de sabittir — **asla değiştirilmez:**

```
firebase-init → utils → firebase-core → firebase-inv → firebase-user →
firebase-post → io → toolbar → table → editmodal → auth → userset →
updater-ui → post-comment → posts-create → posts-render → posts-actions →
profile → post-view
```

## Zorunlu Kısıtlar

**Firebase:**

- `initializeApp` yalnızca `firebase-init.ts`'de çağrılır.
- Modular SDK (`import { initializeApp } from "firebase/app"`) **yasak**; compat API kullanılır: `firebase.auth()`, `firebase.database()`, `firebase.storage()`
- `enrichItem()` ham veri `allData`'ya yazılmadan önce **mutlaka** çağrılır.
- `initUserDataRef()` başındaki `userDataRef.off()` **kaldırılamaz**.
  **Build:**

- Renderer tek IIFE bundle'dır; ayrı `<script>` etiketi **eklenmez**.
- `main.ts`/`preload.ts` dışında `contextBridge` çağrılmaz.
- CSS: yeni dosya eklendiğinde `css/index.css`'e `@import` eklenmesi **zorunlu**.
- `'unsafe-eval'` CSP'ye **eklenemez**.
- `autoUpdater.autoDownload` her zaman `false`.
- `package.json → build.publish` içindeki `owner`/`repo` değiştirilmez.
  **Cross-module state:**

- esbuild IIFE'de `export let` başka modülde read-only'dir. Mutasyon için setter veya `(window as any)` kullanılır.
- `allPosts` → `(window as any).allPosts`
- `renderAll` → `(window as any).renderAll`
- `_viewingPostId` → `Object.defineProperty` ile tanımlı (`utils.ts`)

---

## Doğrulama

```bash
npm run build:ts                          # esbuild derleme
npx tsc --noEmit                          # renderer tip kontrolü
npx tsc --noEmit -p tsconfig.main.json    # main tip kontrolü
```

## Yaygın Hatalar

| Hata                                | Çözüm                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| `window.showPage is not a function` | `showPage`'i direkt import et, `(window as any)` ile çağırma |
| `Imported binding is read-only`     | `export let` değerini başka modülde atama; setter kullan     |
| `details.requestHeaders` TS hatası  | `(details as any).requestHeaders`                            |
| `@ts-ignore` kullanımı              | `as any` ile geç                                             |
| Yeni `window` property'si           | `global.d.ts`'yi güncelle                                    |
| `escAttr` + `escHtml` ardışık       | **Çift escape** oluşur; birini kullan                        |
