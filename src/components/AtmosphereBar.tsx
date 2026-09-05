import React from 'react';
import { CloudRain, Sun, Cloud, Wind, Sunrise } from 'lucide-react';
import type { MoodState } from '../types';

interface AtmosphereBarProps {
  mood?: MoodState | null;
  onOpenHappyPlace?: () => void;
}

export const AtmosphereBar: React.FC<AtmosphereBarProps> = ({
  mood,
  onOpenHappyPlace,
}) => {
  const weather = mood?.weather || 'Soft & Reflective';

  const getWeatherIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('storm') || lower.includes('heavy') || lower.includes('tension')) {
      return <CloudRain className="w-3.5 h-3.5 text-[#8C4A2F]" />;
    }
    if (lower.includes('warm') || lower.includes('sun') || lower.includes('bright')) {
      return <Sun className="w-3.5 h-3.5 text-amber-600" />;
    }
    if (lower.includes('restorative') || lower.includes('sunrise')) {
      return <Sunrise className="w-3.5 h-3.5 text-emerald-600" />;
    }
    if (lower.includes('wind') || lower.includes('quiet')) {
      return <Wind className="w-3.5 h-3.5 text-indigo-500" />;
    }
    return <Cloud className="w-3.5 h-3.5 text-[#716E68]" />;
  };

  const isStormy =
    weather.toLowerCase().includes('storm') ||
    weather.toLowerCase().includes('heavy') ||
    (mood && mood.tension > 0.6);

  return (
    <div className="w-full bg-[#FAF8F4]/80 border-b border-[#E5E1DA] px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between text-xs text-[#716E68] gap-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-medium text-[#1A1A1A]">
          {getWeatherIcon(weather)}
          <span className="font-serif italic">{weather}</span>
        </span>
        <span className="text-[#C8B6A6]">&bull;</span>
        <span className="text-[11px] font-light hidden sm:inline">
          {isStormy
            ? 'Noticed recent heavy weather. Chronicle is here to listen.'
            : 'Interface atmosphere reflecting your recent emotional weather.'}
        </span>
      </div>

      {isStormy && onOpenHappyPlace && (
        <button
          onClick={onOpenHappyPlace}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF0E6] text-[#8C4A2F] border border-[#E5E1DA] hover:bg-[#F5E6D8] transition-colors text-[11px] font-medium cursor-pointer"
        >
          <span>Need your happy place?</span>
        </button>
      )}
    </div>
  );
};
