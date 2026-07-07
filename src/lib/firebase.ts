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

// Firebase Hosting serves the /__/auth/* helpers on EVERY hosting domain, so
// when the app runs on one (web.app or firebaseapp.com) the OAuth redirect can
// stay same-origin by pointing authDomain at the serving host. With the fixed
// authDomain, sign-in from the other domain bounces through a third-party
// origin whose storage modern browsers partition — the redirect result never
// comes back and sign-in silently fails. Elsewhere (localhost dev) the
// configured authDomain is kept.
const config = { ...firebaseConfig }
if (/\.(web\.app|firebaseapp\.com)$/.test(window.location.hostname)) {
  config.authDomain = window.location.hostname
}

const app = initializeApp(config)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Re-exported so callers only need one dynamic import() site (AuthProvider).
export { onAuthStateChanged, signInWithRedirect, signOut, getRedirectResult }
