/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, saveInteraction, deleteInteraction, subscribeToUserInteractions } from './firebase';
import { LandingPage } from './components/LandingPage';
import { Header } from './components/Header';
import { SidebarHistory } from './components/SidebarHistory';
import { JournalStudio } from './components/JournalStudio';
import type { JournalInteraction } from './types';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Subscribe to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to User-Isolated Firestore Interactions collection
  useEffect(() => {
    if (!currentUser) {
      setInteractions([]);
      setActiveId(null);
      return;
    }

    setFirestoreError(null);
    const unsubscribe = subscribeToUserInteractions(
      currentUser.uid,
      (data) => {
        setInteractions(data);
        // If there's an activeId that no longer exists, reset or select first
        if (activeId && !data.some((item) => item.id === activeId)) {
          setActiveId(null);
        }
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setFirestoreError(
          'Failed to synchronize Firestore data. Please verify network or security permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Handle saving an interaction (persists to Firestore with strict undefined stripping)
  const handleSaveInteraction = async (interaction: JournalInteraction) => {
    if (!currentUser) throw new Error('User is not authenticated.');
    await saveInteraction(currentUser.uid, interaction);
    setActiveId(interaction.id);
  };

  // Handle deleting an interaction
  const handleDeleteInteraction = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const confirmDelete = window.confirm('Are you sure you want to delete this reflection?');
    if (!confirmDelete) return;

    try {
      await deleteInteraction(currentUser.uid, id);
      if (activeId === id) {
        setActiveId(null);
      }
    } catch (err: any) {
      console.error('Failed to delete interaction:', err);
      alert(`Could not delete reflection: ${err?.message || 'Permission denied'}`);
    }
  };

  // Create / Start New Reflection Session
  const handleNewInteraction = () => {
    setActiveId(null);
    setMobileSidebarOpen(false);
  };

  // Select an existing interaction
  const handleSelectInteraction = (interaction: JournalInteraction) => {
    setActiveId(interaction.id);
    setMobileSidebarOpen(false);
  };

  // Initial Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] text-[#FBF9F6] flex items-center justify-center font-serif text-2xl italic mb-4 shadow-sm animate-pulse">
          R
        </div>
        <div className="flex items-center gap-2 text-[#716E68] text-xs font-medium tracking-wide">
          <span className="w-3.5 h-3.5 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          <span className="uppercase tracking-[0.15em] text-[10px]">Verifying credentials...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show Landing Page with Sign-In
  if (!currentUser) {
    return <LandingPage />;
  }

  const activeInteraction = interactions.find((i) => i.id === activeId) || null;

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-[#1A1A1A] flex flex-col">
      {/* Header */}
      <Header
        user={currentUser}
        entriesCount={interactions.length}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      {/* Firestore Error Alert */}
      {firestoreError && (
        <div className="bg-[#FAF0E6] border-b border-[#E5E1DA] px-6 py-2.5 text-xs text-[#8C4A2F] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#8C4A2F] shrink-0" />
            <span>{firestoreError}</span>
          </div>
          <button
            onClick={() => setFirestoreError(null)}
            className="text-[#8C4A2F] hover:text-[#5C3220] font-medium ml-4 underline text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio & History Layout */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <SidebarHistory
            interactions={interactions}
            activeId={activeId}
            onSelect={handleSelectInteraction}
            onNew={handleNewInteraction}
            onDelete={handleDeleteInteraction}
            userId={currentUser.uid}
          />
        </div>

        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-[#1A1A1A]/40 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative w-4/5 max-w-xs bg-[#FAF8F4] h-full z-50 shadow-2xl border-r border-[#E5E1DA]">
              <SidebarHistory
                interactions={interactions}
                activeId={activeId}
                onSelect={handleSelectInteraction}
                onNew={handleNewInteraction}
                onDelete={handleDeleteInteraction}
                userId={currentUser.uid}
              />
            </div>
          </div>
        )}

        {/* Studio Center Workspace */}
        <JournalStudio
          interaction={activeInteraction}
          onSaveInteraction={handleSaveInteraction}
          userId={currentUser.uid}
        />
      </div>
    </div>
  );
}
