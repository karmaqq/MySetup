/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FIREBASE ANA YAPISI                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { normalizeTr } from "./global-ut";
import { allData, resetStatsCache } from "./app-state";
import { db } from "./firebase-init";

/* ─────────────────── Enrich Item ─────────────────── */

export function enrichItem(item: any): any {
  const searchRaw = (
    (item.component || "") +
    " " +
    (item.brand || "") +
    " " +
    (item.specs || "") +
    " " +
    (item.vendor || "")
  ).toLowerCase();
  return Object.assign({}, item, {
    _searchTag: normalizeTr(searchRaw),
    _statusNorm: normalizeTr(item.status || ""),
  });
}

/* ─────────────────── User Data Ref Yönetimi ─────────────────── */
/*  Bu fonksiyon table.ts'deki fonksiyonlara ihtiyaç duyar. içe aktarılan  */
/*  referanslar çalışma anında çözümlenir (esbuild döngüsel bağımlılık).     */

import { rebuildStatsCache, updateStatsCacheOnChange } from "./toolbar";
import {
  renderAll,
  addOrUpdateTableRow,
  removeTableRow,
} from "./table";

let _initToken: string | null = null;

export function initUserDataRef(userId: string | null): void {
  const sessionToken = Date.now() + "_" + Math.random();
  _initToken = sessionToken;

  if (db.userDataRef) {
    db.userDataRef.off();
    db.userDataRef = null;
  }

  resetStatsCache();

  if (!userId) {
    db.activeBasePath = null;
    Object.keys(allData).forEach(function (k) { delete allData[k]; });
    renderAll();
    return;
  }

  db.activeBasePath = "users/" + userId + "/components";
  db.userDataRef = db.database!.ref(db.activeBasePath);

  db.userDataRef.once("value").then(function (snapshot) {
    if (_initToken !== sessionToken) return;
    const rawData = (snapshot.val() || {}) as Record<string, any>;
    Object.keys(allData).forEach(function (k) { delete allData[k]; });
    Object.keys(rawData).forEach(function (id) {
      const item = enrichItem(rawData[id]);
      item.id = id;
      allData[id] = item;
    });
    rebuildStatsCache();
    renderAll();

    db.userDataRef!.on(
      "child_added",
      function (snapshot) {
        if (_initToken !== sessionToken) return;
        const id = snapshot.key!;
        const item = enrichItem(snapshot.val());
        item.id = id;
        const oldItem = allData[id];
        allData[id] = item;
        updateStatsCacheOnChange(item, oldItem, false);
        addOrUpdateTableRow(id, item);
      },
      function (err: any) {
        if (_initToken !== sessionToken) return;
        if (!db.userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
        // child_added hatası sessizce geçildi
      },
    );

    db.userDataRef!.on(
      "child_changed",
      function (snapshot) {
        if (_initToken !== sessionToken) return;
        const id = snapshot.key!;
        const item = enrichItem(snapshot.val());
        item.id = id;
        const oldItem = allData[id];
        allData[id] = item;
        updateStatsCacheOnChange(item, oldItem, false);
        addOrUpdateTableRow(id, item);
      },
      function (err: any) {
        if (_initToken !== sessionToken) return;
        if (!db.userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
        // child_changed hatası sessizce geçildi
      },
    );

    db.userDataRef!.on(
      "child_removed",
      function (snapshot) {
        if (_initToken !== sessionToken) return;
        const id = snapshot.key!;
        const oldItem = allData[id];
        delete allData[id];
        if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
        removeTableRow(id);
      },
      function (err: any) {
        if (_initToken !== sessionToken) return;
        if (!db.userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
        // child_removed hatası sessizce geçildi
      },
    );
  });
}
