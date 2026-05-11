/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          GÖRSEL YÜKLEME VE ÖNİZLEME                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allData, editingId } from "./app-state";
import { escAttr } from "./global-ut";
import { showToast, showConfirm } from "./global-fn";
import { updateComponentInFirebase } from "./firebase-inv";

/* ─────────────────── Storage'a Görsel Yükle ─────────────────── */

export function uploadImageToFirebase(file: File, itemId: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    const user = firebase.auth().currentUser;
    if (!user) return reject("Kullanıcı yok");
    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child(
      "users/" + user.uid + "/components/" + itemId + "/image",
    );
    const uploadTask = imageRef.put(file);
    uploadTask.on(
      "state_changed",
      undefined,
      function (error: any) {
        reject(error);
      },
      function () {
        uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
      },
    );
  });
}

/* ─────────────────── Adaptive Boyutlandırma ─────────────────── */

export function applyAdaptiveSize(
  imgEl: HTMLImageElement,
  imagePreview: HTMLElement,
): void {
  const MIN_W = 180, MIN_H = 140, MAX_W = 340, MAX_H = 260;
  const nw = imgEl.naturalWidth || 1;
  const nh = imgEl.naturalHeight || 1;
  const ratio = nw / nh;
  let w: number, h: number;

  if (ratio >= 1) {
    w = MAX_W;
    h = Math.round(w / ratio);
    if (h < MIN_H) { h = MIN_H; w = Math.round(h * ratio); }
    if (w > MAX_W) { w = MAX_W; h = Math.round(w / ratio); }
  } else {
    h = MAX_H;
    w = Math.round(h * ratio);
    if (w < MIN_W) { w = MIN_W; h = Math.round(w / ratio); }
    if (h > MAX_H) { h = MAX_H; w = Math.round(h * ratio); }
  }

  w = Math.max(MIN_W, Math.min(MAX_W, w));
  h = Math.max(MIN_H, Math.min(MAX_H, h));
  imagePreview.style.width = w + "px";
  imagePreview.style.height = h + "px";
}

/* ─────────────────── Önizleme Yenile ─────────────────── */

export function refreshPreview(
  url: string,
  imagePreview: HTMLElement,
  imageUploadBtn: HTMLElement | null,
): void {
  if (url) {
    imagePreview.innerHTML = `
      <img src="${escAttr(url)}" alt="Ürün görseli" id="editImagePreviewImg" />
      <button class="preview-delete-btn" id="previewDeleteBtn" title="Görseli sil">✕</button>`;
    imagePreview.classList.remove("hidden");
    if (imageUploadBtn) imageUploadBtn.classList.add("has-image");

    const imgEl = document.getElementById("editImagePreviewImg") as HTMLImageElement | null;
    if (imgEl) {
      imgEl.addEventListener("load", () => applyAdaptiveSize(imgEl, imagePreview), { once: true });
      if (imgEl.complete) applyAdaptiveSize(imgEl, imagePreview);
    }

    document.getElementById("previewDeleteBtn")!.onclick = () => {
      const idToDelete = editingId;
      if (!idToDelete) return;
      showConfirm("Görsel kalıcı olarak silinsin mi?", async () => {
        try {
          const user = firebase.auth().currentUser;
          if (user) {
            const ref = firebase.storage().ref(`users/${user.uid}/components/${idToDelete}/image`);
            await ref.delete().catch(() => {});
          }
          await updateComponentInFirebase(idToDelete, { imageUrl: "" });
          if (allData[idToDelete]) allData[idToDelete].imageUrl = "";
          if (editingId === idToDelete) refreshPreview("", imagePreview, imageUploadBtn);
          showToast("Görsel silindi", "success");
        } catch (_) {
          showToast("Görsel silinemedi", "error");
        }
      });
    };
  } else {
    imagePreview.innerHTML = "";
    imagePreview.classList.add("hidden");
    if (imageUploadBtn) imageUploadBtn.classList.remove("has-image");
  }
}

/* ─────────────────── Görsel Dosyasını İşle ─────────────────── */

export function handleImageFile(
  file: File,
  imagePreview: HTMLElement,
  id: string,
  imageUploadBtn: HTMLElement | null,
): void {
  if (!file || !file.type.startsWith("image/")) return;
  imagePreview.classList.remove("hidden");
  imagePreview.style.width = "200px";
  imagePreview.style.height = "160px";
  imagePreview.innerHTML = `
    <div class="preview-loading">
      <p class="preview-loading-brand">My<span class="accent-text">SETUP</span></p>
      <div class="preview-spinner"></div>
    </div>`;

  uploadImageToFirebase(file, id)
    .then((url) => {
      updateComponentInFirebase(id, { imageUrl: url }).then(() => {
        if (allData[id]) allData[id].imageUrl = url;
        refreshPreview(url, imagePreview, imageUploadBtn);
      });
    })
    .catch(() => {
      imagePreview.classList.add("hidden");
      showToast("Yükleme başarısız", "error");
    });
}

/* ─────────────────── Önizleme Sıfırla ─────────────────── */

let _resetRafId: number | null = null;

export function _resetPreviewInstant(): void {
  const imagePreview = document.getElementById("editImagePreview") as HTMLElement | null;
  if (!imagePreview) return;

  if (_resetRafId !== null) {
    cancelAnimationFrame(_resetRafId);
    _resetRafId = null;
  }

  imagePreview.style.transition = "none";
  imagePreview.style.width = "200px";
  imagePreview.style.height = "160px";
  imagePreview.innerHTML = "";
  imagePreview.classList.add("hidden");

  _resetRafId = requestAnimationFrame(() => {
    _resetRafId = requestAnimationFrame(() => {
      imagePreview!.style.transition = "";
      _resetRafId = null;
    });
  });
}

/* ─────────────────── Yıldız Güncelle ─────────────────── */

export function updateStars(rating: number): void {
  const stars = document.querySelectorAll("#editStarRating .star");
  stars.forEach((s) => {
    (s as HTMLElement).classList.toggle(
      "active",
      parseInt((s as HTMLElement).dataset.value!) <= rating,
    );
  });
}
