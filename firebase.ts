
import React from 'react';
// Fix: Using namespace import for firebase/app to avoid 'no exported member' errors
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Fix: Using namespace import for firestore to avoid 'no exported member' errors
import * as firestore from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDALDGiPJQUOV1FODEC-Wv9lof0fbDI6GI",
  authDomain: "sg-tms-v2.firebaseapp.com",
  projectId: "sg-tms-v2",
  storageBucket: "sg-tms-v2.firebasestorage.app",
  messagingSenderId: "713765974154",
  appId: "1:713765974154:web:59f41edc6ed512a0dd3d73",
  measurementId: "G-43X8CK85LQ"
};

// Fix: Access initializeApp from firebaseApp namespace with any cast
const app = (firebaseApp as any).initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Fix: Access initializeFirestore with persistent local cache to optimize read quota
export const db = (firestore as any).initializeFirestore(app, {
  localCache: (firestore as any).persistentLocalCache({
    tabManager: (firestore as any).persistentMultipleTabManager()
  })
});