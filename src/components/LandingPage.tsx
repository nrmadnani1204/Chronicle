import React, { useState } from 'react';
import { Sparkles, Shield, Lock, BookOpen, BrainCircuit, ArrowRight, CheckCircle2 } from 'lucide-react';
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
      // Friendly message for popup cancellation vs actual error
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled. Please click sign-in again to continue.');
      } else {
        setAuthError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-[#1A1A1A] flex flex-col justify-between">
      {/* Header Bar */}
      <header className="border-b border-[#E5E1DA] bg-[#FBF9F6]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-[#FBF9F6] flex items-center justify-center font-serif italic text-base font-bold shadow-xs">
              R
            </div>
            <div>
              <span className="font-serif text-lg tracking-tight text-[#1A1A1A]">
                Reflections Journal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="landing-header-signin-btn"
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-[#1A1A1A] text-[#FBF9F6] hover:bg-[#333333] active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              Sign In with Google
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E1DA] text-[#1A1A1A] text-[10px] font-semibold tracking-[0.2em] uppercase shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#C8B6A6]" />
            Empathetic AI Journaling &bull; Cloud Firestore Secured
          </div>

          <h1 className="text-4xl sm:text-6xl font-serif tracking-tight text-[#1A1A1A] leading-[1.12] font-normal">
            A sanctuary to clarify thoughts, reflect deeply, and converse with Gemini.
          </h1>

          <p className="text-base sm:text-lg text-[#716E68] max-w-2xl mx-auto leading-relaxed font-sans font-light">
            Record daily reflections and multi-turn insights. Gemini 3.6 Flash provides thoughtful summaries,
            creative perspectives, and mirror dialogues — strictly isolated to your private Firestore collection.
          </p>

          {/* Primary Action Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="landing-hero-signin-btn"
              onClick={handleSignIn}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#1A1A1A] text-[#FBF9F6] hover:bg-[#333333] active:scale-[0.98] transition-all font-semibold text-xs uppercase tracking-[0.1em] shadow-xs cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google Sign-In</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 text-[#C8B6A6]" />
                </>
              )}
            </button>
          </div>

          {authError && (
            <div className="p-3.5 rounded-lg bg-[#FAF0E6] border border-[#E5E1DA] text-[#8C4A2F] text-xs max-w-md mx-auto text-left font-sans">
              {authError}
            </div>
          )}

          {/* Security & Architecture Badges */}
          <div className="pt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
            <div className="p-5 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F4] border border-[#E5E1DA] flex items-center justify-center text-[#1A1A1A]">
                <Shield className="w-4 h-4 text-[#C8B6A6]" />
              </div>
              <h3 className="font-serif text-sm font-medium text-[#1A1A1A]">Strict User Isolation</h3>
              <p className="text-xs text-[#716E68] leading-relaxed font-sans font-light">
                Cloud Firestore security rules enforce path-bound access (<code className="text-[#1A1A1A] bg-[#FAF8F4] px-1 py-0.5 rounded border border-[#E5E1DA]">request.auth.uid == userId</code>). Your entries are visible only to you.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F4] border border-[#E5E1DA] flex items-center justify-center text-[#1A1A1A]">
                <BrainCircuit className="w-4 h-4 text-[#C8B6A6]" />
              </div>
              <h3 className="font-serif text-sm font-medium text-[#1A1A1A]">Gemini 3.6 Flash</h3>
              <p className="text-xs text-[#716E68] leading-relaxed font-sans font-light">
                High-speed synthesis, theme extraction, and multi-turn socratic reflections backed by an automated model fallback ladder.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F4] border border-[#E5E1DA] flex items-center justify-center text-[#1A1A1A]">
                <Lock className="w-4 h-4 text-[#C8B6A6]" />
              </div>
              <h3 className="font-serif text-sm font-medium text-[#1A1A1A]">Passwordless Auth</h3>
              <p className="text-xs text-[#716E68] leading-relaxed font-sans font-light">
                Direct federated identity via Firebase Authentication. No insecure local passwords or credential exposures.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E1DA] py-6 text-center text-[10px] uppercase tracking-wider text-[#A09D96] bg-[#FAF8F4]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-medium">
          <span>Reflections Journal &bull; Built with Gemini 3.6 Flash &amp; Cloud Firestore</span>
          <span>Security Hardened &bull; Zero Untrusted Defaults</span>
        </div>
      </footer>
    </div>
  );
};
