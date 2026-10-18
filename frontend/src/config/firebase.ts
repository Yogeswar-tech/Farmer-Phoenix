import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _auth: Auth | null = null;

/**
 * Returns a Firebase Auth instance when VITE_FIREBASE_* env vars are configured,
 * or null when running in local dev without Firebase setup.
 * The OTP flow in LoginModal gracefully falls back to mock tokens when null is returned.
 */
export function getFirebaseAuth(): Auth | null {
  const apiKey: string = import.meta.env.VITE_FIREBASE_API_KEY ?? '';
  if (!apiKey) return null;

  if (_auth) return _auth;

  const app = getApps().length === 0
    ? initializeApp({
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
        appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
      })
    : getApp();

  _auth = getAuth(app);
  return _auth;
}
