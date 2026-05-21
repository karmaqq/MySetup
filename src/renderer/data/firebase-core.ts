/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          FIREBASE ANA YAPISI                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { get, ref, onChildAdded, onChildChanged, onChildRemoved, off, DataSnapshot } from "firebase/database";
import { normalizeTr } from "../core/global-ut";
import { allData, resetStatsCache } from "../core/app-state";
import { db } from "../core/firebase-init";

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

import { rebuildStatsCache, updateStatsCacheOnChange } from "../inventory/toolbar";
import {
  renderAll,
  addOrUpdateTableRow,
  removeTableRow,
} from "../inventory/table";

let _initToken: string | null = null;

export function initUserDataRef(userId: string | null, skipListeners?: boolean): void {
  const sessionToken = Date.now() + "_" + Math.random();
  _initToken = sessionToken;

  if (db.userDataRef) {
    off(db.userDataRef);
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
  db.userDataRef = ref(db.database, db.activeBasePath);

  get(db.userDataRef!).then(function (snapshot) {
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

    if (skipListeners) return;

    onChildAdded(db.userDataRef!,
      function (snapshot) {
        if (_initToken !== sessionToken) return;
        const id = snapshot.key!;
        if (allData[id]) return;
        const item = enrichItem(snapshot.val());
        item.id = id;
        allData[id] = item;
        updateStatsCacheOnChange(item, undefined, false);
        addOrUpdateTableRow(id, item);
      },
      function (err: any) {
        if (_initToken !== sessionToken) return;
        if (!db.userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
      },
    );

    onChildChanged(db.userDataRef!,
      function (snapshot) {
        if (_initToken !== sessionToken) return;
        const id = snapshot.key!;
        const item = enrichItem(snapshot.val());
        item.id = id;
        const oldItem = allData[id];
        allData[id] = item;
        updateStatsCacheOnChange(item, oldItem, false);
        addOrUpdateTableRow(id, item, oldItem);
      },
      function (err: any) {
        if (_initToken !== sessionToken) return;
        if (!db.userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
      },
    );

    onChildRemoved(db.userDataRef!,
      function (snapshot) {
        if (_initToken !== sessionToken) return;
        const id = snapshot.key!;
        const oldItem = allData[id];
        delete allData[id];
        if (Object.keys(allData).length === 0) {
          if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
          renderAll();
          return;
        }
        if (oldItem) updateStatsCacheOnChange(oldItem, oldItem, true);
        removeTableRow(id);
      },
      function (err: any) {
        if (_initToken !== sessionToken) return;
        if (!db.userDataRef) return;
        if (err && err.toString().includes("permission_denied")) return;
      },
    );
  });
}
