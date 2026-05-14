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
              const likes =
                (postData && postData.likes) ||
                ((await get(child(child(db.postsRef!, id), "likes"))).val() || {});
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
