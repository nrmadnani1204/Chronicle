import React, { useState } from 'react';
import { ArrowRight, Heart, Sparkles, LogIn } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface LandingPageProps {
  onAuthSuccess?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in window was closed. Try again whenever you are ready.');
      } else {
        setAuthError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080E] text-[#F3F0EB] flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(255,107,74,0.08)_0%,rgba(13,13,22,0)_70%)] pointer-events-none" />

      {/* Header Bar */}
      <header className="border-b border-[#202030] bg-[#0A0A12]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF6B4A] to-[#C8381C] text-white flex items-center justify-center font-serif italic text-base font-bold shadow-[0_0_15px_rgba(255,107,74,0.3)] select-none">
              C
            </div>
            <div>
              <span className="font-serif text-lg tracking-tight text-[#F3F0EB] font-semibold">
                Chronicle
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="landing-header-signin-btn"
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl bg-[#1A1A2A] text-[#F3F0EB] hover:bg-[#25253A] hover:border-[#FF6B4A]/40 border border-[#2E2E42] active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-[#FF6B4A]" />
              )}
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-16 sm:py-24 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#141422] border border-[#2B2B40] text-[#FF6B4A] text-[11px] font-medium tracking-wide shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B4A]" />
            <span>Voice-first companion with an unusually good memory</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-serif tracking-tight text-[#FFFFFF] leading-[1.08] font-normal">
            You don&apos;t have to write. <br />
            <span className="italic text-[#FF6B4A] drop-shadow-[0_0_20px_rgba(255,107,74,0.3)]">Just talk.</span>
          </h1>

          <p className="text-base sm:text-xl text-[#A09CB2] max-w-2xl mx-auto leading-relaxed font-sans font-light">
            When you&apos;ve had an exhausting day or raw racing thoughts, you shouldn&apos;t have to formulate polished essays. Press Vent and talk freely. Chronicle listens like an attentive friend and remembers what matters.
          </p>

          {/* Primary Action Button */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="landing-hero-signin-btn"
              onClick={handleSignIn}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-9 py-4.5 rounded-2xl bg-gradient-to-r from-[#FF6B4A] to-[#D94828] text-white hover:brightness-110 hover:shadow-[0_0_30px_rgba(255,107,74,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-sm uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>Sign in with Google</span>
                  <ArrowRight className="w-4 h-4 ml-1 text-white" />
                </>
              )}
            </button>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-[#2D1418] border border-[#68242C] text-[#FF8585] text-xs max-w-md mx-auto text-left font-sans">
              {authError}
            </div>
          )}

          {/* Three Human Pillars */}
          <div className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-5 text-left max-w-3xl mx-auto">
            <div className="p-6 rounded-2xl bg-[#11111C] border border-[#232336] shadow-xs space-y-2.5 hover:border-[#FF6B4A]/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A2A] border border-[#2B2B3E] flex items-center justify-center text-[#FF6B4A]">
                🎙️
              </div>
              <h3 className="font-serif text-base font-medium text-[#F3F0EB]">Never compete to speak</h3>
              <p className="text-xs text-[#8E8A9F] leading-relaxed font-sans font-light">
                Chronicle keeps its responses short and attentive. No 500-word lectures or unsolicited advice.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#11111C] border border-[#232336] shadow-xs space-y-2.5 hover:border-[#FF6B4A]/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A2A] border border-[#2B2B3E] flex items-center justify-center text-rose-400">
                <Heart className="w-4 h-4 text-rose-400" />
              </div>
              <h3 className="font-serif text-base font-medium text-[#F3F0EB]">Remembers who you are</h3>
              <p className="text-xs text-[#8E8A9F] leading-relaxed font-sans font-light">
                Gradually learns what you love, your ambitions, comfort routines, and who you&apos;re becoming over time.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#11111C] border border-[#232336] shadow-xs space-y-2.5 hover:border-[#FF6B4A]/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A2A] border border-[#2B2B3E] flex items-center justify-center text-amber-300">
                <span className="text-base">💀</span>
              </div>
              <h3 className="font-serif text-base font-medium text-[#F3F0EB]">Weekly meme evidence</h3>
              <p className="text-xs text-[#8E8A9F] leading-relaxed font-sans font-light">
                Subtle emotive atmosphere reflecting your emotional weather, plus witty weekly recaps sent straight to your inbox.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Warm Clean Nocturnal Footer */}
      <footer className="border-t border-[#1C1C2C] py-6 text-center text-xs text-[#6E6A7D] bg-[#0A0A12] relative z-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-light">
          <span>Chronicle &bull; Talk. Be heard. Be remembered.</span>
          <span>A personal companion with an unusually good memory.</span>
        </div>
      </footer>
    </div>
  );
};
