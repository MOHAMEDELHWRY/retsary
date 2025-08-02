// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlKr5prSIXiW6UPzpI8MDj7wVdOXLrGtY",
  authDomain: "retsary-e622c.firebaseapp.com",
  projectId: "retsary-e622c",
  storageBucket: "retsary-e622c.firebasestorage.app",
  messagingSenderId: "1080480805531",
  appId: "1:1080480805531:web:326d55de0777df33914c3e",
  measurementId: "G-4NFQ9CH8Z0"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Increase the maximum retry time for uploads to handle larger files or slower networks
storage.maxUploadRetryTime = 300000; // 5 minutes
storage.maxOperationRetryTime = 300000; // 5 minutes

export { app, analytics, db, auth, storage };
