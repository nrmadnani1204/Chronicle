import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  saveInteraction,
  deleteInteraction,
  subscribeToUserInteractions,
  saveMemory,
  deleteMemory,
  subscribeToUserMemories,
} from './firebase';
import { LandingPage } from './components/LandingPage';
import { Header } from './components/Header';
import { AtmosphereBar } from './components/AtmosphereBar';
import { JournalStudio } from './components/JournalStudio';
import { MemoryDrawer } from './components/MemoryDrawer';
import { WeeklyReceiptsModal } from './components/WeeklyReceiptsModal';
import { HappyPlaceModal } from './components/HappyPlaceModal';
import type { JournalInteraction, ChronicleMemory, MoodState } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [memories, setMemories] = useState<ChronicleMemory[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Modals & Drawers state
  const [isMemoryDrawerOpen, setIsMemoryDrawerOpen] = useState(false);
  const [isWeeklyReceiptsOpen, setIsWeeklyReceiptsOpen] = useState(false);
  const [isHappyPlaceOpen, setIsHappyPlaceOpen] = useState(false);

  // Subscribe to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to user interactions
  useEffect(() => {
    if (!currentUser) {
      setInteractions([]);
      setActiveId(null);
      return;
    }

    const unsubscribe = subscribeToUserInteractions(
      currentUser.uid,
      (data) => {
        setInteractions(data);
        if (activeId && !data.some((item) => item.id === activeId)) {
          setActiveId(null);
        }
      },
      (error) => {
        console.error('Interactions subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to user memories
  useEffect(() => {
    if (!currentUser) {
      setMemories([]);
      return;
    }

    const unsubscribe = subscribeToUserMemories(
      currentUser.uid,
      (data) => {
        setMemories(data);
      },
      (error) => {
        console.error('Memories subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Handle saving an interaction
  const handleSaveInteraction = async (interaction: JournalInteraction) => {
    if (!currentUser) throw new Error('User is not authenticated.');
    await saveInteraction(currentUser.uid, interaction);
    setActiveId(interaction.id);
  };

  // Handle deleting an interaction
  const handleDeleteInteraction = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      await deleteInteraction(currentUser.uid, id);
      if (activeId === id) {
        setActiveId(null);
      }
    } catch (err: any) {
      console.error('Failed to delete interaction:', err);
    }
  };

  // Memory handlers
  const handleSaveMemory = async (memory: ChronicleMemory) => {
    if (!currentUser) return;
    await saveMemory(currentUser.uid, {
      ...memory,
      userId: currentUser.uid,
    });
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!currentUser) return;
    await deleteMemory(currentUser.uid, memoryId);
  };

  const handleAddHappyPlace = async (text: string) => {
    if (!currentUser) return;
    const mem: ChronicleMemory = {
      id: `mem_happy_${Date.now()}`,
      userId: currentUser.uid,
      text,
      category: 'happy_place',
      type: 'semantic',
      importance: 0.9,
      createdAt: Date.now(),
    };
    await saveMemory(currentUser.uid, mem);
  };

  // Initial Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] text-[#FBF9F6] flex items-center justify-center font-serif text-2xl italic mb-4 shadow-sm animate-pulse select-none">
          C
        </div>
        <div className="flex items-center gap-2 text-[#716E68] text-xs font-light">
          <span className="w-3.5 h-3.5 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          <span className="font-serif italic">Opening Chronicle...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show Landing Page with Sign-In
  if (!currentUser) {
    return <LandingPage />;
  }

  const activeInteraction = interactions.find((i) => i.id === activeId) || null;

  // Infer latest emotional weather from most recent interaction that has mood
  const latestMoodWithWeather = interactions.find((i) => i.mood?.weather)?.mood || null;

  return (
    <div className="min-h-screen bg-[#08080E] text-[#F3F0EB] flex flex-col font-sans selection:bg-[#FF6B4A]/30">
      {/* Header */}
      <Header
        user={currentUser}
        entriesCount={interactions.length}
        memoryCount={memories.length}
        onNewVentSession={() => setActiveId(null)}
        onOpenMemoryDrawer={() => setIsMemoryDrawerOpen(true)}
        onOpenWeeklyReceipts={() => setIsWeeklyReceiptsOpen(true)}
        onOpenHappyPlace={() => setIsHappyPlaceOpen(true)}
      />

      {/* Emotive UI Atmosphere Bar */}
      <AtmosphereBar
        mood={latestMoodWithWeather}
        onOpenHappyPlace={() => setIsHappyPlaceOpen(true)}
      />

      {/* Main Studio — Conversational-first Sanctuary Layout */}
      <div className="flex-1 flex relative overflow-hidden bg-[#09090E]">
        {/* Main Conversation Studio with Vent Button at Center */}
        <JournalStudio
          interaction={activeInteraction}
          onSaveInteraction={handleSaveInteraction}
          userId={currentUser.uid}
          memories={memories}
          onSaveMemory={handleSaveMemory}
          allPastSessions={interactions}
          onOpenMemoryDrawer={() => setIsMemoryDrawerOpen(true)}
          onOpenWeeklyReceipts={() => setIsWeeklyReceiptsOpen(true)}
          onOpenHappyPlace={() => setIsHappyPlaceOpen(true)}
          onNewVentSession={() => setActiveId(null)}
        />
      </div>

      {/* Modals and Drawers */}
      <MemoryDrawer
        isOpen={isMemoryDrawerOpen}
        onClose={() => setIsMemoryDrawerOpen(false)}
        memories={memories}
        onAddMemory={handleSaveMemory}
        onDeleteMemory={handleDeleteMemory}
      />

      <WeeklyReceiptsModal
        isOpen={isWeeklyReceiptsOpen}
        onClose={() => setIsWeeklyReceiptsOpen(false)}
        interactions={interactions}
        userEmail={currentUser.email}
      />

      <HappyPlaceModal
        isOpen={isHappyPlaceOpen}
        onClose={() => setIsHappyPlaceOpen(false)}
        memories={memories}
        onAddHappyPlace={handleAddHappyPlace}
      />
    </div>
  );
}
