# AGENTS.md — MySetup v3.3.3

**Yazar:** Karma (`shbkarma@gmail.com`) · Electron 33 + TypeScript + Firebase Modular SDK v12.13.0

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
- Kullanılan karakter: `═` (U+2550)
- Üst ve alt çizgi: tam 90 karakter (`/* ` + 75 `═` + ` */` = 90)
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
- Kullanılan karakter: `─` (U+2500)
- Başlangıç: `/* ` + 19 tane `─`
- Bitiş: 19 tane `─` + ` */`
- Metin ortalanır: 19 boşluk + metin + 19 boşluk şeklinde değil, `─` karakterleri metnin etrafında simetrik olacak şekilde

### HTML Yorumları

`index.html` içinde de aynı hiyerarşi HTML yorum formatıyla kullanılır:

```html
<!-- ══════════════════════════════════════════════════════════════════ -->
<!--                          BÖLÜM ADI                               -->
<!-- ══════════════════════════════════════════════════════════════════ -->

<!-- ─────────────────── Alt Başlık ─────────────────── -->
```

- HTML yorumlarında `═` karakteri 75 adet kullanılır (CSS/TS ile aynı)
- Aynı 3 seviye hiyerarşisi geçerlidir

### Yasak Yorum Tipleri

Aşağıdaki yorum türleri **kesinlikle yasaktır**:

```
const x = a + b; // satır sonu yorum     ← YASAK
// Satır içi açıklama                    ← YASAK
/* TODO: ileride */                      ← YASAK
// @ts-ignore                            ← YASAK (bunun yerine as any kullan)
```

Yasak olma sebepleri:

1. **Satır sonu yorum** — kod okunurluğunu bozar, diff'leri kirletir
2. **Satır içi açıklama** — ne yapıldığı değil, ne yapılmaya çalışıldığı yazılmalı
3. **TODO/FIXME/HACK** — birikmeye yol açar, asla temizlenmez
4. **@ts-ignore** — tip güvenliğini devre dışı bırakır, alternatifi `as any`

### Zorunlu Yorum Kuralları

Her `.ts` dosyası **mutlaka** şunları içermelidir:

- İlk 3 satır: 1. seviye bölüm başlığı
- Her `export function` öncesi: 3. seviye alt başlık (1 satır `/* ── */`)
- Birden fazla mantıksal grup varsa: 2. seviye ara bölüm başlığı (3 satır `/* == */`)

---

### Veritabanı Yapısı

```
KÖK (firebase.database().ref())
├── /posts/{postId}                              # MAP: tüm gönderiler
│   ├── uid: string                              # Gönderi sahibi (Auth UID)
│   ├── username: string                         # Görünen ad
│   ├── content: string                          # Yazı içeriği
│   ├── imageUrl: string                         # Storage download URL (opsiyonel)
│   ├── createdAt: TIMESTAMP                     # Sunucu zamanı
│   ├── phraseIndex: number                      # Rastgele ifade indeksi (0-11)
│   ├── likes/{userId}: true                     # MAP: beğenen kullanıcı UID'leri
│   └── comments/{commentId}                     # MAP: yorumlar
│       ├── uid: string                          # Yorum sahibi UID
│       ├── username: string                     # Yorum sahibi görünen adı
│       ├── text: string                         # Yorum metni
│       ├── createdAt: TIMESTAMP                 # Oluşturulma zamanı
│       ├── likes/{userId}: true                 # MAP: yorum beğenileri
│       └── replies/{replyId}                    # MAP: yanıtlar (yorum altı)
│           ├── uid: string                      # Yanıt sahibi UID
│           ├── username: string                 # Yanıt sahibi görünen adı
│           ├── text: string                     # Yanıt metni
│           ├── createdAt: TIMESTAMP             # Oluşturulma zamanı
│           └── likes/{userId}: true             # MAP: yanıt beğenileri
│
├── /userPosts/{userId}/{postId}: TIMESTAMP      # INDEX: kullanıcının gönderi listesi
│                                                 (değer = TIMESTAMP, sıralama için)
│
├── /userLikes/{userId}/{postId}: TIMESTAMP      # INDEX: kullanıcının beğendikleri
│                                                 (sadece POST beğenileri, comment/reply DEĞİL)
│
├── /users/{userId}/
│   ├── theme: "dark" | "light"                  # Kullanıcının seçtiği tema (varsayılan dark)
│   └── components/{itemId}                      # MAP: envanter öğeleri
│       ├── date: string                         # Tarih
│       ├── component: string                    # Bileşen adı
│       ├── brand: string                        # Marka
│       ├── specs: string                        # Özellikler
│       ├── price: number|string                 # Fiyat
│       ├── vendor: string                       # Satıcı
│       ├── status: string                       # Durum
│       ├── url: string                          # Ürün URL'si
│       ├── imageUrl: string                     # Storage download URL
│       ├── star: number                         # Puan
│       └── opinion: string                      # Görüş
│       # Runtime'da enrichItem() ile eklenir (DB'de saklanmaz):
│       # - _searchTag: normalizeTr(...) ile normalize edilmiş arama metni
│       # - _statusNorm: normalizeTr(status)
│
└── /usernames/{usernameKey}: uid                # INDEX: kullanıcı adı → UID eşlemesi
                                                  # usernameKey = username.toLowerCase()
```

### Önemli Notlar

- **Comment like'ları kullanıcı index'inde tutulmaz**: Sadece `/posts/{id}/comments/{cid}/likes/{uid}` altında. `/userCommentLikes` diye bir path yoktur.
- **Reply like'ları da index'sizdir**: Aynı şekilde sadece reply altındadır.
- **`/userLikes/` sadece POST beğenilerini** index'ler. Comment/reply beğenilerinin kullanıcı-bazlı bir index'i yoktur.
- **`deleteUserAccount`** post loop'unda `userLikes/{otherUser}/{postId}` (başka kullanıcıların beğenilerini) temizler. Kendi `userLikes/{uid}`'si daha önce silinir.
- **Storage yolu**: `users/{uid}/components/{itemId}/image` (component görselleri), `users/{uid}/posts/{timestamp}` (post görselleri). Storage'daki URL `imageUrl` alanında saklanır.

### Firebase Security Rules (`rules.json`)

Firebase Realtime Database kuralları `rules.json` dosyasında tanımlıdır. Firebase Console → Realtime Database → Rules bölümüne kopyalanır.

**Önemli kural mantığı:**

| Path                          | Kural                                                                          | Sebep                                                            |
| ----------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `/users/{uid}`                | Sadece kullanıcının kendisi                                                    | Kullanıcı verisi gizli                                           |
| `/posts/{pid}`                | Yalnızca post sahibi silebilir / düzenleyebilir                                | Yetkisiz silme engeli                                            |
| `/posts/{pid}/comments/{cid}` | Yalnızca yorum sahibi silebilir                                                | Yetkisiz yorum silme engeli                                      |
| `/posts/{pid}/likes/{uid}`    | Yalnızca `$userId` == `auth.uid`, VE post henüz silinmemiş olmalı              | Race condition: post yoksa beğeni eklenemez                      |
| `/userLikes/{uid}/{pid}`      | Sahibi yazabilir VEYA `newData.val() == null`                                  | Başkasının `userLikes`'ına null yazılabilir (post silme cleanup) |
| `/usernames/{key}`            | `newData.val() == auth.uid` (yeni kayıt) VEYA `data.val() == auth.uid` (silme) | Username hijacking engeli                                        |

**Not:** `userLikes`'daki `newData.val() == null` kuralı, `deletePostFromFirebase`'in atomic multi-path `update()`'inin çalışması için zorunludur (Kullanıcı A, Kullanıcı B'nin `userLikes/{B}/{postId}`'ini null'layabilir).

## Proje Yapısı (27 → 36 dosya, Modular Restructure v3.3.1)

```
mysetup/
├── build.mjs                          # esbuild yapı sistemi
├── build.web.mjs                      # esbuild (Netlify)
├── update.mjs                         # otomasyonlu commit - build
├── package.json                       # v3.0.9, electron 33, electron-updater
├── tsconfig.json                      # Renderer tip kontrolü (DOM lib)
├── tsconfig.main.json                 # Main process tip kontrolü (Node lib)
├── index.html                         # Ana sayfa
├── js/
│   └── firebase-config.js             # Firebase API anahtarları
├── css/                               # 12 CSS kaynak dosyası + index.css (bundle girişi)
├── assets/                            # icon.ico
│   └── fonts/                         # yerel font dosyaları 4 woff2
├── scripts/
│   └── clean-locales.js               # electron-builder afterPack (tr/en pak hariç temizleme)
└── src/
    ├── main/
    │   ├── main.ts               (2)  # Pencere, CSP, yaşam döngüsü (124 satır)
    │   └── preload.ts            (1)  # IPC contextBridge (46 satır)
    ├── updater/
    │   └── updater.ts            (2)  # electron-updater kurulumu (82 satır)
    └── renderer/
        ├── index.ts                   # Entry point, tüm modülleri import eder
        ├── core/
        │   ├── firebase-init.ts       # Firebase başlatma
        │   ├── global-ut.ts           # Saf araç fonksiyonları
        │   ├── global-fn.ts           # Paylaşılan uygulama fonksiyonları
        │   └── app-state.ts           # Uygulama durumu + DOM referansları
        ├── data/
        │   ├── firebase-core.ts       # enrichItem, initUserDataRef
        │   ├── firebase-inventory.ts  # Envanter CRUD
        │   ├── firebase-user.ts       # Hesap silme
        │   ├── firebase-post.ts       # Post CRUD + sorgular
        │   └── firebase-comment.ts    # Yorum/yanıt CRUD
        ├── inventory/
        │   ├── io.ts                  # Silme onay diyalogları
        │   ├── toolbar.ts             # İstatistik + arama + filtre
        │   ├── csv.ts                 # CSV içeri/dışarı aktarma
        │   ├── table.ts               # Tablo render + sıralama
        │   ├── table-crud.ts          # Tablo CRUD + event delegation
        │   ├── edit-modal.ts          # Düzenleme modalı
        │   └── image-utils.ts         # Görsel yükleme + önizleme
        ├── user/
        │   ├── auth-nav.ts            # Navigasyon + session yönetimi
        │   ├── auth.ts                # Giriş/kayıt formları
        │   ├── pass-change.ts         # Şifre değiştirme
        │   ├── delete-account-ui.ts   # Hesap silme UI
        │   ├── settings.ts            # Hesap ayarları
        │   └── updater-ui.ts          # Güncelleme butonu
        ├── social/
        │   ├── post-comment.ts        # Yorum/yanıt HTML render
        │   ├── post-create.ts         # Post oluşturma
        │   ├── post-render.ts         # Post kart HTML render
        │   ├── post-listener.ts       # Post listener + sayfalama
        │   ├── post-timer.ts          # Zaman güncellemesi
        │   ├── post-actions.ts        # Beğeni + event delegation
        │   ├── profile-tabs.ts        # Profil sekme yükleme
        │   ├── profile.ts             # Profil sekme yönetimi
        │   ├── post-view-comment.ts   # Post view yorum gönderimi
        │   └── post-view.ts           # Post view aç/kapa
        └── types/
            ├── global.d.ts            # Window interface genişletmesi
            └── inventory.d.ts         # Envanter tipleri
```

## **Toplam: ~205 fonksiyon** - **her eklemede güncelle**

## Import Sırası (index.ts)

**Kesin sıra — asla değiştirilmez:**

```
core/firebase-init → core/global-ut → core/global-fn → core/app-state →
data/firebase-core → data/firebase-inventory → data/firebase-user →
data/firebase-post → data/firebase-comment →
inventory/io → inventory/toolbar → inventory/csv → inventory/table →
inventory/table-crud → inventory/edit-modal → inventory/image-utils →
user/auth-nav → user/auth → user/pass-change → user/delete-account-ui →
user/settings → user/updater-ui →
social/post-comment → social/post-create →
social/post-render → social/post-listener → social/post-timer →
social/post-actions → social/profile-tabs → social/profile →
social/post-view-comment → social/post-view
```

### Kategori Bazında Gruplama

| Sıra  | Grup             | Dosyalar                                                                                                                                                                                           | Toplam |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| 1-4   | **Çekirdek**     | core/firebase-init → core/global-ut → core/global-fn → core/app-state                                                                                                                              |   4    |
| 5-9   | **Veri**         | data/firebase-core → data/firebase-inventory → data/firebase-user → data/firebase-post → data/firebase-comment                                                                                      |   5    |
| 10-16 | **Envanter**     | inventory/io → inventory/toolbar → inventory/csv → inventory/table → inventory/table-crud → inventory/edit-modal → inventory/image-utils                                                            |   7    |
| 17-22 | **Kullanıcı**    | user/auth-nav → user/auth → user/pass-change → user/delete-account-ui → user/settings → user/updater-ui                                                                                            |   6    |
| 23-32 | **Post Sistemi** | social/post-comment → social/post-create → social/post-render → social/post-listener → social/post-timer → social/post-actions → social/profile-tabs → social/profile → social/post-view-comment → social/post-view |   10   |

## Zorunlu Kısıtlar

**Firebase:**

- `initializeApp` yalnızca `core/firebase-init.ts`'de çağrılır.
- Modular SDK (v12.13.0) kullanılır: `import { getAuth } from "firebase/auth"`, `import { ref, child } from "firebase/database"`, `import { ref as storageRef } from "firebase/storage"`
- `firebase.auth()`, `firebase.database()`, `firebase.storage()` gibi compat API'ler **yasaktır**.
- `query()` ile `QueryConstraint`'ler birleştirilir: `query(ref, orderByChild("createdAt"), limitToLast(20))`
- `child()` zincirleri modular `child(child(ref, "a"), "b")` formatındadır.
- `remove`, `set`, `update` fonksiyonları doğrudan import edilir (ref üzerinden çağrılmaz).
- `serverTimestamp()` modülerdir: `ServerValue.TIMESTAMP` yerine kullanılır.
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
- `_viewingPostId` → `Object.defineProperty` ile tanımlı (`core/app-state.ts`)

---

## Doğrulama

```bash
npm run build:ts                          # esbuild derleme
npx tsc --noEmit                          # renderer tip kontrolü
npx tsc --noEmit -p tsconfig.main.json    # main tip kontrolü
```

### Firebase Delete Race Condition (v3.3.2 — K1 Fix, v3.3.3 — F-01 Fix)

**Kritik:** `deletePostFromFirebase`'de (`data/firebase-post.ts`) likes snapshot okuma ile post silme arasında yeni beğeni eklenirse `userLikes/{userId}/{postId}` orphan kalır.

**1. Anlık Silme (deletePostFromFirebase):** Multi-path `update()` ile atomik cleanup:

```typescript
updates["posts/" + postId] = null;
updates["userPosts/" + uid + "/" + postId] = null;
Object.keys(likes).forEach(function (userId) {
  updates["userLikes/" + userId + "/" + postId] = null;
});
return update(ref(db.database), updates);
```

**2. Hesap Silme (deleteUserAccount - OPTİMİZE):** Artık `userLikes` tam ağaç taraması **KALDIRILMIŞTIR**. Per-post atomic cleanup zaten tüm liker'ları temizler. Race condition orphan'ları uygulama katmanında görünmez (`getPostsByIds` null post'ları filtreler). Akış:

```typescript
// 1. Kendi userLikes/{uid} düğümünü temizle
// 2. Tüm postları batch'ler halinde atomik sil (liker'ları da temizler)
// 3. userPosts, users, usernames node'larını temizle
// 4. Storage klasörünü sil
// 5. user.delete() ile Auth kaydını sil
```

### Storage Cleanup Zorunluluğu

- Component silindiğinde (`deleteComponentFromFirebase`) Storage'daki görsel de silinmeli
- CSV Import / "Tümünü Sil" öncesi eski görseller temizlenmeli

### Firebase Storage Rules (`storage.rules`)

Storage kuralları `storage.rules` dosyasında tanımlıdır. Firebase Console → Storage → Rules bölümüne kopyalanır.

**Kural özeti:**

```
/users/{uid}/{allPaths=**} → allow read, write: if request.auth.uid == uid
```

Tüm dosyalar `/users/{uid}/` altında olduğu için tek bir kural yeterlidir. Download URL (token içeren) herkese açık olduğu için post görselleri herkes tarafından görüntülenebilir; SDK üzerinden silme/yazma işlemleri yalnızca kullanıcının kendisi tarafından yapılabilir.
