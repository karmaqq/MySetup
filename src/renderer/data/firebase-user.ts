/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          HESAP SILME                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { get, ref, child, update, remove } from "firebase/database";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { getIdToken, deleteUser } from "firebase/auth";
import { User } from "firebase/auth";
import { allPosts } from "../social/post-render";
import { db } from "../core/firebase-init";
import { getPostsByIds } from "./firebase-post";
import { deleteAllInFolder, extractPathFromUrl } from "../core/global-ut";
import { currentUser } from "../core/app-state";

/* ─────────────────── Hesap Silme ─────────────────── */

export async function deleteUserAccount(user: User): Promise<{ success: boolean; error?: any }> {
  const uid = user.uid;

  try {
    await getIdToken(user, true);

    await remove(ref(db.database, "userLikes/" + uid));

    const userPostsSnap = await get(ref(db.database, "userPosts/" + uid));
    const postIds = userPostsSnap.val() ? Object.keys(userPostsSnap.val() as Record<string, any>) : [];

    const postDataMap = await getPostsByIds(postIds, allPosts);
    const postErrors: any[] = [];
    const BATCH_SIZE = 10;
    const MAX_PARALLEL_BATCHES = 5;
    const batches: string[][] = [];
    for (let i = 0; i < postIds.length; i += BATCH_SIZE) {
      batches.push(postIds.slice(i, i + BATCH_SIZE));
    }
    for (let j = 0; j < batches.length; j += MAX_PARALLEL_BATCHES) {
      await Promise.all(
        batches.slice(j, j + MAX_PARALLEL_BATCHES).map(function (batch) {
          return Promise.all(
            batch.map(async function (id) {
              const postData = postDataMap[id];
              const imageUrl = postData ? postData.imageUrl : null;
              const imagePath = postData ? postData.imagePath : null;
              if (imageUrl) {
                try {
                  await deleteObject(storageRef(getStorage(), imagePath || extractPathFromUrl(imageUrl) || imageUrl));
                } catch (_) {}
              }
              const likes = (postData && postData.likes) || {};
              const updates: Record<string, any> = {};
              updates["posts/" + id] = null;
              Object.keys(likes).forEach(function (userId) {
                updates["userLikes/" + userId + "/" + id] = null;
              });
              try {
                await update(ref(db.database), updates);
      } catch (e) {
        postErrors.push({ postId: id, error: e });
      }
            }),
          );
        }),
      );
    }

    if (postErrors.length > 0) {
      return { success: false, error: new Error(postErrors.length + " post silinemedi.") };
    }

    await remove(ref(db.database, "userPosts/" + uid));
    await remove(ref(db.database, "users/" + uid));

    const usernameKey = (user.displayName || "").trim().toLowerCase();
    if (usernameKey) {
      await remove(ref(db.database, "usernames/" + usernameKey)).catch(function () {});
    }

    await deleteAllInFolder(
      storageRef(getStorage(), "users/" + uid),
    );

    await deleteUser(user);

    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      PROFİL ZİYARET VERİLERİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kullanıcı Genel Verisi Çekme ─────────────────── */

export async function getUserPublicData(uid: string): Promise<{ username: string; avatarUrl?: string | null }> {
  var userSnap = await get(child(ref(db.database), "users/" + uid));
  var userData = userSnap.val() as any;

  var avatarUrl: string | null = (userData && userData.avatarUrl) || null;

  var username = "Kullanıcı";
  var usernamesSnap = await get(child(ref(db.database), "usernames"));
  var usernames = usernamesSnap.val() as Record<string, string> | null;
  if (usernames) {
    var keys = Object.keys(usernames);
    for (var i = 0; i < keys.length; i++) {
      if (usernames[keys[i]] === uid) {
        username = keys[i];
        break;
      }
    }
  }

  return { username: username, avatarUrl: avatarUrl };
}

/* ─────────────────── Kullanıcı Gizlilik Ayarları ─────────────────── */

export async function getUserPrivacySettings(uid: string): Promise<{ inventoryPrivacy: boolean; likesPrivacy: boolean }> {
  try {
    var snap = await get(child(ref(db.database), "users/" + uid + "/settings"));
    var data = (snap.val() || {}) as any;
    return {
      inventoryPrivacy: data.inventoryPrivacy === true,
      likesPrivacy: data.likesPrivacy === true,
    };
  } catch (_) {
    return { inventoryPrivacy: false, likesPrivacy: false };
  }
}

export function updateUserPrivacy(field: string, value: boolean): Promise<void> {
  var user = currentUser;
  if (!user) return Promise.reject("Kullanıcı yok");
  return update(child(ref(db.database), "users/" + user.uid + "/settings"), { [field]: value });
}
