/*--- zorunlu - agents.md yorum kurallarına uy ---*/

/* ═════════════════════════════════════════════════════════════════════════ */
/*                          HESAP SILME                                  */
/* ═════════════════════════════════════════════════════════════════════════ */

async function deleteUserAccount(user) {
  const uid = user.uid;

  try {
    await user.getIdToken(true);

    // UserLikes
    await database.ref("userLikes/" + uid).remove();

    // UserPosts
    const userPostsSnap = await database.ref("userPosts/" + uid).once("value");
    const postIds = userPostsSnap.val() ? Object.keys(userPostsSnap.val()) : [];
    await Promise.all(
      postIds.map((id) => database.ref("posts/" + id).remove()),
    );
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
