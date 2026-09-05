import React from 'react';
import { LogOut, ShieldCheck, Menu, BookMarked, User as UserIcon } from 'lucide-react';
import { logOut } from '../firebase';
import type { User } from 'firebase/auth';

interface HeaderProps {
  user: User;
  onToggleSidebar?: () => void;
  entriesCount: number;
}

export const Header: React.FC<HeaderProps> = ({ user, onToggleSidebar, entriesCount }) => {
  return (
    <header className="h-16 border-b border-[#E5E1DA] bg-[#FBF9F6]/95 backdrop-blur-sm sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            id="mobile-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-[#1A1A1A] hover:text-black rounded-lg hover:bg-[#FAF8F4] border border-[#E5E1DA] transition-colors"
            title="Toggle Journal History"
            aria-label="Toggle Journal History"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-[#FBF9F6] flex items-center justify-center font-serif italic text-base font-bold shadow-xs">
            R
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif font-normal text-[#1A1A1A] text-lg leading-tight tracking-tight">
                Reflections Journal
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E5E1DA] text-[10px] font-semibold uppercase tracking-[0.15em] text-[#1A1A1A]">
                <ShieldCheck className="w-3 h-3 text-[#1A1A1A]" />
                Firestore Isolated
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#C8B6A6] font-semibold hidden md:block">
              {entriesCount} {entriesCount === 1 ? 'reflection' : 'reflections'} &bull; Gemini 3.6 Flash
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* User profile indicator */}
        <div className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white border border-[#E5E1DA] shadow-2xs">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-6 h-6 rounded-full object-cover border border-[#E5E1DA]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#C8B6A6] text-white flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="text-xs font-medium text-[#1A1A1A] max-w-[120px] truncate hidden sm:inline-block">
            {user.displayName || user.email || 'Author'}
          </span>
        </div>

        {/* Sign Out Button */}
        <button
          id="header-signout-btn"
          onClick={() => logOut()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg text-[#1A1A1A] hover:bg-white active:scale-95 transition-all border border-[#E5E1DA] bg-transparent cursor-pointer"
          title="Sign out of Reflections Journal"
        >
          <LogOut className="w-3 h-3 opacity-60" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
};
