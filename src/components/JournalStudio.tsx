import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  FileText,
  Lightbulb,
  MessageSquare,
  Copy,
  Check,
  RotateCw,
  AlertCircle,
  Database,
  Info,
  Clock,
  ChevronDown,
  Edit2,
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import type { JournalInteraction, JournalMessage, ReflectionMode } from '../types';

interface JournalStudioProps {
  interaction: JournalInteraction | null;
  onSaveInteraction: (updated: JournalInteraction) => Promise<void>;
  userId: string;
}

const INSPIRATION_PROMPTS = [
  'What went unexpectedly well today, and what underlying factor contributed to it?',
  'I have a difficult decision to make between two competing paths. Help me weigh them objectively.',
  'Brainstorm creative alternative perspectives on a project obstacle I am facing.',
  'Summarize my unfiltered thoughts on current priorities and extract 3 actionable next steps.',
];

export const JournalStudio: React.FC<JournalStudioProps> = ({
  interaction,
  onSaveInteraction,
  userId,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>(
    interaction?.mode || 'reflect'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState(interaction?.title || '');
  const [failedPayload, setFailedPayload] = useState<JournalInteraction | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when interaction changes
  useEffect(() => {
    if (interaction) {
      setSelectedMode(interaction.mode);
      setCustomTitle(interaction.title);
      setErrorMessage(null);
      setFailedPayload(null);
    } else {
      setSelectedMode('reflect');
      setCustomTitle('');
      setInputText('');
    }
  }, [interaction?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interaction?.messages?.length, isGenerating]);

  // Copy helper
  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  // Submit Prompt to Gemini and Firestore
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputText.trim();
    if (!prompt || isGenerating) return;

    setErrorMessage(null);
    setSaveSuccessMsg(null);
    setIsGenerating(true);

    const now = Date.now();
    const isNewSession = !interaction;
    const interactionId =
      interaction?.id || `entry_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const userMessage: JournalMessage = {
      id: `msg_user_${now}`,
      role: 'user',
      content: prompt,
      timestamp: now,
    };

    const existingMessages = interaction?.messages || [];
    const updatedMessages = [...existingMessages, userMessage];

    try {
      // 1. Call server-side Gemini route
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: selectedMode,
          history: existingMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gemini API failed to generate a response.');
      }

      const geminiText = data.text;
      const modelUsed = data.modelUsed || 'gemini-3.6-flash';

      const modelMessage: JournalMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        content: geminiText,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, modelMessage];

      // Auto-generate title for new sessions or use first few words
      let title = customTitle || interaction?.title;
      if (!title || isNewSession) {
        try {
          const titleRes = await fetch('/api/gemini/title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          const titleData = await titleRes.json();
          title = titleData.title || prompt.slice(0, 32);
        } catch {
          title = prompt.slice(0, 32);
        }
      }

      const updatedInteraction: JournalInteraction = {
        id: interactionId,
        userId,
        title: title || 'Journal Reflection',
        mode: selectedMode,
        userPrompt: prompt,
        geminiResponse: geminiText,
        turnCount: finalMessages.length,
        messages: finalMessages,
        createdAt: interaction?.createdAt || now,
        updatedAt: Date.now(),
        modelUsed,
      };

      // 2. Guaranteed Transaction Verification: Persist to Firestore
      setIsSaving(true);
      try {
        await onSaveInteraction(updatedInteraction);
        // Only clear input buffer after confirmed persistence
        setInputText('');
        setSaveSuccessMsg('Reflection saved securely to Firestore');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      } catch (saveErr: any) {
        console.error('Firestore save failed:', saveErr);
        setFailedPayload(updatedInteraction);
        setErrorMessage(
          `Generated successfully, but saving to Firestore failed: ${
            saveErr?.message || 'Database permission error.'
          }. Your prompt is preserved. Please click 'Retry Save'.`
        );
      } finally {
        setIsSaving(false);
      }
    } catch (err: any) {
      console.error('Reflection submission error:', err);
      setErrorMessage(
        err?.message || 'An error occurred while generating your reflection. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Retry save if Firestore failed earlier
  const handleRetrySave = async () => {
    if (!failedPayload) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSaveInteraction(failedPayload);
      setFailedPayload(null);
      setInputText('');
      setSaveSuccessMsg('Reflection saved securely to Firestore');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Retry failed: ${err?.message || 'Unknown database error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Update Title
  const handleSaveTitle = async () => {
    if (!interaction) return;
    const trimmed = customTitle.trim();
    if (!trimmed || trimmed === interaction.title) {
      setEditingTitle(false);
      return;
    }
    const updated = { ...interaction, title: trimmed, updatedAt: Date.now() };
    try {
      await onSaveInteraction(updated);
      setEditingTitle(false);
    } catch (e: any) {
      setErrorMessage(`Failed to update title: ${e.message}`);
    }
  };

  const modeDetails: Record<
    ReflectionMode,
    { label: string; icon: React.ReactNode; desc: string }
  > = {
    reflect: {
      label: 'Reflective Mirror',
      icon: <Sparkles className="w-3.5 h-3.5 text-emerald-600" />,
      desc: 'Empathetic synthesis & discovery of underlying thoughts',
    },
    summarize: {
      label: 'Executive Summary',
      icon: <FileText className="w-3.5 h-3.5 text-blue-600" />,
      desc: 'Key themes, emotional landscape & actionable takeaways',
    },
    brainstorm: {
      label: 'Brainstorm Ideas',
      icon: <Lightbulb className="w-3.5 h-3.5 text-amber-600" />,
      desc: 'Divergent perspectives & creative thought experiments',
    },
    chat: {
      label: 'Socratic Dialogue',
      icon: <MessageSquare className="w-3.5 h-3.5 text-purple-600" />,
      desc: 'Continuous multi-turn conversational reflection',
    },
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#FBF9F6] overflow-hidden">
      {/* Session Top Bar */}
      <div className="px-6 sm:px-10 py-3.5 border-b border-[#E5E1DA] bg-[#FBF9F6] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          {editingTitle ? (
            <div className="flex items-center gap-2 w-full max-w-md">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="w-full text-sm font-medium text-[#1A1A1A] border border-[#E5E1DA] bg-white rounded-md px-2.5 py-1 focus:border-[#1A1A1A] focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="text-xs px-2.5 py-1 bg-[#1A1A1A] text-[#FBF9F6] rounded hover:bg-[#333333]"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setCustomTitle(interaction?.title || '');
                  setEditingTitle(false);
                }}
                className="text-xs px-2 py-1 text-[#716E68] hover:text-[#1A1A1A]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-serif font-normal text-[#1A1A1A] truncate tracking-tight">
                {interaction?.title || 'New Reflection Session'}
              </h2>
              {interaction && (
                <button
                  id="rename-reflection-btn"
                  onClick={() => setEditingTitle(true)}
                  className="text-[#A09D96] hover:text-[#1A1A1A] p-1 rounded hover:bg-[#FAF8F4] transition-colors"
                  title="Rename reflection"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reflection Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[#FAF8F4] p-1 rounded-xl border border-[#E5E1DA]">
          {(Object.keys(modeDetails) as ReflectionMode[]).map((modeKey) => {
            const m = modeDetails[modeKey];
            const isActive = selectedMode === modeKey;
            return (
              <button
                key={modeKey}
                id={`mode-selector-${modeKey}`}
                onClick={() => setSelectedMode(modeKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#1A1A1A] border border-[#E5E1DA] shadow-xs'
                    : 'text-[#716E68] hover:text-[#1A1A1A] hover:bg-white/50 border border-transparent'
                }`}
                title={m.desc}
              >
                {m.icon}
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications & Error Banners */}
      {errorMessage && (
        <div className="px-6 sm:px-10 py-2.5 bg-[#FAF0E6] border-b border-[#E5E1DA] text-[#8C4A2F] text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#8C4A2F]" />
            <span>{errorMessage}</span>
          </div>
          {failedPayload && (
            <button
              onClick={handleRetrySave}
              disabled={isSaving}
              className="px-2.5 py-1 rounded bg-[#8C4A2F] text-white font-medium hover:bg-[#5C3220] active:scale-95 transition-all text-xs cursor-pointer"
            >
              {isSaving ? 'Retrying...' : 'Retry Save'}
            </button>
          )}
        </div>
      )}

      {saveSuccessMsg && (
        <div className="px-6 sm:px-10 py-2 bg-[#F0F7F2] border-b border-[#D4E7D9] text-[#2D6A4F] text-xs flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#2D6A4F]" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-10 md:px-16 py-8 space-y-6">
        {/* If New / Blank Session, Show Warm Guidance & Inspiration */}
        {(!interaction || !interaction.messages || interaction.messages.length === 0) && (
          <div className="max-w-2xl mx-auto py-10 text-center space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E1DA] flex items-center justify-center mx-auto text-[#1A1A1A] shadow-xs">
              <Sparkles className="w-5 h-5 text-[#C8B6A6]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-serif italic font-normal text-[#1A1A1A]">
                Begin a New Reflection
              </h3>
              <p className="text-xs sm:text-sm text-[#716E68] font-light max-w-md mx-auto leading-relaxed font-sans">
                Pen your thoughts, challenges, or aspirations below. Gemini 3.6 Flash
                will converse with you in <strong>{modeDetails[selectedMode].label}</strong> mode.
              </p>
            </div>

            {/* Inspiration Chips */}
            <div className="pt-3">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#A09D96] mb-3">
                Inspiration Prompts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {INSPIRATION_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`inspiration-prompt-${idx}`}
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-4 text-xs rounded-xl bg-white hover:bg-[#FAF8F4] border border-[#E5E1DA] text-[#1A1A1A] transition-all text-left font-serif italic leading-relaxed hover:border-[#1A1A1A]/30 active:scale-[0.99] cursor-pointer shadow-xs"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Existing Message Thread */}
        {interaction?.messages &&
          interaction.messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`max-w-3xl mx-auto flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[10px] text-[#A09D96] px-1 uppercase tracking-wider">
                  <span className={isUser ? 'text-[#C8B6A6] font-semibold' : 'text-[#1A1A1A] font-semibold'}>
                    {isUser ? 'Your Journal Entry' : 'Gemini 3.6 Flash'}
                  </span>
                  <span>&bull;</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!isUser && interaction.modelUsed && (
                    <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5E1DA] text-[#716E68] font-mono text-[9px]">
                      {interaction.modelUsed}
                    </span>
                  )}
                </div>

                <div
                  className={`w-full rounded-2xl p-6 text-sm transition-all border ${
                    isUser
                      ? 'bg-white border-[#E5E1DA] text-[#1A1A1A] shadow-xs'
                      : 'bg-[#FAF8F4] border-[#E5E1DA] text-[#1A1A1A] shadow-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed font-sans font-light text-[15px]">{msg.content}</p>
                  ) : (
                    <div className="relative group">
                      <MarkdownView content={msg.content} />
                      <div className="mt-4 pt-3 border-t border-[#E5E1DA]/80 flex items-center justify-between text-xs text-[#A09D96]">
                        <span className="text-[10px] uppercase tracking-wider text-[#A09D96] font-semibold">
                          {interaction.mode === 'summarize'
                            ? 'Executive Summary'
                            : interaction.mode === 'brainstorm'
                            ? 'Brainstorming Ideation'
                            : interaction.mode === 'chat'
                            ? 'Dialogue Turn'
                            : 'Empathetic Reflection'}
                        </span>
                        <button
                          onClick={() => handleCopy(msg.content, index)}
                          className="inline-flex items-center gap-1 text-[11px] text-[#716E68] hover:text-[#1A1A1A] px-2.5 py-1 rounded-md border border-transparent hover:border-[#E5E1DA] hover:bg-white transition-colors cursor-pointer"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3 h-3 text-[#2D6A4F]" />
                              <span className="text-[#2D6A4F] font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {/* Live Generation Indicator */}
        {isGenerating && (
          <div className="max-w-3xl mx-auto flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase tracking-wider text-[#A09D96] px-1">
              <span className="text-[#1A1A1A] font-semibold">Gemini 3.6 Flash</span>
              <span>&bull;</span>
              <span>Reflecting...</span>
            </div>
            <div className="w-full rounded-2xl p-6 bg-[#FAF8F4] border border-[#E5E1DA] text-sm text-[#716E68] space-y-3">
              <div className="flex items-center gap-2.5 text-[#1A1A1A] font-medium text-xs">
                <span className="inline-block w-4 h-4 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
                <span className="font-serif italic text-sm">Consulting Gemini ({modeDetails[selectedMode].label})...</span>
              </div>
              <div className="space-y-2 opacity-50">
                <div className="h-2.5 bg-[#E5E1DA] rounded w-5/6 animate-pulse" />
                <div className="h-2.5 bg-[#E5E1DA] rounded w-4/6 animate-pulse" />
                <div className="h-2.5 bg-[#E5E1DA] rounded w-3/6 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 sm:px-10 border-t border-[#E5E1DA] bg-[#FBF9F6] shrink-0">
        <div className="max-w-3xl mx-auto space-y-2.5">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative rounded-2xl border border-[#E5E1DA] bg-white focus-within:border-[#1A1A1A] focus-within:ring-0 transition-all shadow-xs">
              <textarea
                id="journal-input-textarea"
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  interaction
                    ? `Continue reflecting or ask a follow-up question (${modeDetails[selectedMode].label})...`
                    : `Write your journal entry or reflection here... (Ctrl+Enter to send)`
                }
                rows={3}
                disabled={isGenerating}
                className="w-full p-4 pb-12 text-sm text-[#1A1A1A] placeholder:text-[#A09D96] focus:outline-none resize-none rounded-2xl disabled:opacity-50 font-sans font-light leading-relaxed"
              />

              {/* Bottom bar inside textarea */}
              <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                <div className="text-[10px] uppercase tracking-wider text-[#A09D96] pointer-events-auto font-medium">
                  {inputText.length > 0 && <span>{inputText.length} characters</span>}
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    id="journal-submit-btn"
                    type="submit"
                    disabled={!inputText.trim() || isGenerating}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-[#1A1A1A] text-[#FBF9F6] hover:bg-[#333333] active:scale-95 transition-all text-xs font-semibold uppercase tracking-wider shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-[#FBF9F6] border-t-transparent rounded-full animate-spin" />
                        <span>Reflecting...</span>
                      </>
                    ) : (
                      <>
                        <span>{interaction ? 'Send Follow-up' : 'Reflect with Gemini'}</span>
                        <Send className="w-3 h-3 ml-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#A09D96] px-1 font-medium">
            <span className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-[#C8B6A6]" />
              Isolated Firestore storage: <code className="font-mono text-[#1A1A1A] lowercase">/users/{userId.slice(0, 8)}...</code>
            </span>
            <span className="hidden sm:inline">Press Ctrl+Enter to reflect</span>
          </div>
        </div>
      </div>
    </div>
  );
};
