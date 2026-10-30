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

try {
  const app = getApps().length ? getApp() : initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);

  // Validate connection to Firestore as required by Firebase skill
  getDocFromServer(doc(db, 'cfg', 'main'))
    .then(() => {
      console.log('✅ Firestore Cloud Connected:', config.firestoreDatabaseId);
    })
    .catch((err) => {
      if (err instanceof Error && err.message.includes('the client is offline')) {
        console.warn('Firestore offline note:', err.message);
      }
    });

  try {
    const auth = getAuth(app);
    signInAnonymously(auth).catch(() => {
      // Anonymous auth optional; rules permit read/write
    });
  } catch (e) {}

  const adapter = {
    raw: db,
    config,
    databaseId: config.firestoreDatabaseId,
    projectId: config.projectId,
    async testPing() {
      const t0 = Date.now();
      const testRef = doc(db, 'cfg', 'main');
      await getDocFromServer(testRef);
      return Date.now() - t0;
    },
    doc(path: string) {
      const dRef = doc(db, path);
      return {
        set(data: any) { return setDoc(dRef, data); },
        delete() { return deleteDoc(dRef); },
        get() { return getDoc(dRef); },
        onSnapshot(onNext: (s: any) => void, onError?: (e: any) => void) {
          return onSnapshot(dRef, onNext, onError);
        }
      };
    },
    collection(path: string) {
      const cRef = collection(db, path);
      return {
        onSnapshot(onNext: (s: any) => void, onError?: (e: any) => void) {
          return onSnapshot(cRef, onNext, onError);
        }
      };
    }
  };

  (window as any).__firebaseDB = adapter;
  (window as any).FIREBASE_CONFIG = config;
  if (typeof (window as any).__onCloudDbInit === 'function') {
    (window as any).__onCloudDbInit(adapter);
  }
  window.dispatchEvent(new CustomEvent('cloud-db-ready', { detail: adapter }));
  console.log('✅ Firebase Cloud DB adapter ready for:', config.firestoreDatabaseId);
} catch (e) {
  console.error('Firebase init error:', e);
}
