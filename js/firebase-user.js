/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          HESAP SILME                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function deleteUserAccount(user) {
  const uid = user.uid;

  try {
    await user.getIdToken(true);

    await database.ref("userLikes/" + uid).remove();

    const userPostsSnap = await database.ref("userPosts/" + uid).once("value");
    const postIds = userPostsSnap.val() ? Object.keys(userPostsSnap.val()) : [];

    const postDataMap = await getPostsByIds(
      postIds,
      typeof allPosts !== "undefined" ? allPosts : {},
    );
    const BATCH_SIZE = 10;
    const MAX_PARALLEL_BATCHES = 5;
    const batches = [];
    for (var i = 0; i < postIds.length; i += BATCH_SIZE) {
      batches.push(postIds.slice(i, i + BATCH_SIZE));
    }
    for (var j = 0; j < batches.length; j += MAX_PARALLEL_BATCHES) {
      await Promise.all(
        batches.slice(j, j + MAX_PARALLEL_BATCHES).map(function (batch) {
          return Promise.all(
            batch.map(async function (id) {
              var imageUrl = postDataMap[id] ? postDataMap[id].imageUrl : null;
              if (imageUrl) {
                try {
                  await firebase.storage().refFromURL(imageUrl).delete();
                } catch (_) {}
              }
              var likesSnap = await postsRef
                .child(id)
                .child("likes")
                .once("value");
              var likes = likesSnap.val() || {};
              var likeCleanups = Object.keys(likes).map(function (userId) {
                return userLikesRef.child(userId).child(id).remove();
              });
              await Promise.all(likeCleanups);
              await postsRef.child(id).remove();
            }),
          );
        }),
      );
    }

    await database.ref("userPosts/" + uid).remove();

    await database.ref("users/" + uid).remove();

    const usernameKey = (user.displayName || "").trim().toLowerCase();
    if (usernameKey) {
      const ref = database.ref("usernames/" + usernameKey);
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
