import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use experimentalForceLongPolling to completely bypass WebChannel transport.
// This prevents the "INTERNAL ASSERTION FAILED: Unexpected state" watch stream
// error which is a known Firebase JS SDK v12.x bug with the default gRPC transport.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

if (import.meta.env.VITE_DEV_MODE === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
