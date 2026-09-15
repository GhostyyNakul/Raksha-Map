import { getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const configured = Object.values(config).every(Boolean)
let auth: ReturnType<typeof getAuth> | null = null
if (configured) {
  const app = getApps()[0] ?? initializeApp(config)
  auth = getAuth(app)
}

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export function isFirebaseConfigured() { return configured }
export function getAuthInstance() { return auth }

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) { callback(null); return () => undefined }
  return onAuthStateChanged(auth, callback)
}

export async function loginWithGoogle() {
  if (!auth) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.')
  return (await signInWithPopup(auth, provider)).user
}

export async function logout() {
  if (auth) await signOut(auth)
}

export async function getIdToken(forceRefresh = false) {
  if (!auth?.currentUser) return null
  return auth.currentUser.getIdToken(forceRefresh)
}

export async function isCurrentUserAdmin() {
  if (!auth?.currentUser) return false
  const token = await auth.currentUser.getIdTokenResult()
  return token.claims.admin === true || token.claims.role === 'admin'
}
