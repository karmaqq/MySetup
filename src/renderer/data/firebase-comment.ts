/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          YORUM / YANIT FIREBASE İŞLEMLERİ                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { child, push, remove, runTransaction, ThenableReference } from "firebase/database";
import { db } from "../core/firebase-init";

/* ─────────────────── Yorum CRUD ─────────────────── */

export function addCommentToFirebase(postId: string, commentData: any): ThenableReference {
  return push(child(child(db.postsRef!, postId), "comments"), commentData) as ThenableReference;
}

/* ─────────────────── Yorum Silme ─────────────────── */

export function deleteCommentFromFirebase(postId: string, commentId: string): Promise<void> {
  return remove(child(child(child(db.postsRef!, postId), "comments"), commentId));
}

/* ─────────────────── Yorum Beğeni ─────────────────── */

export function toggleCommentLike(postId: string, commentId: string, userId: string): Promise<any> {
  const likeRef = child(child(child(child(child(db.postsRef!, postId), "comments"), commentId), "likes"), userId);
  return runTransaction(likeRef, function (current) {
    return current ? null : true;
  });
}

/* ─────────────────── Yanıt CRUD ─────────────────── */

export function addReplyToFirebase(postId: string, commentId: string, replyData: any): ThenableReference {
  return push(child(child(child(child(db.postsRef!, postId), "comments"), commentId), "replies"), replyData) as ThenableReference;
}

/* ─────────────────── Yanıt Silme ─────────────────── */

export function deleteReplyFromFirebase(postId: string, commentId: string, replyId: string): Promise<void> {
  return remove(child(child(child(child(child(db.postsRef!, postId), "comments"), commentId), "replies"), replyId));
}

/* ─────────────────── Yanıt Beğeni ─────────────────── */

export function toggleReplyLike(postId: string, commentId: string, replyId: string, userId: string): Promise<any> {
  const likeRef = child(child(child(child(child(child(child(db.postsRef!, postId), "comments"), commentId), "replies"), replyId), "likes"), userId);
  return runTransaction(likeRef, function (current) {
    return current ? null : true;
  });
}
