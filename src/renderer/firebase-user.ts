/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          HESAP SILME                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { allPosts } from "./posts-render";
import { db } from "./firebase-init";
import { getPostsByIds } from "./firebase-post";
import { deleteAllInFolder } from "./global-ut";

/* ─────────────────── Hesap Silme ─────────────────── */

export async function deleteUserAccount(user: firebase.auth.User): Promise<{ success: boolean; error?: any }> {
  const uid = user.uid;

  try {
    await user.getIdToken(true);

    await db.database!.ref("userLikes/" + uid).remove();

    const userPostsSnap = await db.database!.ref("userPosts/" + uid).once("value");
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
              const imageUrl = postDataMap[id] ? postDataMap[id].imageUrl : null;
              if (imageUrl) {
                try {
                  await firebase.storage().refFromURL(imageUrl).delete();
                } catch (_) {}
              }
              const likes =
                (postDataMap[id] && postDataMap[id].likes) ||
                ((await db.postsRef!.child(id).child("likes").once("value")).val() || {});
              const updates: Record<string, any> = {};
              updates["posts/" + id] = null;
              Object.keys(likes).forEach(function (userId) {
                updates["userLikes/" + userId + "/" + id] = null;
              });
              try {
                await db.database!.ref().update(updates);
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

    await db.database!.ref("userPosts/" + uid).remove();
    await db.database!.ref("users/" + uid).remove();

    const usernameKey = (user.displayName || "").trim().toLowerCase();
    if (usernameKey) {
      await db.database!.ref("usernames/" + usernameKey).remove().catch(function () {});
    }

    await deleteAllInFolder(
      firebase
        .storage()
        .ref()
        .child("users/" + uid),
    );

    await user.delete();

    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}
