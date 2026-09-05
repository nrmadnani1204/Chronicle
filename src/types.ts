export type ReflectionMode = 'reflect' | 'summarize' | 'brainstorm' | 'chat';

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  userPrompt: string;
  geminiResponse: string;
  turnCount: number;
  messages: JournalMessage[];
  createdAt: number;
  updatedAt: number;
  modelUsed?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
