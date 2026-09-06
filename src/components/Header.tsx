import React from 'react';
import { LogOut, Bookmark, Heart, Sparkles, User as UserIcon } from 'lucide-react';
import { logOut } from '../firebase';
import type { User } from 'firebase/auth';

interface HeaderProps {
  user: User;
  onNewVentSession: () => void;
  entriesCount: number;
  memoryCount: number;
  onOpenMemoryDrawer: () => void;
  onOpenHappyPlace: () => void;
  onOpenLittleThings?: () => void;
  onOpenGraphExplorer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onNewVentSession,
  memoryCount,
  onOpenMemoryDrawer,
  onOpenHappyPlace,
  onOpenLittleThings,
  onOpenGraphExplorer,
}) => {
  return (
    <header className="h-16 border-b border-[#232336] bg-[#0C0C14]/90 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between transition-colors">
      {/* Brand & Prominent New Vent Session Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF6B4A] to-[#C83E22] text-white flex items-center justify-center font-serif italic text-base font-bold shadow-[0_0_15px_rgba(255,107,74,0.3)] select-none">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-semibold text-[#F3F0EB] text-lg leading-tight tracking-tight">
                Chronicle
              </h1>
              <span className="hidden lg:inline-block text-[11px] text-[#8E8A9F] font-sans font-light italic">
                &mdash; You don&apos;t have to write. Just talk.
              </span>
            </div>
          </div>
        </div>

        {/* Primary Requested Action: NEW VENT SESSION 🎙️ */}
        <button
          id="header-new-vent-session-btn"
          onClick={onNewVentSession}
          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#E04828] text-white font-mono tracking-wider text-xs uppercase font-bold shadow-[0_0_20px_rgba(255,107,74,0.35)] hover:shadow-[0_0_28px_rgba(255,107,74,0.55)] hover:scale-[1.02] active:scale-[0.97] transition-all cursor-pointer border border-[#FFA58C]/40"
          title="Start a fresh venting conversation"
        >
          <span>NEW VENT SESSION 🎙️</span>
        </button>
      </div>

      {/* Companion Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* What Chronicle Remembers */}
        <button
          id="header-memory-btn"
          onClick={onOpenMemoryDrawer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161624] border border-[#2B2B3E] text-xs font-medium text-[#F3F0EB] hover:border-[#FF6B4A]/50 hover:bg-[#1E1E30] transition-all cursor-pointer"
          title="What Chronicle Remembers About You"
        >
          <Bookmark className="w-3.5 h-3.5 text-[#FF6B4A]" />
          <span className="hidden sm:inline">Memory</span>
          {memoryCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#FF6B4A]/20 text-[#FF6B4A] text-[10px] font-semibold border border-[#FF6B4A]/30">
              {memoryCount}
            </span>
          )}
        </button>

        {/* Little Things / Late Night Anchors */}
        {onOpenLittleThings && (
          <button
            id="header-little-things-btn"
            onClick={onOpenLittleThings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161624] border border-[#2B2B3E] text-xs font-medium text-[#F3F0EB] hover:border-[#FF6B4A]/50 hover:bg-[#1E1E30] transition-all cursor-pointer"
            title="☾ Little Things — micro-comforts & quiet anchors"
          >
            <span className="text-[#FF8B70]">☾</span>
            <span className="hidden sm:inline">Little Things</span>
          </button>
        )}

        {/* Knowledge Graph / Memory Galaxy */}
        {onOpenGraphExplorer && (
          <button
            id="header-graph-explorer-btn"
            onClick={onOpenGraphExplorer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161624] border border-[#2B2B3E] text-xs font-medium text-[#F3F0EB] hover:border-[#FF6B4A]/50 hover:bg-[#1E1E30] transition-all cursor-pointer"
            title="Explore your memory galaxy — the knowledge graph Chronicle is building of you"
          >
            <span>🕸️</span>
            <span className="hidden md:inline">Memory Galaxy</span>
          </button>
        )}

        {/* Happy Place / Comfort Protocol */}
        <button
          id="header-happy-place-btn"
          onClick={onOpenHappyPlace}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161624] border border-[#2B2B3E] text-xs font-medium text-[#F3F0EB] hover:border-[#FF6B4A]/50 hover:bg-[#1E1E30] transition-all cursor-pointer"
          title="Emergency Comfort Protocol / Happy Places"
        >
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Happy Place</span>
        </button>

        {/* User profile badge */}
        <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-[#161624] border border-[#2B2B3E]">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-5 h-5 rounded-full object-cover border border-[#3A3A52]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#2A2A3E] text-white flex items-center justify-center">
              <UserIcon className="w-3 h-3 text-[#FF6B4A]" />
            </div>
          )}
          <span className="text-xs font-medium text-[#D5D2E0] max-w-[90px] truncate hidden xl:inline-block">
            {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Friend'}
          </span>
        </div>

        {/* Sign Out Button */}
        <button
          id="header-signout-btn"
          onClick={() => logOut()}
          className="p-2 text-[#8E8A9F] hover:text-[#FF6B4A] hover:bg-[#1A1A2A] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#2B2B3E]"
          title="Sign out of Chronicle"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
