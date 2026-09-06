import React from 'react';
import { Moon, Music, Camera, Pin, Archive, Sparkles, Flame, CloudRain, Smile, Zap } from 'lucide-react';
import { chronicleAudio } from '../utils/audioFeedback';

export type ChronicleMoodPersonality = 'midnight' | 'angry' | 'heavy' | 'happy' | 'overwhelmed';

interface RoomNavigationProps {
  onOpenLittleThings: () => void;
  onOpenHappyPlace: () => void;
  onOpenMemoryDrawer: () => void;
  currentMood: ChronicleMoodPersonality;
  onSelectMood: (mood: ChronicleMoodPersonality) => void;
  isAutoMode?: boolean;
  onClearOverride?: () => void;
  onNewVentSession: () => void;
  isSessionActive: boolean;
}

export const RoomNavigation: React.FC<RoomNavigationProps> = ({
  onOpenLittleThings,
  onOpenHappyPlace,
  onOpenMemoryDrawer,
  currentMood,
  onSelectMood,
  isAutoMode = false,
  onClearOverride,
  onNewVentSession,
  isSessionActive,
}) => {
  const handleItemClick = (fn: () => void) => {
    chronicleAudio.playClick();
    fn();
  };

  const handleMoodSwitch = (mood: ChronicleMoodPersonality) => {
    chronicleAudio.playClick();
    onSelectMood(mood);
  };

  const handleClearOverride = () => {
    chronicleAudio.playClick();
    onClearOverride?.();
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 py-3 px-4 z-20 select-none">
      {/* Scattered Room Objects Navigation */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-mono">
        {/* ☾ Little Things / Nighttime */}
        <button
          onClick={() => handleItemClick(onOpenLittleThings)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12121D] border border-[#26263A] text-[#A09CB2] hover:text-[#F3F0EB] hover:border-[#FF6B4A]/60 transition-all cursor-pointer group"
          title="Comforts & midnight anchors (little things)"
        >
          <span className="text-sm group-hover:text-[#FF6B4A] transition-colors">☾</span>
          <span>little things</span>
        </button>

        {/* 📸 Polaroid / Happy Places */}
        <button
          onClick={() => handleItemClick(onOpenHappyPlace)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12121D] border border-[#26263A] text-[#A09CB2] hover:text-[#F3F0EB] hover:border-rose-400/40 transition-all cursor-pointer"
          title="Comforts & emergency happy places"
        >
          <span className="text-sm">📸</span>
          <span>happy places</span>
        </button>

        {/* 📌 Pinned Trajectory / The Vault */}
        <button
          onClick={() => handleItemClick(onOpenMemoryDrawer)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12121D] border border-[#26263A] text-[#A09CB2] hover:text-[#F3F0EB] hover:border-amber-400/40 transition-all cursor-pointer"
          title="What Chronicle remembers about you"
        >
          <span className="text-sm">📌</span>
          <span>the vault</span>
        </button>

        {/* + Fresh Vent Session (if currently in an active dialogue) */}
        {isSessionActive && (
          <button
            onClick={() => handleItemClick(onNewVentSession)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B4A]/15 border border-[#FF6B4A]/40 text-[#FF8B70] hover:bg-[#FF6B4A]/25 transition-all cursor-pointer"
            title="Start fresh vent session"
          >
            <span>+ fresh vent</span>
          </button>
        )}
      </div>

      {/* Mood Personality Selector */}
      <div className="flex items-center gap-1.5 bg-[#0D0D15] p-1.5 rounded-2xl border border-[#222234] text-[11px] font-mono">
        <span className="text-[#6E6A7D] text-[10px] uppercase tracking-wider px-2 hidden sm:inline">
          Mood:
        </span>

        {onClearOverride && (
          <button
            onClick={handleClearOverride}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
              isAutoMode
                ? 'bg-[#1E1E2E] text-[#FF6B4A] border border-[#FF6B4A]/40'
                : 'text-[#8E8A9F] hover:text-[#FF6B4A]'
            }`}
            title="Let Chronicle auto-detect your mood from recent sessions"
          >
            <span>🪄</span>
            <span className="hidden md:inline">Auto</span>
          </button>
        )}

        <button
          onClick={() => handleMoodSwitch('midnight')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            currentMood === 'midnight'
              ? 'bg-[#1E1E2E] text-[#F3F0EB] border border-white/20'
              : 'text-[#8E8A9F] hover:text-[#F3F0EB]'
          }`}
          title="2 AM Midnight room"
        >
          <span>🌙</span>
          <span className="hidden md:inline">2 AM</span>
        </button>

        <button
          onClick={() => handleMoodSwitch('angry')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            currentMood === 'angry'
              ? 'bg-[#2E1214] text-[#FF6B6B] border border-rose-500/40'
              : 'text-[#8E8A9F] hover:text-[#FF6B6B]'
          }`}
          title="Angry — yeah okay, get it out."
        >
          <span>😡</span>
          <span className="hidden md:inline">Angry</span>
        </button>

        <button
          onClick={() => handleMoodSwitch('heavy')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            currentMood === 'heavy'
              ? 'bg-[#1A1A28] text-indigo-300 border border-indigo-500/40'
              : 'text-[#8E8A9F] hover:text-indigo-300'
          }`}
          title="Heavy — I'm here. Spacious and slow."
        >
          <span>😞</span>
          <span className="hidden md:inline">Heavy</span>
        </button>

        <button
          onClick={() => handleMoodSwitch('happy')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            currentMood === 'happy'
              ? 'bg-[#232616] text-amber-300 border border-amber-500/40'
              : 'text-[#8E8A9F] hover:text-amber-300'
          }`}
          title="Happy — oh??? we're having a GOOD day???"
        >
          <span>😄</span>
          <span className="hidden md:inline">Happy</span>
        </button>

        <button
          onClick={() => handleMoodSwitch('overwhelmed')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            currentMood === 'overwhelmed'
              ? 'bg-[#121E24] text-teal-300 border border-teal-500/40'
              : 'text-[#8E8A9F] hover:text-teal-300'
          }`}
          title="Overwhelmed — clears all clutter. Just breathe."
        >
          <span>🤯</span>
          <span className="hidden md:inline">Overwhelmed</span>
        </button>
      </div>
    </div>
  );
};
