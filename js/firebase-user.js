/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═════════════════════════════════════════════════════════════════════════ */
/*                          HESAP SILME                                  */
/* ═════════════════════════════════════════════════════════════════════════ */

async function deleteUserAccount(user) {
  const uid = user.uid;

  try {
    await user.getIdToken(true);

    // UserLikes (kullanıcının beğendikleri)
    await database.ref("userLikes/" + uid).remove();

    // UserPosts - likes temizliği ile toplu sil
    const userPostsSnap = await database.ref("userPosts/" + uid).once("value");
    const postIds = userPostsSnap.val() ? Object.keys(userPostsSnap.val()) : [];

    // Her post için likes temizle + post sil (userPosts tek tek silinmez,
    // toplu silme alttaki remove() ile yapılır)
    const postDataMap = await getPostsByIds(postIds);
    const BATCH_SIZE = 10;
    for (var i = 0; i < postIds.length; i += BATCH_SIZE) {
      var batch = postIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async function (id) {
          var imageUrl = postDataMap[id] ? postDataMap[id].imageUrl : null;
          if (imageUrl) {
            try { await firebase.storage().refFromURL(imageUrl).delete(); } catch (_) {}
          }
          var likesSnap = await postsRef.child(id).child("likes").once("value");
          var likes = likesSnap.val() || {};
          var likeCleanups = Object.keys(likes).map(function (userId) {
            return userLikesRef.child(userId).child(id).remove();
          });
          await Promise.all(likeCleanups);
          await postsRef.child(id).remove();
        }),
      );
    }

    await database.ref("userPosts/" + uid).remove();

    // Database temizliği
    await database.ref("users/" + uid).remove();

    // Username temizliği
    const usernameKey = (user.displayName || "").trim().toLowerCase();
    if (usernameKey) {
      const ref = database.ref("usernames/" + usernameKey);
      const snap = await ref.once("value");
      if (snap.val() === uid) await ref.remove();
    }

    // Storage
    await deleteAllInFolder(
      firebase
        .storage()
        .ref()
        .child("users/" + uid),
    );

    // Auth
    await user.delete();

    return { success: true };
  } catch (e) {
    console.error("Hesap silme hatası:", e);
    return { success: false, error: e };
  }
}
