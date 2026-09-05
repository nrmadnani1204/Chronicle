import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { chronicleAudio } from '../utils/audioFeedback';
import type { ChronicleMoodPersonality } from './RoomNavigation';

interface VentButtonProps {
  onTranscriptComplete: (transcript: string) => void;
  isProcessing: boolean;
  onTextFallbackClick?: () => void;
  voicePlaybackEnabled: boolean;
  onToggleVoicePlayback: () => void;
  moodPersonality?: ChronicleMoodPersonality;
}

export const VentButton: React.FC<VentButtonProps> = ({
  onTranscriptComplete,
  isProcessing,
  onTextFallbackClick,
  voicePlaybackEnabled,
  onToggleVoicePlayback,
  moodPersonality = 'midnight',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptAccumulator = useRef<string>('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setPermissionError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += transcriptChunk + ' ';
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        if (currentFinal) {
          finalTranscriptAccumulator.current += currentFinal;
        }

        const fullDisplay = (finalTranscriptAccumulator.current + interimTranscript).trim();
        setLiveTranscript(fullDisplay);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setPermissionError('Microphone permission was denied. Please allow microphone access in your browser.');
        } else if (event.error !== 'no-speech') {
          setPermissionError(`Microphone notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Speech recognition init failed:', err);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleStartVenting = () => {
    chronicleAudio.playInhale();
    chronicleAudio.playClick();

    if (!speechSupported) {
      if (onTextFallbackClick) onTextFallbackClick();
      return;
    }

    setPermissionError(null);
    finalTranscriptAccumulator.current = '';
    setLiveTranscript('');

    try {
      recognitionRef.current?.start();
    } catch (e: any) {
      try {
        recognitionRef.current?.stop();
        setTimeout(() => recognitionRef.current?.start(), 150);
      } catch {}
    }
  };

  const handleStopVenting = () => {
    chronicleAudio.playClick();
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);

    const fullResult = (finalTranscriptAccumulator.current + ' ' + liveTranscript).trim();
    if (fullResult) {
      onTranscriptComplete(fullResult);
      finalTranscriptAccumulator.current = '';
      setLiveTranscript('');
    }
  };

  // Color styles according to mood personality
  const getBlobStyle = () => {
    if (isListening) {
      switch (moodPersonality) {
        case 'angry':
          return 'bg-gradient-to-br from-[#E02828] to-[#991515] shadow-[0_0_80px_rgba(224,40,40,0.7)] text-white';
        case 'heavy':
          return 'bg-gradient-to-br from-[#4A4E8C] to-[#282B54] shadow-[0_0_70px_rgba(74,78,140,0.5)] text-white';
        case 'happy':
          return 'bg-gradient-to-br from-[#D98E28] to-[#B36815] shadow-[0_0_80px_rgba(217,142,40,0.7)] text-white';
        case 'overwhelmed':
          return 'bg-gradient-to-br from-[#1E5E68] to-[#0F353C] shadow-[0_0_80px_rgba(30,94,104,0.6)] text-white';
        default:
          return 'bg-gradient-to-br from-[#FF6B4A] to-[#B8381D] shadow-[0_0_80px_rgba(255,107,74,0.7)] text-white';
      }
    }

    switch (moodPersonality) {
      case 'angry':
        return 'bg-[#1C1214] border-2 border-rose-500/50 hover:border-rose-500 text-[#F3F0EB] hover:shadow-[0_0_50px_rgba(224,40,40,0.4)]';
      case 'heavy':
        return 'bg-[#12131F] border-2 border-indigo-500/40 hover:border-indigo-400 text-[#F3F0EB] hover:shadow-[0_0_50px_rgba(74,78,140,0.4)]';
      case 'happy':
        return 'bg-[#181812] border-2 border-amber-500/40 hover:border-amber-400 text-[#F3F0EB] hover:shadow-[0_0_50px_rgba(217,142,40,0.4)]';
      case 'overwhelmed':
        return 'bg-[#0E171A] border-2 border-teal-500/40 hover:border-teal-400 text-[#F3F0EB] hover:shadow-[0_0_50px_rgba(30,94,104,0.4)]';
      default:
        return 'bg-[#141420] border-2 border-[#2F2F46] hover:border-[#FF6B4A]/70 text-[#F3F0EB] hover:shadow-[0_0_50px_rgba(255,107,74,0.35)]';
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center text-center py-4 px-4 relative select-none">
      {/* Giant Squishy Blob Container with Live Ripples */}
      <div className="relative flex items-center justify-center my-4">
        {/* Ripples when listening */}
        {isListening && (
          <>
            <div className="absolute w-72 h-72 sm:w-84 sm:h-84 rounded-full bg-[#FF6B4A]/10 animate-listening-ripple-1 pointer-events-none" />
            <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-[#FF6B4A]/15 animate-listening-ripple-2 pointer-events-none" />
          </>
        )}

        {/* Ambient breathing glow when idle */}
        {!isListening && (
          <div className="absolute w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-[#FF6B4A]/8 blur-2xl animate-pulse pointer-events-none" />
        )}

        {/* THE GIANT SQUISHY BLOB OBJECT */}
        <button
          id="main-vent-button"
          onClick={isListening ? handleStopVenting : handleStartVenting}
          disabled={isProcessing}
          className={`relative z-10 w-52 h-52 sm:w-64 sm:h-64 flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-500 active:scale-95 group ${
            isListening ? 'animate-blob-active' : 'animate-blob-morph'
          } ${getBlobStyle()}`}
          title={isListening ? 'Tap to finish venting' : 'Tap or hold to talk to Chronicle'}
        >
          {isListening ? (
            <div className="flex flex-col items-center justify-center space-y-2 p-4">
              {/* Audio visualizer bars */}
              <div className="flex items-center gap-1.5 h-7">
                <span className="w-1 bg-white rounded-full audio-bar-1" />
                <span className="w-1 bg-white rounded-full audio-bar-2" />
                <span className="w-1 bg-white rounded-full audio-bar-3" />
                <span className="w-1 bg-white rounded-full audio-bar-4" />
                <span className="w-1 bg-white rounded-full audio-bar-5" />
                <span className="w-1 bg-white rounded-full audio-bar-6" />
              </div>
              <span className="font-mono text-xs uppercase tracking-widest font-bold text-white drop-shadow-sm">
                DONE TALKING
              </span>
              <span className="font-hand text-base text-white/90">
                tap when you&apos;re done &rarr;
              </span>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center justify-center space-y-2 p-4">
              <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-xs text-[#A09CB2] tracking-wider">
                taking it in...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1 p-4">
              <span className="text-3xl sm:text-4xl block transform group-hover:scale-110 transition-transform">
                🎙️
              </span>
              <span className="font-serif tracking-[0.25em] text-2xl sm:text-3xl uppercase font-bold text-[#F3F0EB] group-hover:text-white transition-colors">
                VENT
              </span>
              <span className="font-hand text-lg text-[#A09CB2] group-hover:text-[#FF6B4A] transition-colors">
                talk freely. I&apos;m here.
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Live Voice Monospace Tape Banner */}
      {isListening && liveTranscript && (
        <div className="mt-4 w-full max-w-lg p-3.5 rounded-xl bg-[#11111B] border border-[#FF6B4A]/40 shadow-xl text-left animate-fade-in transition-all">
          <div className="flex items-center gap-2 mb-1 text-[10px] uppercase font-mono tracking-widest text-[#FF6B4A] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] animate-ping" />
            <span>voice tape recording:</span>
          </div>
          <p className="font-mono text-xs text-[#F3F0EB] leading-relaxed">
            {liveTranscript}
          </p>
        </div>
      )}

      {/* Microphone permission error */}
      {permissionError && (
        <div className="mt-3 p-3 rounded-xl bg-[#2D1418] border border-[#68242C] text-[#FF8585] text-xs max-w-md flex items-center gap-2 text-left font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#FF6B4A]" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Audio response toggle & text fallback */}
      <div className="mt-4 flex items-center justify-center gap-3 text-xs font-mono">
        <button
          onClick={onToggleVoicePlayback}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all cursor-pointer text-[11px] ${
            voicePlaybackEnabled
              ? 'bg-[#181827] border-[#FF6B4A]/30 text-[#F3F0EB]'
              : 'bg-[#101017] border-[#222232] text-[#6E6A7D]'
          }`}
          title="Toggle spoken responses"
        >
          {voicePlaybackEnabled ? (
            <>
              <Volume2 className="w-3 h-3 text-[#FF6B4A]" />
              <span>Voice replies ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3 h-3 text-[#6E6A7D]" />
              <span>Voice replies muted</span>
            </>
          )}
        </button>

        {onTextFallbackClick && (
          <button
            onClick={onTextFallbackClick}
            className="text-[11px] text-[#8E8A9F] hover:text-[#F3F0EB] font-hand text-base underline cursor-pointer py-0.5 px-2 transition-colors"
          >
            or type quietly instead
          </button>
        )}
      </div>
    </div>
  );
};
