import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import type { JournalInteraction } from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Authentication instance
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Firestore instance with configured databaseId
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Zero-crash payload sanitizer: recursively removes any undefined values
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => (value === undefined ? null : value))
  );
}

// Auth helper functions
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

// User-Isolated Firestore Operations: /users/{userId}/interactions/{interactionId}
export function getInteractionsCollection(userId: string) {
  if (!userId) {
    throw new Error('User ID is required to access interactions collection.');
  }
  return collection(db, 'users', userId, 'interactions');
}

export function getInteractionDocRef(userId: string, interactionId: string) {
  if (!userId || !interactionId) {
    throw new Error('User ID and Interaction ID are required.');
  }
  return doc(db, 'users', userId, 'interactions', interactionId);
}

// Save or update an interaction with guaranteed transaction verification and sanitation
export async function saveInteraction(
  userId: string,
  interaction: JournalInteraction
): Promise<void> {
  if (!userId) throw new Error('Cannot save interaction: User is not authenticated.');
  const docRef = getInteractionDocRef(userId, interaction.id);
  const cleanPayload = sanitizeForFirestore(interaction);
  await setDoc(docRef, cleanPayload, { merge: true });
}

// Delete an interaction
export async function deleteInteraction(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId) throw new Error('User is not authenticated.');
  const docRef = getInteractionDocRef(userId, interactionId);
  await deleteDoc(docRef);
}

// Subscribe to real-time interaction list for the user
export function subscribeToUserInteractions(
  userId: string,
  onUpdate: (interactions: JournalInteraction[]) => void,
  onError: (error: Error) => void
) {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(getInteractionsCollection(userId), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as JournalInteraction);
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore snapshot subscription error:', err);
      onError(err);
    }
  );
}
