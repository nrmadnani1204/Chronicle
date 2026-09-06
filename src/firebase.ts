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
import type { JournalInteraction, ChronicleMemory, GraphNode, GraphEdge, UserProfile } from './types';
import firebaseAppletConfig from '../firebase-applet-config.json';

// apiKey is sourced from VITE_FIRESTORE_API_KEY (not the committed JSON file) —
// a Firestore/Firebase-scoped key, unrelated to Gemini auth (server-side
// Gemini calls go through Vertex AI + Application Default Credentials, not
// an API key at all — see backend/config.py).
const firebaseConfig = {
  ...firebaseAppletConfig,
  apiKey: import.meta.env.VITE_FIRESTORE_API_KEY || firebaseAppletConfig.apiKey,
};

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

// User-Isolated Memories Collection: /users/{userId}/memories/{memoryId}
export function getMemoriesCollection(userId: string) {
  if (!userId) throw new Error('User ID is required.');
  return collection(db, 'users', userId, 'memories');
}

export async function saveMemory(
  userId: string,
  memory: ChronicleMemory
): Promise<void> {
  if (!userId) throw new Error('User is not authenticated.');
  const docRef = doc(db, 'users', userId, 'memories', memory.id);
  await setDoc(docRef, sanitizeForFirestore(memory), { merge: true });
}

export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<void> {
  if (!userId) throw new Error('User is not authenticated.');
  const docRef = doc(db, 'users', userId, 'memories', memoryId);
  await deleteDoc(docRef);
}

export function subscribeToUserMemories(
  userId: string,
  onUpdate: (memories: ChronicleMemory[]) => void,
  onError: (error: Error) => void
) {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(getMemoriesCollection(userId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChronicleMemory[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ChronicleMemory);
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore memories subscription error:', err);
      onError(err);
    }
  );
}

// User-Isolated Knowledge Graph: /users/{userId}/graph_nodes, /graph_edges
export function getGraphNodesCollection(userId: string) {
  if (!userId) throw new Error('User ID is required.');
  return collection(db, 'users', userId, 'graph_nodes');
}

export function getGraphEdgesCollection(userId: string) {
  if (!userId) throw new Error('User ID is required.');
  return collection(db, 'users', userId, 'graph_edges');
}

export async function saveGraphNode(userId: string, node: GraphNode): Promise<void> {
  if (!userId) throw new Error('User is not authenticated.');
  const docRef = doc(db, 'users', userId, 'graph_nodes', node.id);
  await setDoc(docRef, sanitizeForFirestore(node), { merge: true });
}

export async function saveGraphEdge(userId: string, edge: GraphEdge): Promise<void> {
  if (!userId) throw new Error('User is not authenticated.');
  const docRef = doc(db, 'users', userId, 'graph_edges', edge.id);
  await setDoc(docRef, sanitizeForFirestore(edge), { merge: true });
}

export async function deleteGraphNode(userId: string, nodeId: string): Promise<void> {
  if (!userId) throw new Error('User is not authenticated.');
  const docRef = doc(db, 'users', userId, 'graph_nodes', nodeId);
  await deleteDoc(docRef);
}

// Subscribes to both graph collections and merges updates into one callback,
// mirroring subscribeToUserMemories/subscribeToUserInteractions.
export function subscribeToUserGraph(
  userId: string,
  onUpdate: (nodes: GraphNode[], edges: GraphEdge[]) => void,
  onError: (error: Error) => void
) {
  if (!userId) {
    onUpdate([], []);
    return () => {};
  }

  let latestNodes: GraphNode[] = [];
  let latestEdges: GraphEdge[] = [];

  const unsubNodes = onSnapshot(
    query(getGraphNodesCollection(userId), orderBy('lastReferencedAt', 'desc')),
    (snapshot) => {
      latestNodes = snapshot.docs.map((docSnap) => docSnap.data() as GraphNode);
      onUpdate(latestNodes, latestEdges);
    },
    (err) => {
      console.error('Firestore graph_nodes subscription error:', err);
      onError(err);
    }
  );

  const unsubEdges = onSnapshot(
    query(getGraphEdgesCollection(userId), orderBy('createdAt', 'desc')),
    (snapshot) => {
      latestEdges = snapshot.docs.map((docSnap) => docSnap.data() as GraphEdge);
      onUpdate(latestNodes, latestEdges);
    },
    (err) => {
      console.error('Firestore graph_edges subscription error:', err);
      onError(err);
    }
  );

  return () => {
    unsubNodes();
    unsubEdges();
  };
}

