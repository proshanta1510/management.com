import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import config from '../firebase-applet-config.json';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let dbInstance: any = null;
let adapterInstance: any = null;
let initPromise: Promise<any> | null = null;

export async function getFirebaseAdapter() {
  if (adapterInstance) return adapterInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const app = getApps().length ? getApp() : initializeApp(config);
      const db = getFirestore(app, config.firestoreDatabaseId);
      dbInstance = db;

      try {
        const auth = getAuth(app);
        signInAnonymously(auth).catch(() => {});
      } catch (e) {}

      // Test connection with getDocFromServer as required by Firebase skill
      try {
        await getDocFromServer(doc(db, '_ping', 'status')).catch(() => {});
        console.log('✅ Firestore Cloud Connected:', config.firestoreDatabaseId);
      } catch (err) {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          console.warn('Firestore offline note:', err.message);
        }
      }

      const adapter = {
        raw: db,
        config,
        databaseId: config.firestoreDatabaseId,
        projectId: config.projectId,
        async testPing() {
          const t0 = Date.now();
          const testRef = doc(db, '_ping', 'status');
          const pingData = {
            app: 'Durgapur Enterprise POS',
            databaseId: config.firestoreDatabaseId,
            time: new Date().toISOString(),
            ts: Date.now()
          };
          try {
            await setDoc(testRef, pingData);
            const snap = await getDocFromServer(testRef);
            if (!snap.exists()) {
              throw new Error('সার্ভারে ডাটা পাওয়া যায়নি');
            }
            return Date.now() - t0;
          } catch (err: any) {
            handleFirestoreError(err, OperationType.WRITE, '_ping/status');
            throw err;
          }
        },
        doc(path: string) {
          const dRef = doc(db, path);
          return {
            async set(data: any) {
              try {
                return await setDoc(dRef, data);
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, path);
              }
            },
            async delete() {
              try {
                return await deleteDoc(dRef);
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, path);
              }
            },
            async get() {
              try {
                return await getDoc(dRef);
              } catch (err) {
                handleFirestoreError(err, OperationType.GET, path);
              }
            },
            onSnapshot(onNext: (s: any) => void, onError?: (e: any) => void) {
              return onSnapshot(dRef, onNext, (err) => {
                if (onError) onError(err);
                try {
                  handleFirestoreError(err, OperationType.GET, path);
                } catch (e) {}
              });
            }
          };
        },
        collection(path: string) {
          const cRef = collection(db, path);
          return {
            onSnapshot(onNext: (s: any) => void, onError?: (e: any) => void) {
              return onSnapshot(cRef, onNext, (err) => {
                if (onError) onError(err);
                try {
                  handleFirestoreError(err, OperationType.LIST, path);
                } catch (e) {}
              });
            }
          };
        }
      };

      adapterInstance = adapter;
      (window as any).__firebaseDB = adapter;
      (window as any).FIREBASE_CONFIG = config;

      if (typeof (window as any).__onCloudDbInit === 'function') {
        (window as any).__onCloudDbInit(adapter);
      }
      window.dispatchEvent(new CustomEvent('cloud-db-ready', { detail: adapter }));
      console.log('✅ Firebase Cloud DB adapter ready for:', config.firestoreDatabaseId);
      return adapter;
    } catch (e) {
      console.error('Firebase init error:', e);
      throw e;
    }
  })();

  return initPromise;
}

// Auto-start initialization
getFirebaseAdapter();

(window as any).__getFirebaseDB = getFirebaseAdapter;
