/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          HESAP SILME                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "./firebase-init";
import { getPostsByIds } from "./firebase-post";
import { deleteAllInFolder } from "./firebase-inv";

export async function deleteUserAccount(user: firebase.auth.User): Promise<{ success: boolean; error?: any }> {
  const uid = user.uid;

  try {
    await user.getIdToken(true);

    await db.database!.ref("userLikes/" + uid).remove();

    const userPostsSnap = await db.database!.ref("userPosts/" + uid).once("value");
    const postIds = userPostsSnap.val() ? Object.keys(userPostsSnap.val() as Record<string, any>) : [];

    const allPostsGlobal = (window as any).allPosts || {};
    const postDataMap = await getPostsByIds(postIds, allPostsGlobal);
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
              const likesSnap = await db.postsRef!
                .child(id)
                .child("likes")
                .once("value");
              const likes = likesSnap.val() || {};
              const likeCleanups = Object.keys(likes).map(function (userId) {
                return db.userLikesRef!.child(userId).child(id).remove();
              });
              await Promise.all(likeCleanups);
              await db.postsRef!.child(id).remove();
            }),
          );
        }),
      );
    }

    await db.database!.ref("userPosts/" + uid).remove();
    await db.database!.ref("users/" + uid).remove();

    const usernameKey = (user.displayName || "").trim().toLowerCase();
    if (usernameKey) {
      const ref = db.database!.ref("usernames/" + usernameKey);
      const snap = await ref.once("value");
      if (snap.val() === uid) await ref.remove();
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
    console.error("Hesap silme hatası:", e);
    return { success: false, error: e };
  }
}
