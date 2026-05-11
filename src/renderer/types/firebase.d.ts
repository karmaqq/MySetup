/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    FIREBASE COMPAT SDK TİP TANIMLARI                      */
/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Firebase Compat SDK v9.22.1 — CDN üzerinden yüklenir, global `firebase` */
/*  Bu dosya compat SDK'nin kullanılan kısımları için tip tanımları sağlar. */
/* ═══════════════════════════════════════════════════════════════════════════ */

declare namespace firebase {
  function initializeApp(config: Record<string, unknown>): firebase.app.App;
  function app(name?: string): firebase.app.App;
  function auth(): firebase.auth.Auth;
  function database(): firebase.database.Database;
  function storage(): firebase.storage.Storage;
  var apps: firebase.app.App[];

  type User = firebase.auth.User;

  namespace app {
    interface App {
      name: string;
      options: Record<string, unknown>;
      auth(): firebase.auth.Auth;
      database(): firebase.database.Database;
      storage(): firebase.storage.Storage;
    }
  }

  namespace auth {
    interface Auth {
      currentUser: User | null;
      onAuthStateChanged(
        nextOrObserver: object | ((user: User | null) => void),
      ): () => void;
      signInWithEmailAndPassword(
        email: string,
        password: string,
      ): Promise<UserCredential>;
      createUserWithEmailAndPassword(
        email: string,
        password: string,
      ): Promise<UserCredential>;
      signOut(): Promise<void>;
      sendPasswordResetEmail(email: string): Promise<void>;
      updateCurrentUser(user: User | null): Promise<void>;
      setPersistence(persistence: string): Promise<void>;
    }

    interface User {
      uid: string;
      email: string | null;
      displayName: string | null;
      photoURL: string | null;
      emailVerified: boolean;
      metadata: { creationTime?: string; lastSignInTime?: string };
      updatePassword(newPassword: string): Promise<void>;
      delete(): Promise<void>;
      reload(): Promise<void>;
      getIdTokenResult(): Promise<{ claims: Record<string, unknown> }>;
      getIdToken(forceRefresh?: boolean): Promise<string>;
      updateProfile(profile: {
        displayName?: string | null;
        photoURL?: string | null;
      }): Promise<void>;
      reauthenticateWithCredential(credential: object): Promise<UserCredential>;
    }

    interface UserCredential {
      user: User;
      credential: object | null;
      operationType: string;
    }

    interface AuthError extends Error {
      code: string;
      message: string;
    }

    namespace Auth {
      namespace Persistence {
        var LOCAL: string;
        var SESSION: string;
        var NONE: string;
      }
    }

    var EmailAuthProvider: {
      credential(email: string, password: string): object;
    };
  }

  namespace database {
    interface Database {
      ref(path?: string): Reference;
      goOffline(): void;
      goOnline(): void;
    }

    interface Reference {
      key: string | null;
      parent: Reference | null;
      root: Reference;
      path: string;
      child(path: string): Reference;
      set(value: unknown): Promise<void>;
      update(values: Record<string, unknown>): Promise<void>;
      remove(): Promise<void>;
      push(value?: unknown): ThenableReference;
      once(
        eventType: string,
        successCallback?: (snapshot: DataSnapshot) => void,
      ): Promise<DataSnapshot>;
      on(
        eventType: string,
        callback: (snapshot: DataSnapshot) => void,
        cancelCallbackOrContext?: object,
      ): () => void;
      off(
        eventType?: string,
        callback?: (snapshot: DataSnapshot) => void,
      ): void;
      transaction(
        updateFn: (current: unknown) => unknown,
        onComplete?: (
          error: Error | null,
          committed: boolean,
          snapshot: DataSnapshot | null,
        ) => void,
      ): Promise<{ committed: boolean; snapshot: DataSnapshot | null }>;
      orderByChild(path: string): Query;
      orderByKey(): Query;
      orderByValue(): Query;
      limitToFirst(limit: number): Query;
      limitToLast(limit: number): Query;
      startAt(value: unknown, key?: string): Query;
      endAt(value: unknown, key?: string): Query;
      equalTo(value: unknown, key?: string): Query;
    }

    interface Query {
      ref: Reference;
      once(
        eventType: string,
        successCallback?: (snapshot: DataSnapshot) => void,
      ): Promise<DataSnapshot>;
      on(
        eventType: string,
        callback: (snapshot: DataSnapshot) => void,
        cancelCallbackOrContext?: object,
      ): () => void;
      off(
        eventType?: string,
        callback?: (snapshot: DataSnapshot) => void,
      ): void;
      limitToFirst(limit: number): Query;
      limitToLast(limit: number): Query;
      startAt(value: unknown, key?: string): Query;
      startAfter(value: unknown, key?: string): Query;
      endAt(value: unknown, key?: string): Query;
      endBefore(value: unknown, key?: string): Query;
      equalTo(value: unknown, key?: string): Query;
      orderByChild(path: string): Query;
      orderByKey(): Query;
      orderByValue(): Query;
      toString(): string;
    }

    interface DataSnapshot {
      key: string | null;
      ref: Reference;
      exists(): boolean;
      val(): unknown;
      forEach(action: (child: DataSnapshot) => boolean | void): boolean;
      hasChild(path: string): boolean;
      hasChildren(): boolean;
      numChildren(): number;
      child(path: string): DataSnapshot;
      toJSON(): object | null;
      exportVal(): unknown;
    }

    interface ThenableReference extends Reference, Promise<DataSnapshot> {}

    let ServerValue: {
      TIMESTAMP: number;
    };
  }

  namespace storage {
    interface Storage {
      ref(path?: string): StorageReference;
      refFromURL(url: string): StorageReference;
      maxOperationRetryTime: number;
      maxUploadRetryTime: number;
    }

    interface StorageReference {
      bucket: string;
      name: string;
      fullPath: string;
      parent: StorageReference | null;
      root: StorageReference;
      child(path: string): StorageReference;
      put(
        data: Blob | Uint8Array | ArrayBuffer,
        metadata?: {
          contentType?: string;
          customMetadata?: Record<string, string>;
        },
      ): UploadTask;
      putString(
        data: string,
        format?: string,
        metadata?: { contentType?: string },
      ): UploadTask;
      getDownloadURL(): Promise<string>;
      delete(): Promise<void>;
      listAll(): Promise<ListResult>;
    }

    interface UploadTask {
      snapshot: UploadTaskSnapshot;
      on(
        event: string,
        next?: (snapshot: UploadTaskSnapshot) => void,
        error?: (error: Error) => void,
        complete?: () => void,
      ): () => void;
      then(
        success: (snapshot: UploadTaskSnapshot) => void,
      ): Promise<UploadTaskSnapshot>;
      cancel(): boolean;
      pause(): boolean;
      resume(): boolean;
    }

    interface UploadTaskSnapshot {
      bytesTransferred: number;
      totalBytes: number;
      state: string;
      metadata: { fullPath: string; name: string };
      ref: StorageReference;
      task: UploadTask;
    }

    interface ListResult {
      items: StorageReference[];
      prefixes: StorageReference[];
    }
  }
}
