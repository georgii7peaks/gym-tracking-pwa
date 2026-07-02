// Firebase app + service singletons (Phase 4 — Google auth + Firestore sync).
// Always reached via a dynamic import() (see AuthProvider), never a static
// top-level import, so Guest Mode users never download this module at all
// (IMPLEMENTATION_PLAN.md §5: "Guest Mode never loads network code").
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from '@/config/firebase.config'

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Re-exported so callers only need one dynamic import() site (AuthProvider).
export { onAuthStateChanged, signInWithRedirect, signOut, getRedirectResult }
