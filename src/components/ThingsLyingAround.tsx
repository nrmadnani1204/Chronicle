import React, { useState, useEffect } from 'react';
import { Play, Pause, Pin, Sparkles, Music, Heart, Plus, Check, Volume2, VolumeX, Disc } from 'lucide-react';
import type { ChronicleMemory } from '../types';
import { chronicleAudio } from '../utils/audioFeedback';
import { sparksRainPlayer } from '../utils/sparksRainPlayer';

interface ThingsLyingAroundProps {
  memories: ChronicleMemory[];
  onOpenHappyPlace: () => void;
  onOpenMemoryDrawer: () => void;
  onOpenLittleThings?: () => void;
  moodPersonality: 'angry' | 'heavy' | 'happy' | 'overwhelmed' | 'midnight';
}

export const ThingsLyingAround: React.FC<ThingsLyingAroundProps> = ({
  memories,
  onOpenHappyPlace,
  onOpenMemoryDrawer,
  onOpenLittleThings,
  moodPersonality,
}) => {
  const [isPlayingTape, setIsPlayingTape] = useState(false);
  const [volume, setVolume] = useState(65);
  const [activeNoteIdx, setActiveNoteIdx] = useState(0);

  // Sync state with player if needed
  useEffect(() => {
    return () => {
      sparksRainPlayer.stop();
    };
  }, []);

  // Chronicle's sticky notes that rotate or cycle — generic by default, but
  // once the user has told Chronicle enough (a handful of memories on
  // record), a few notes get replaced with things pulled from their own
  // memories so it feels increasingly specific to them rather than canned.
  const genericStickyNotes = [
    { text: 'remember that thing you said you wanted to do? 👀', sub: 'Tuesday, 11:43 PM' },
    { text: 'hydrate.', sub: 'just saying.' },
    { text: "you've said 'I'll do it tomorrow' 4 times.", sub: 'unbiased witness 🫡' },
    { text: 'I found your villain origin story.', sub: 'tap to revisit' },
    { text: 'stop doomscrolling. talk to me or go to sleep.', sub: 'your 2 AM friend' },
  ];

  const buildPersonalNoteText = (m: ChronicleMemory): string => {
    switch (m.category) {
      case 'who_im_becoming':
        return `remember, you said: "${m.text}" 👀`;
      case 'things_i_love':
        return `you told me you love this: "${m.text}"`;
      case 'happy_place':
        return `your happy place: "${m.text}"`;
      case 'little_things':
        return `little thing you're holding onto: "${m.text}"`;
      default:
        return `you mentioned: "${m.text}"`;
    }
  };

  const MEMORY_THRESHOLD = 3;
  const personalizedNotes =
    memories.length >= MEMORY_THRESHOLD
      ? [...memories]
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 4)
          .map((m) => ({ text: buildPersonalNoteText(m), sub: 'from what you told me' }))
      : [];

  const chronicleStickyNotes =
    personalizedNotes.length > 0 ? [...personalizedNotes, ...genericStickyNotes.slice(0, 2)] : genericStickyNotes;

  const toggleCassette = () => {
    chronicleAudio.playClick();
    const nextState = !isPlayingTape;
    setIsPlayingTape(nextState);
    if (nextState) {
      sparksRainPlayer.setVolume(volume / 100);
      sparksRainPlayer.start();
    } else {
      sparksRainPlayer.stop();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    sparksRainPlayer.setVolume(val / 100);
  };

  const handleNextSticky = () => {
    chronicleAudio.playClick();
    setActiveNoteIdx((prev) => (prev + 1) % chronicleStickyNotes.length);
  };

  // Find user trajectory / goal memories if available
  const trajectoryMemory = memories.find((m) => m.type === 'trajectory' || m.category === 'who_im_becoming');
  const happyMemory = memories.find((m) => m.category === 'happy_place' || m.category === 'things_i_love');

  // In Overwhelmed mood, strip away the busier clutter but keep the one
  // small, comforting note — it's grounding, not stimulating.
  if (moodPersonality === 'overwhelmed') {
    const note = chronicleStickyNotes[activeNoteIdx % chronicleStickyNotes.length];
    return (
      <div id="things-lying-around" className="w-full max-w-sm mx-auto mt-6 px-4 pb-16 select-none">
        <div className="relative group rotate-1 hover:rotate-0 transition-transform duration-300">
          <div
            onClick={handleNextSticky}
            className="bg-[#FFE57F] text-[#1E1E1E] p-4 rounded-xs shadow-md cursor-pointer hover:shadow-xl transition-all relative"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6A6040] mb-2 uppercase tracking-wider">
              <span>Chronicle note</span>
              <span className="font-hand text-xs font-bold">tap to flip &rarr;</span>
            </div>
            <p className="font-hand text-2xl font-bold text-[#1F1C12] leading-tight mb-2">
              &ldquo;{note.text}&rdquo;
            </p>
            <p className="text-[10px] font-mono text-[#574F34] text-right">&mdash; {note.sub}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="things-lying-around" className="w-full max-w-4xl mx-auto mt-6 px-4 pb-16 select-none">
      {/* Section Divider: handwritten and messy */}
      <div className="flex items-center justify-center gap-3 mb-8 opacity-60">
        <span className="h-px w-12 bg-white/20" />
        <span className="font-hand text-lg text-[#A09CB2] tracking-wide -rotate-1">
          &mdash; things lying around &mdash;
        </span>
        <span className="h-px w-12 bg-white/20" />
      </div>

      {/* Scattered artifacts grid with human "imperfections" & crooked angles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-start">
        {/* Artifact 1: 🎧 Cassette Tape / Comfort Song */}
        <div className="relative group -rotate-2 hover:rotate-0 transition-transform duration-300">
          {/* Tape strip on top */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 tape-strip rounded-xs z-10" />

          <div className="bg-[#12121D] border border-[#2B2B3E] p-4 rounded-xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#8E8A9F] mb-2 font-mono">
              <span className="flex items-center gap-1.5 text-[11px] text-[#FF6B4A]">
                <span>🎧</span> your 11:47pm song
              </span>
              <span className="text-[10px]">SIDE A</span>
            </div>

            <p className="font-serif italic text-base text-[#F3F0EB] mb-0.5">
              &ldquo;Sparks in the rain&rdquo;
            </p>
            <p className="text-[11px] text-[#8E8A9F] font-hand text-base leading-tight mb-2.5">
              the one that keeps your brain from melting
            </p>

            {/* Vintage Cassette Tape Window & Spools */}
            <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-[#0A0A12] border border-[#232336] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Disc
                  className={`w-4 h-4 text-[#8E8A9F] ${isPlayingTape ? 'animate-spin text-[#FF6B4A]' : ''}`}
                  style={{ animationDuration: '3s' }}
                />
                <span className="h-1 w-10 bg-white/10 rounded-full overflow-hidden flex items-center">
                  <span
                    className={`h-full bg-[#FF6B4A] transition-all duration-300 ${
                      isPlayingTape ? 'w-full animate-pulse' : 'w-1/3'
                    }`}
                  />
                </span>
                <Disc
                  className={`w-4 h-4 text-[#8E8A9F] ${isPlayingTape ? 'animate-spin text-[#FF6B4A]' : ''}`}
                  style={{ animationDuration: '3s' }}
                />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#A8A4B8]">
                {isPlayingTape ? 'analog tape' : 'idle'}
              </span>
            </div>

            <div className="space-y-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleCassette}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1D1D2C] hover:bg-[#28283E] text-xs font-mono text-[#F3F0EB] transition-colors cursor-pointer"
                >
                  {isPlayingTape ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-[#FF6B4A]" />
                      <span>pause tape</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#FF6B4A]" />
                      <span>play tape</span>
                    </>
                  )}
                </button>

                {isPlayingTape && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-[#FF6B4A]">playing</span>
                    <div className="flex items-center gap-0.5 h-3">
                      <span className="w-0.5 bg-[#FF6B4A] audio-bar-1" />
                      <span className="w-0.5 bg-[#FF6B4A] audio-bar-2" />
                      <span className="w-0.5 bg-[#FF6B4A] audio-bar-3" />
                    </div>
                  </div>
                )}
              </div>

              {/* Volume Slider when active */}
              {isPlayingTape && (
                <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-[#8E8A9F]">
                  <Volume2 className="w-3 h-3 text-[#FF6B4A] shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full accent-[#FF6B4A] h-1 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <span className="w-6 text-right">{volume}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Artifact 2: 📌 Pinned Handwritten Aspiration / Memory */}
        <div className="relative group rotate-2 hover:rotate-0 transition-transform duration-300">
          {/* Thumb tack */}
          <div className="absolute -top-2.5 left-6 w-5 h-5 rounded-full bg-[#E04828] border border-white/30 shadow-md z-10 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
          </div>

          <div
            onClick={onOpenMemoryDrawer}
            className="bg-[#14141E] border border-[#2E2E42] p-4 rounded-xl shadow-lg cursor-pointer hover:border-[#FF6B4A]/50 transition-colors"
          >
            <div className="text-[10px] font-mono uppercase text-[#8E8A9F] mb-1.5 flex items-center justify-between">
              <span>📌 Trajectory</span>
              <span className="text-amber-400/80 font-hand text-xs">you said this</span>
            </div>

            <p className="font-hand text-xl text-[#F3F0EB] leading-snug mb-2">
              &ldquo;{trajectoryMemory ? trajectoryMemory.text : 'I actually want to understand this shit and build something real.'}&rdquo;
            </p>

            <div className="flex items-center justify-between text-[11px] text-[#8E8A9F] font-mono pt-1">
              <span>&mdash; in the vault</span>
              <span className="text-[10px] underline hover:text-[#FF6B4A]">open archive &rarr;</span>
            </div>
          </div>
        </div>

        {/* Artifact 3: 📸 Polaroid of Happy Place / Comfort Routine */}
        <div className="relative group -rotate-1 hover:rotate-0 transition-transform duration-300">
          {/* Tape strip on angle */}
          <div className="absolute -top-2 right-4 w-12 h-4 tape-strip rotate-12 rounded-xs z-10" />

          <div
            onClick={onOpenHappyPlace}
            className="bg-[#F3EFE6] text-[#1A1A1A] p-3 pb-4 rounded-sm shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
          >
            {/* Polaroid frame */}
            <div className="w-full h-24 bg-[#232332] rounded-xs flex items-center justify-center relative overflow-hidden mb-2">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#1B1424] to-[#3B2236] opacity-90" />
              <div className="relative text-center p-2 z-10">
                <span className="text-2xl block mb-0.5">☕</span>
                <span className="text-[11px] font-mono text-[#E4DFD7] tracking-wider uppercase">
                  Marine Drive &bull; 2 AM
                </span>
              </div>
            </div>
            <p className="font-hand text-lg text-[#262422] leading-tight text-center">
              {happyMemory ? happyMemory.text : 'quiet walk, cold wind, headphones on'}
            </p>
          </div>
        </div>

        {/* Artifact 4: 🟡 Chronicle's Crooked Sticky Note */}
        <div className="relative group rotate-3 hover:rotate-0 transition-transform duration-300">
          <div
            onClick={handleNextSticky}
            className="bg-[#FFE57F] text-[#1E1E1E] p-4 rounded-xs shadow-md cursor-pointer hover:shadow-xl transition-all relative"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6A6040] mb-2 uppercase tracking-wider">
              <span>Chronicle note</span>
              <span className="font-hand text-xs font-bold">tap to flip &rarr;</span>
            </div>
            <p className="font-hand text-2xl font-bold text-[#1F1C12] leading-tight mb-2">
              &ldquo;{chronicleStickyNotes[activeNoteIdx % chronicleStickyNotes.length].text}&rdquo;
            </p>
            <p className="text-[10px] font-mono text-[#574F34] text-right">
              &mdash; {chronicleStickyNotes[activeNoteIdx % chronicleStickyNotes.length].sub}
            </p>
          </div>
        </div>

        {/* Artifact 5: 🥊 "You usually feel better after this" */}
        <div className="relative group -rotate-2 hover:rotate-0 transition-transform duration-300">
          <div className="absolute -top-3 left-1/3 w-14 h-4 tape-strip -rotate-6 rounded-xs z-10" />
          <div className="bg-[#12121B] border border-[#2B2B3C] p-4 rounded-xl shadow-lg">
            <div className="text-[11px] font-mono text-[#FF6B4A] mb-1 flex items-center gap-1.5">
              <span>🥊</span> evidence
            </div>
            <p className="font-serif italic text-base text-[#F3F0EB] mb-1.5">
              &ldquo;30 min walk with zero podcasts.&rdquo;
            </p>
            <p className="font-hand text-lg text-[#A09CB2] leading-tight">
              you usually feel 60% less homicidal after this.
            </p>
          </div>
        </div>

        {/* Artifact 6: 💀 Weekly Meme Evidence — now a Sunday email, not a tap-through */}
        <div className="relative group rotate-1 hover:rotate-0 transition-transform duration-300">
          <div className="bg-[#1A1A28] border border-[#3E3E58] p-4 rounded-xl shadow-lg">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#A09CB2] mb-1.5 uppercase">
              <span>chronicle.exe</span>
              <span className="text-rose-400 font-bold">SUNDAY DROP</span>
            </div>
            <p className="font-hand text-lg text-[#FF9E80] leading-snug mb-2">
              &ldquo;bro really thought Thursday was going to be normal&rdquo;
            </p>
            <p className="text-xs text-[#8E8A9F] font-sans">
              Your weekly recap now arrives by email every Sunday — no need to come looking for it.
            </p>
          </div>
        </div>

        {/* Artifact 7: ☾ Jar of Little Things */}
        {onOpenLittleThings && (
          <div className="relative group -rotate-1 hover:rotate-0 transition-transform duration-300">
            {/* Candle wax or moon badge */}
            <div className="absolute -top-2.5 right-6 w-5 h-5 rounded-full bg-[#2A1E38] border border-[#FF6B4A]/50 shadow-md z-10 flex items-center justify-center text-[10px] text-[#FF8B70]">
              ☾
            </div>

            <div
              onClick={onOpenLittleThings}
              className="bg-[#11111E] border border-[#282840] p-4 rounded-xl shadow-lg cursor-pointer hover:border-[#FF6B4A]/60 transition-colors"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8E8A9F] mb-1.5 uppercase">
                <span className="text-[#FF8B70]">☾ Little Things</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#FF6B4A]/10 text-[#FF6B4A]">
                  open jar &rarr;
                </span>
              </div>
              <p className="font-serif italic text-base text-[#F3F0EB] mb-1">
                &ldquo;Cold side of the pillow at 2:14 AM.&rdquo;
              </p>
              <p className="text-xs text-[#8E8A9F] font-sans">
                Tiny midnight comforts &amp; micro-wins keeping you grounded.
              </p>
              <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] font-mono text-[#FF8B70] flex items-center justify-between">
                <span>draw a folded note</span>
                <span>☾ &rarr;</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
