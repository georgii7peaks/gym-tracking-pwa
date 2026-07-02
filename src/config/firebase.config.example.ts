// Template for src/config/firebase.config.ts (gitignored — see src/config/.gitignore).
// Copy this file to firebase.config.ts and fill in your Firebase project's web
// app config (Project settings -> General -> Your apps -> Web app -> SDK setup).
// This is a client-side web config, not a secret (Firebase docs: safe to expose
// publicly) — access control is enforced by Firestore security rules, not by
// hiding this file. It's still gitignored per this repo's convention.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
}
