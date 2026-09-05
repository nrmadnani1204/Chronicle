import React, { useState } from 'react';
import { X, Moon, Sparkles, Plus, Trash2, Heart, Music, Shuffle, Compass } from 'lucide-react';
import type { ChronicleMemory } from '../types';
import { chronicleAudio } from '../utils/audioFeedback';
import { sparksRainPlayer } from '../utils/sparksRainPlayer';

interface LittleThingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: ChronicleMemory[];
  onAddLittleThing: (text: string) => Promise<void>;
  onDeleteLittleThing?: (id: string) => Promise<void>;
  onScrollToArtifacts?: () => void;
}

const DEFAULT_LITTLE_THINGS = [
  'Cold side of the pillow at 2:14 AM',
  'Finding that one song on repeat until it untangles your thoughts',
  'Stepping outside into crisp midnight air when your brain is screaming',
  'The silence of the house when the entire world is finally asleep',
  'When a dog looks back at you twice on a walk just to say hi',
  'The smell of fresh rain hitting warm concrete after a long week',
  'A warm cup of water when your throat feels parched and heavy',
  'Putting on an oversized sweatshirt that feels like a clean slate',
  'Closing 47 open browser tabs and hearing your fan wind down',
  'A random text that says "thought of you when I saw this"',
];

export const LittleThingsModal: React.FC<LittleThingsModalProps> = ({
  isOpen,
  onClose,
  memories,
  onAddLittleThing,
  onDeleteLittleThing,
  onScrollToArtifacts,
}) => {
  const [newText, setNewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState(sparksRainPlayer.getPlaying());
  const [drawnNote, setDrawnNote] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter user-saved little things
  const userLittleThings = memories.filter((m) => m.category === 'little_things');
  const allLittleThings = [
    ...userLittleThings.map((m) => m.text),
    ...DEFAULT_LITTLE_THINGS,
  ];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newText.trim();
    if (!clean || isSubmitting) return;

    setIsSubmitting(true);
    chronicleAudio.playClick();
    try {
      await onAddLittleThing(clean);
      setNewText('');
      chronicleAudio.playIntimateChime();
    } catch (err) {
      console.error('Failed to add little thing:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrawRandom = () => {
    chronicleAudio.playClick();
    const pool = allLittleThings.length > 0 ? allLittleThings : DEFAULT_LITTLE_THINGS;
    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    setDrawnNote(chosen);
    chronicleAudio.playIntimateChime();
  };

  const toggleRainAudio = () => {
    chronicleAudio.playClick();
    const nextState = !isPlayingMusic;
    setIsPlayingMusic(nextState);
    if (nextState) {
      sparksRainPlayer.start();
    } else {
      sparksRainPlayer.stop();
    }
  };

  const handleGoToArtifacts = () => {
    onClose();
    if (onScrollToArtifacts) {
      onScrollToArtifacts();
    } else {
      const el = document.getElementById('things-lying-around');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#06060A]/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-[#0F0F1A] rounded-2xl shadow-2xl border border-[#2B2B42] overflow-hidden z-10 animate-scale-in text-[#F3F0EB]">
        {/* Header */}
        <div className="p-5 border-b border-[#232336] bg-[#141424] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#261E34] border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF8B70]">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base text-[#F3F0EB] font-semibold leading-tight">
                  ☾ Little Things
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FF6B4A]/15 text-[#FF6B4A] border border-[#FF6B4A]/30">
                  Late-Night Anchors
                </span>
              </div>
              <p className="text-[11px] text-[#9A96AA] font-sans font-light mt-0.5">
                Micro-comforts and quiet moments keeping your nervous system grounded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8A9F] hover:text-[#F3F0EB] hover:bg-[#1E1E30] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Quick Ambient Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#131322] border border-[#26263B] text-xs">
            <div className="flex items-center gap-2.5">
              <Music className={`w-4 h-4 ${isPlayingMusic ? 'text-[#FF6B4A] animate-pulse' : 'text-[#8E8A9F]'}`} />
              <div>
                <p className="font-mono text-[11px] text-[#F3F0EB]">
                  &ldquo;Sparks in the rain&rdquo; ambient tape
                </p>
                <p className="text-[10px] text-[#8E8A9F]">Rhodes chords, midnight rain, bell chimes</p>
              </div>
            </div>
            <button
              onClick={toggleRainAudio}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                isPlayingMusic
                  ? 'bg-[#FF6B4A] text-white border-[#FF8B70]'
                  : 'bg-[#1E1E30] text-[#A09CB2] hover:text-[#F3F0EB] border-[#31314B]'
              }`}
            >
              {isPlayingMusic ? 'pause music' : 'play music'}
            </button>
          </div>

          {/* Draw a Little Thing (Random Picker) */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#18182B] to-[#121220] border border-[#2B2B45] text-center relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF8B70] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Random Comfort
              </span>
              <button
                onClick={handleDrawRandom}
                className="inline-flex items-center gap-1 text-xs font-mono text-[#F3F0EB] bg-[#24243A] hover:bg-[#2F2F4C] px-2.5 py-1 rounded-lg border border-[#3E3E5E] transition-all cursor-pointer"
              >
                <Shuffle className="w-3 h-3 text-[#FF6B4A]" />
                <span>draw a folded note</span>
              </button>
            </div>

            {drawnNote ? (
              <div className="py-3 px-4 rounded-xl bg-[#0B0B14] border border-[#FF6B4A]/30 mt-2 text-center animate-fade-in">
                <p className="font-serif italic text-base text-[#F3F0EB] leading-relaxed">
                  &ldquo;{drawnNote}&rdquo;
                </p>
                <p className="text-[10px] font-mono text-[#8E8A9F] mt-2">
                  Take a slow breath. You are safe here.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#9A96AA] font-sans italic py-2">
                Tap &ldquo;draw a folded note&rdquo; for a gentle reminder of something good.
              </p>
            )}
          </div>

          {/* Input: Add your own little thing */}
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="block text-[11px] font-mono text-[#9A96AA] uppercase tracking-wider">
              Add a little thing to your night collection:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="e.g. that quiet piano melody, freshly washed hoodie..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#131322] border border-[#2B2B3E] text-xs text-[#F3F0EB] placeholder-[#6E6A7D] focus:outline-hidden focus:border-[#FF6B4A]"
              />
              <button
                type="submit"
                disabled={!newText.trim() || isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#FF5530] disabled:opacity-40 text-white font-mono text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </form>

          {/* List of Saved & Default Little Things */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8E8A9F] pb-1 border-b border-white/5">
              <span>Your Saved & Midnight Little Things ({allLittleThings.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* User saved ones first */}
              {userLittleThings.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#151526] border border-[#FF6B4A]/25 hover:border-[#FF6B4A]/50 transition-all flex items-start justify-between gap-2 group"
                >
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#FF8B70] px-1.5 py-0.5 rounded-sm bg-[#FF6B4A]/10">
                      Yours
                    </span>
                    <p className="text-xs text-[#F3F0EB] font-sans leading-snug">{item.text}</p>
                  </div>
                  {onDeleteLittleThing && (
                    <button
                      onClick={() => onDeleteLittleThing(item.id)}
                      className="text-[#6E6A7D] hover:text-red-400 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Default grounded micro-moments */}
              {DEFAULT_LITTLE_THINGS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#11111E] border border-[#222235] hover:border-[#33334F] transition-all"
                >
                  <p className="text-xs text-[#D8D4E2] font-sans leading-snug">
                    <span className="text-[#FF6B4A] mr-1.5 opacity-80">&bull;</span>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Shortcut to Bedroom Artifacts */}
          <div className="pt-2 text-center">
            <button
              onClick={handleGoToArtifacts}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8E8A9F] hover:text-[#FF6B4A] transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore bedroom desk &amp; artifacts (&ldquo;Sparks in the rain&rdquo; cassette) &darr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
