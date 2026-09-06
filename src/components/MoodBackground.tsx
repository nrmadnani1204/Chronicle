import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { MoodState } from '../types';
import { getMoodGradient } from '../utils/moodPalette';

interface MoodBackgroundProps {
  mood: MoodState | null;
  trajectory?: MoodState[];
}

// Fixed, full-viewport atmosphere that reflects the user's emotional
// trajectory (not just the latest session) as a slowly floating, continuously
// blended gradient — never a hard cut between mood states.
export const MoodBackground: React.FC<MoodBackgroundProps> = ({ mood, trajectory = [] }) => {
  const gradient = useMemo(() => getMoodGradient(mood, trajectory), [mood, trajectory]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute inset-0"
        animate={{ background: `linear-gradient(180deg, ${gradient.core} 0%, ${gradient.coreDeep} 100%)` }}
        transition={{ duration: 6, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] rounded-full"
        style={{ backgroundColor: gradient.accent, opacity: 0.28, filter: 'blur(120px)' }}
        animate={{
          x: ['0%', '15%', '-5%', '0%'],
          y: ['0%', '10%', '-10%', '0%'],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{ duration: gradient.durationSeconds, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute bottom-0 right-0 w-[60vw] h-[60vw] rounded-full"
        style={{ backgroundColor: gradient.accent, opacity: 0.18, filter: 'blur(110px)' }}
        animate={{
          x: ['0%', '-10%', '8%', '0%'],
          y: ['0%', '-12%', '6%', '0%'],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: gradient.durationSeconds * 1.3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute top-1/3 left-1/2 w-[45vw] h-[45vw] rounded-full"
        style={{ backgroundColor: gradient.core, opacity: 0.35, filter: 'blur(100px)' }}
        animate={{
          x: ['-50%', '-40%', '-60%', '-50%'],
          y: ['0%', '8%', '-8%', '0%'],
        }}
        transition={{ duration: gradient.durationSeconds * 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};
