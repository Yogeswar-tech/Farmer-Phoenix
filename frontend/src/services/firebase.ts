import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase Web Configuration
 * Loaded directly from the single backend/.env file (KS_FIREBASE_* or VITE_FIREBASE_*)
 */
const env = (typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {}) as Record<string, string | undefined>;

const rawApiKey = (env.KS_FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || '').trim();
export const isFirebaseConfigured = Boolean(
  rawApiKey &&
  !rawApiKey.includes('your_') &&
  !rawApiKey.includes('placeholder')
);

// Fallback values prevent Firebase Auth SDK from throwing top-level synchronous crash when keys are unset
const firebaseConfig = {
  apiKey: isFirebaseConfigured ? rawApiKey : 'AIzaSyDemoPlaceholderKeyForLocalDevOnly00',
  authDomain: (env.KS_FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || 'kisan-sethu.firebaseapp.com').trim(),
  projectId: (env.KS_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || 'kisan-sethu').trim(),
  storageBucket: (env.KS_FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || 'kisan-sethu.appspot.com').trim(),
  messagingSenderId: (env.KS_FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012').trim(),
  appId: (env.KS_FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456').trim()
};

// Initialize Firebase App singleton safely
export const firebaseApp: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth singleton for web safely
export const firebaseAuth: Auth = getAuth(firebaseApp);

