// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDWPq92w48NfPzuec0TPFfni-ZVQMFJOLs",
  authDomain: "thaoluandaihoi.firebaseapp.com",
  databaseURL: "https://thaoluandaihoi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "thaoluandaihoi",
  storageBucket: "thaoluandaihoi.firebasestorage.app",
  messagingSenderId: "843405316234",
  appId: "1:843405316234:web:06d7cd6d1d9dbd49605d73",
  measurementId: "G-HNGH4F39TG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const ADMIN_EMAIL = "thaibaoh2002@gmail.com";
