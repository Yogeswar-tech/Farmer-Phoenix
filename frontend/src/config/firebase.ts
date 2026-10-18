import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _auth: Auth | null = null;

/**
 * Returns a Firebase Auth instance when VITE_FIREBASE_* env vars are configured,
 * or null when running in local dev without Firebase setup.
 * The OTP flow in LoginModal gracefully falls back to mock tokens when null is returned.
 */
export function getFirebaseAuth(): Auth | null {
  const env = (typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {}) as Record<string, string | undefined>;
  const apiKey = (env.VITE_FIREBASE_API_KEY || env.KS_FIREBASE_API_KEY || '').trim();
  if (!apiKey || apiKey.includes('your_') || apiKey.includes('placeholder')) return null;

  if (_auth) return _auth;

  const app = getApps().length === 0
    ? initializeApp({
        apiKey,
        authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || env.KS_FIREBASE_AUTH_DOMAIN || 'kisansetu-dev.firebaseapp.com').trim(),
        projectId: (env.VITE_FIREBASE_PROJECT_ID || env.KS_FIREBASE_PROJECT_ID || 'kisansetu-dev').trim(),
        storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || env.KS_FIREBASE_STORAGE_BUCKET || 'kisansetu-dev.firebasestorage.app').trim(),
        messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.KS_FIREBASE_MESSAGING_SENDER_ID || '66226476599').trim(),
        appId: (env.VITE_FIREBASE_APP_ID || env.KS_FIREBASE_APP_ID || '').trim(),
      })
    : getApp();

  _auth = getAuth(app);
  return _auth;
}
