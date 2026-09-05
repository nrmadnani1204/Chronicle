import React, { useState } from 'react';
import { X, Sparkles, Plus, Trash2, Heart, Compass, Briefcase, Smile, Bookmark } from 'lucide-react';
import type { ChronicleMemory, MemoryCategory } from '../types';

interface MemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memories: ChronicleMemory[];
  onAddMemory: (memory: ChronicleMemory) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const MemoryDrawer: React.FC<MemoryDrawerProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
}) => {
  const [activeCategory, setActiveCategory] = useState<MemoryCategory | 'all'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('things_i_love');

  if (!isOpen) return null;

  const categories: { id: MemoryCategory; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'things_i_love',
      label: 'Things I Love',
      icon: <Heart className="w-3.5 h-3.5 text-rose-500" />,
      desc: 'Music, favorite places, comfort foods, hobbies, and humor',
    },
    {
      id: 'who_im_becoming',
      label: "Who I'm Becoming",
      icon: <Compass className="w-3.5 h-3.5 text-indigo-500" />,
      desc: 'Aspirations, technical goals, skills to build, who you want to be',
    },
    {
      id: 'where_i_am_now',
      label: 'Where I Am Now',
      icon: <Briefcase className="w-3.5 h-3.5 text-amber-500" />,
      desc: 'Current work, ongoing projects, challenges, and life stage',
    },
    {
      id: 'happy_place',
      label: 'Happy Places',
      icon: <Smile className="w-3.5 h-3.5 text-emerald-500" />,
      desc: 'Things that make you feel like yourself when overwhelmed',
    },
  ];

  const filteredMemories = memories.filter((m) =>
    activeCategory === 'all' ? true : m.category === activeCategory
  );

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    const memory: ChronicleMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: '',
      text: newMemoryText.trim(),
      category: newMemoryCategory,
      type: newMemoryCategory === 'who_im_becoming' ? 'trajectory' : 'semantic',
      importance: 0.9,
      createdAt: Date.now(),
    };

    await onAddMemory(memory);
    setNewMemoryText('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1A1A]/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-[#0F0F18] h-full shadow-2xl border-l border-[#26263A] flex flex-col z-10 animate-slide-left">
        {/* Header */}
        <div className="p-5 border-b border-[#232336] bg-[#141422] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#201726] border border-[#FF6B4A]/30 text-[#FF6B4A] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-base text-[#F3F0EB] font-semibold leading-tight">
                What Chronicle Remembers
              </h2>
              <p className="text-[11px] text-[#8E8A9F] font-sans font-light">
                Learned organically from your conversations
              </p>
            </div>
          </div>
          <button
            id="close-memory-drawer-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8A9F] hover:text-[#F3F0EB] hover:bg-[#1E1E2E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Tab Selector */}
        <div className="p-3 border-b border-[#232336] bg-[#12121D] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer border ${
              activeCategory === 'all'
                ? 'bg-[#FF6B4A] text-white border-[#FF6B4A]'
                : 'bg-[#181827] text-[#8E8A9F] border-[#2A2A3E] hover:text-[#F3F0EB]'
            }`}
          >
            All ({memories.length})
          </button>
          {categories.map((cat) => {
            const count = memories.filter((m) => m.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer border ${
                  activeCategory === cat.id
                    ? 'bg-[#FF6B4A] text-white border-[#FF6B4A]'
                    : 'bg-[#181827] text-[#8E8A9F] border-[#2A2A3E] hover:text-[#F3F0EB]'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
                {count > 0 && <span className="opacity-60 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Quick Add Button or Form */}
          {isAdding ? (
            <form onSubmit={handleCreateMemory} className="p-4 rounded-xl bg-[#141422] border border-[#2B2B3E] space-y-3 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#F3F0EB] block">
                Add Something for Chronicle to Remember
              </span>
              <textarea
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                placeholder="e.g., I love indie rock, or I want to master distributed systems..."
                rows={2}
                autoFocus
                className="w-full text-xs p-2.5 rounded-lg border border-[#34344E] focus:outline-none focus:border-[#FF6B4A] bg-[#0A0A10] text-[#F3F0EB] placeholder:text-[#6E6A7D]"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={newMemoryCategory}
                  onChange={(e) => setNewMemoryCategory(e.target.value as MemoryCategory)}
                  className="text-xs p-1.5 rounded border border-[#34344E] bg-[#0A0A10] text-[#F3F0EB]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-xs px-2.5 py-1 text-[#8E8A9F] hover:text-[#F3F0EB] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs px-3 py-1 bg-[#FF6B4A] text-white rounded-lg hover:bg-[#E04828] cursor-pointer font-medium"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#34344E] text-[#8E8A9F] hover:text-[#FF6B4A] hover:border-[#FF6B4A]/40 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Teach Chronicle something about yourself</span>
            </button>
          )}

          {filteredMemories.length === 0 ? (
            <div className="py-12 text-center text-[#8E8A9F] space-y-2">
              <Bookmark className="w-8 h-8 mx-auto text-[#FF6B4A]/40 stroke-1" />
              <p className="font-serif italic text-sm text-[#F3F0EB]">No memories here yet</p>
              <p className="text-xs text-[#8E8A9F] max-w-xs mx-auto">
                Chronicle automatically listens and extracts what matters to you when you vent.
              </p>
            </div>
          ) : (
            filteredMemories.map((mem, index) => {
              const cat = categories.find((c) => c.id === mem.category);
              const rotationClass = index % 3 === 0 ? '-rotate-1' : index % 3 === 1 ? 'rotate-1' : 'rotate-0';
              return (
                <div
                  key={mem.id}
                  className={`p-4 rounded-xl bg-[#141422] border border-[#2B2B40] hover:border-[#FF6B4A]/50 transition-all flex items-start justify-between gap-3 shadow-md group relative ${rotationClass} hover:rotate-0`}
                >
                  {/* Subtle tape accent on every other card */}
                  {index % 2 === 0 && (
                    <div className="absolute -top-2 left-6 w-12 h-3.5 tape-strip rounded-xs pointer-events-none" />
                  )}

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-1.5">
                      {cat?.icon}
                      <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[#FF6B4A]">
                        {cat?.label || 'General'}
                      </span>
                    </div>
                    <p className="text-base text-[#F3F0EB] font-hand leading-snug">
                      &ldquo;{mem.text}&rdquo;
                    </p>
                    <span className="text-[10px] font-mono text-[#6E6A7D] block">
                      in the vault &bull; {new Date(mem.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteMemory(mem.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#6E6A7D] hover:text-red-400 rounded transition-all cursor-pointer"
                    title="Forget this memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-[#232336] bg-[#141422] text-[11px] text-[#8E8A9F] text-center font-light">
          Chronicle uses these memories to converse with you like someone who actually knows you.
        </div>
      </div>
    </div>
  );
};
