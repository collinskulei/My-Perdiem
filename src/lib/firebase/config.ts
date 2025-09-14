/**
 * @file This file handles the initialization of the Firebase app instance.
 * It reads Firebase configuration from environment variables and ensures that
 * the app is initialized only once (singleton pattern).
 */
import { initializeApp, getApps, getApp } from "firebase/app";

/**
 * Your web app's Firebase configuration.
 * For Firebase JS SDK v7.20.0 and later, measurementId is optional.
 * These values are pulled from environment variables to keep them secure.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase.
// This check prevents the app from being initialized multiple times, which would cause an error.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export default app;
