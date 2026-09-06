export type ConversationMode = 'listen' | 'process' | 'advise' | 'celebrate' | 'quiet';

export type MemoryCategory =
  | 'things_i_love'
  | 'who_im_becoming'
  | 'where_i_am_now'
  | 'happy_place'
  | 'little_things'
  | 'routine'
  | 'general';

export interface ChronicleMemory {
  id: string;
  userId: string;
  text: string;
  category: MemoryCategory;
  type: 'episodic' | 'semantic' | 'trajectory';
  importance: number;
  createdAt: number;
  sourceSessionId?: string;
}

export interface MoodState {
  valence: number; // -1 to +1
  energy: number;  // 0 to 1
  tension: number; // 0 to 1
  weather: string; // e.g. "Soft & Reflective", "Passing Storm", "Restorative Warmth"
}

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  inputType?: 'voice' | 'text';
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  mode: ConversationMode;
  userPrompt: string;
  geminiResponse: string;
  turnCount: number;
  messages: JournalMessage[];
  createdAt: number;
  updatedAt: number;
  modelUsed?: string;
  mood?: MoodState;
  extractedMemoriesCount?: number;
}

export interface WeeklyReceipt {
  id: string;
  userId: string;
  title: string;
  subject: string;
  arcSummary: string;
  narrativeLines: { day: string; event: string }[];
  verdict: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  preferredTone?: 'friend' | 'roast' | 'gentle';
  happyPlaces?: string[];
}

// --- Knowledge Graph ---

export type GraphNodeType =
  | 'session'
  | 'memory'
  | 'like'
  | 'dislike'
  | 'aspiration'
  | 'person'
  | 'activity'
  | 'mood_moment';

export interface GraphNode {
  id: string;
  userId: string;
  type: GraphNodeType;
  label: string;
  description?: string;
  importance: number;
  mood?: MoodState;
  sourceSessionId?: string;
  sourceMemoryId?: string;
  createdAt: number;
  lastReferencedAt: number;
  referenceCount: number;
}

export type GraphEdgeRelation =
  | 'mentions'
  | 'relates_to'
  | 'causes'
  | 'contradicts'
  | 'progresses_toward'
  | 'about_person'
  | 'evokes_mood'
  | 'similar_to';

export interface GraphEdge {
  id: string;
  userId: string;
  source: string;
  target: string;
  relation: GraphEdgeRelation;
  weight: number;
  createdAt: number;
}

