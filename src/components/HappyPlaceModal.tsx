import React, { useState } from 'react';
import { X, Heart, Music, Coffee, Compass, Plus, Sparkles, Wind } from 'lucide-react';
import type { ChronicleMemory } from '../types';

interface HappyPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: ChronicleMemory[];
  onAddHappyPlace: (text: string) => Promise<void>;
}

export const HappyPlaceModal: React.FC<HappyPlaceModalProps> = ({
  isOpen,
  onClose,
  memories,
  onAddHappyPlace,
}) => {
  const [newComfort, setNewComfort] = useState('');
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathText, setBreathText] = useState('Inhale...');

  if (!isOpen) return null;

  const happyMemories = memories.filter(
    (m) => m.category === 'happy_place' || m.category === 'things_i_love'
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComfort.trim()) return;
    await onAddHappyPlace(newComfort.trim());
    setNewComfort('');
  };

  const startBreathing = () => {
    setIsBreathing(true);
    let step = 0;
    const cycle = ['Inhale gently...', 'Hold...', 'Exhale slowly...', 'Rest...'];
    setBreathText(cycle[0]);

    const interval = setInterval(() => {
      step = (step + 1) % cycle.length;
      setBreathText(cycle[step]);
    }, 4000);

    setTimeout(() => {
      clearInterval(interval);
      setIsBreathing(false);
    }, 32000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1A1A]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#0F0F18] rounded-2xl shadow-2xl border border-[#26263A] overflow-hidden z-10 animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-[#232336] bg-[#141422] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#201726] border border-[#FF6B4A]/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-[#FF6B4A]" />
            </div>
            <div>
              <h2 className="font-serif text-base text-[#F3F0EB] font-semibold leading-tight">
                Reset Protocol &bull; Happy Places
              </h2>
              <p className="text-[11px] text-[#8E8A9F] font-sans font-light">
                Things you told Chronicle make you feel like yourself
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8A9F] hover:text-[#F3F0EB] hover:bg-[#1E1E2E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Quick Breathing Grounder */}
          <div className="p-4 rounded-xl bg-[#141422] border border-[#2B2B3E] text-center space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FF6B4A]">
                Quick Reset
              </span>
              <Wind className="w-3.5 h-3.5 text-[#FF6B4A]" />
            </div>
            {isBreathing ? (
              <div className="py-4 space-y-2">
                <div className="w-16 h-16 rounded-full bg-[#2A141A] border border-[#FF6B4A]/50 flex items-center justify-center mx-auto animate-pulse">
                  <Heart className="w-6 h-6 text-[#FF6B4A]" />
                </div>
                <p className="font-serif text-lg italic text-[#F3F0EB]">{breathText}</p>
                <p className="text-[11px] text-[#8E8A9F]">Let your shoulders drop.</p>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-[#8E8A9F] text-left font-light">
                  Take 30 seconds of quiet breathing to let your nervous system catch up.
                </p>
                <button
                  onClick={startBreathing}
                  className="px-3 py-1.5 rounded-lg bg-[#FF6B4A] text-white text-xs font-medium hover:bg-[#E04828] shrink-0 ml-3 cursor-pointer"
                >
                  Start breath
                </button>
              </div>
            )}
          </div>

          {/* List of Remembered Comforts */}
          <div className="space-y-2.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8E8A9F] block">
              Your Comfort Kit (From past vents)
            </span>

            {happyMemories.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#141422] border border-dashed border-[#2B2B3E] text-center text-xs text-[#8E8A9F] space-y-1">
                <p className="font-serif italic text-sm text-[#F3F0EB]">No comforts cataloged yet</p>
                <p className="text-[11px] text-[#8E8A9F]">
                  As you vent about favorite songs, comfort foods, or walks, Chronicle remembers them here.
                </p>
              </div>
            ) : (
              happyMemories.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-[#141422] border border-[#2B2B3E] flex items-start gap-2.5 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF6B4A] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#EDEDF5] font-sans font-light leading-relaxed">
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add custom comfort */}
          <form onSubmit={handleAdd} className="pt-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newComfort}
                onChange={(e) => setNewComfort(e.target.value)}
                placeholder="Add a favorite comfort song, food, or activity..."
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#2B2B3E] bg-[#0A0A10] text-[#F3F0EB] placeholder:text-[#6E6A7D] focus:outline-none focus:border-[#FF6B4A]"
              />
              <button
                type="submit"
                disabled={!newComfort.trim()}
                className="px-3.5 py-2 bg-[#FF6B4A] text-white text-xs rounded-xl hover:bg-[#E04828] disabled:opacity-40 cursor-pointer font-medium"
              >
                Add
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#232336] bg-[#141422] text-center">
          <p className="text-[11px] text-[#8E8A9F] font-light">
            &ldquo;Sometimes you don&apos;t need advice. You just need somewhere to talk.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
};
