/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM / YANIT FIREBASE İŞLEMLERİ                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "./firebase-init";

/* ─────────────────── Yorum CRUD ─────────────────── */

export function addCommentToFirebase(postId: string, commentData: any): firebase.database.ThenableReference {
  return db.postsRef!.child(postId).child("comments").push(commentData);
}

/* ── Yorum Silme ── */

export function deleteCommentFromFirebase(postId: string, commentId: string): Promise<void> {
  return db.postsRef!.child(postId).child("comments").child(commentId).remove();
}

/* ── Yorum Beğeni ── */

export function toggleCommentLike(postId: string, commentId: string, userId: string): Promise<any> {
  const likeRef = db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("likes")
    .child(userId);
  return likeRef.transaction(function (current) {
    return current ? null : true;
  });
}

/* ─────────────────── Yanıt CRUD ─────────────────── */

export function addReplyToFirebase(postId: string, commentId: string, replyData: any): firebase.database.ThenableReference {
  return db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .push(replyData);
}

/* ── Yanıt Silme ── */

export function deleteReplyFromFirebase(postId: string, commentId: string, replyId: string): Promise<void> {
  return db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .child(replyId)
    .remove();
}

/* ── Yanıt Beğeni ── */

export function toggleReplyLike(postId: string, commentId: string, replyId: string, userId: string): Promise<any> {
  const likeRef = db.postsRef!
    .child(postId)
    .child("comments")
    .child(commentId)
    .child("replies")
    .child(replyId)
    .child("likes")
    .child(userId);
  return likeRef.transaction(function (current) {
    return current ? null : true;
  });
}
