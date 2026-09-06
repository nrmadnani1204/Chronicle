import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Copy,
  Check,
  AlertCircle,
  Edit2,
  Volume2,
  Sparkles,
  ArrowLeft,
  Pin,
} from 'lucide-react';
import { VentButton } from './VentButton';
import { ThingsLyingAround } from './ThingsLyingAround';
import { RoomNavigation, type ChronicleMoodPersonality } from './RoomNavigation';
import { chronicleAudio } from '../utils/audioFeedback';
import { applyExtractionToGraph, buildSessionNode } from '../utils/graphSync';
import { findSimilarMemories } from '../utils/memoryDedup';
import { deriveMoodPersonality } from '../utils/moodPalette';
import type {
  JournalInteraction,
  JournalMessage,
  ConversationMode,
  ChronicleMemory,
  MoodState,
  GraphNode,
  GraphEdge,
} from '../types';

interface JournalStudioProps {
  interaction: JournalInteraction | null;
  onSaveInteraction: (updated: JournalInteraction) => Promise<void>;
  userId: string;
  memories: ChronicleMemory[];
  onSaveMemory: (memory: ChronicleMemory) => Promise<void>;
  graphNodes?: GraphNode[];
  graphEdges?: GraphEdge[];
  onSaveGraphNode?: (node: GraphNode) => Promise<void>;
  onSaveGraphEdge?: (edge: GraphEdge) => Promise<void>;
  onConfirmMemoryDeletion?: (memoryId: string) => Promise<void>;
  allPastSessions?: JournalInteraction[];
  onOpenMemoryDrawer?: () => void;
  onOpenHappyPlace?: () => void;
  onOpenLittleThings?: () => void;
  onNewVentSession?: () => void;
}

export const JournalStudio: React.FC<JournalStudioProps> = ({
  interaction,
  onSaveInteraction,
  userId,
  memories,
  onSaveMemory,
  graphNodes = [],
  graphEdges = [],
  onSaveGraphNode = async () => {},
  onSaveGraphEdge = async () => {},
  onConfirmMemoryDeletion = async () => {},
  allPastSessions = [],
  onOpenMemoryDrawer = () => {},
  onOpenHappyPlace = () => {},
  onOpenLittleThings = () => {},
  onNewVentSession = () => {},
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<ConversationMode>(
    interaction?.mode || 'listen'
  );
  const [isResponding, setIsResponding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState(interaction?.title || '');
  const [voicePlaybackEnabled, setVoicePlaybackEnabled] = useState(true);
  const [showTextFallback, setShowTextFallback] = useState(false);
  // Local-only: once a "forget this?" prompt is acted on (confirmed or
  // dismissed), hide it immediately without needing a round-trip to persist
  // the resolution — re-opening the session would just show it again, which
  // is an acceptable tradeoff for how rarely that happens.
  const [resolvedDeletionMessageIds, setResolvedDeletionMessageIds] = useState<Set<string>>(new Set());
  // Mood personality is derived from numeric mood (this session's, or the
  // most recent past session's if none is active yet) — manualOverride lets
  // the user explicitly force a tone via RoomNavigation, taking precedence
  // until cleared back to "auto".
  const [manualOverride, setManualOverride] = useState<ChronicleMoodPersonality | null>(null);
  const currentMoodState: MoodState | null =
    interaction?.mood || allPastSessions.find((s) => s.mood)?.mood || null;
  const derivedMoodPersonality = deriveMoodPersonality(currentMoodState);
  const moodPersonality = manualOverride ?? derivedMoodPersonality;

  // Best-effort, silent — powers "find nearby places" suggestions. Never
  // blocks or shows an error if denied/unavailable; the location tool just
  // returns nothing useful in that case.
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    // maximumAge lets the browser hand back a recent cached fix instantly
    // instead of forcing a brand-new GPS lock (which can take well over 5s
    // on a real device) — without this, a quick first message can easily
    // beat the location home before it ever resolves.
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Live real-time clock (e.g. 11:47 pm)
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now
        .toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        .toLowerCase();
      setCurrentTimeStr(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state on interaction switch
  useEffect(() => {
    if (interaction) {
      setSelectedMode(interaction.mode || 'listen');
      setCustomTitle(interaction.title);
      setErrorMessage(null);
    } else {
      setSelectedMode('listen');
      setCustomTitle('');
      setInputText('');
      setShowTextFallback(false);
    }
  }, [interaction?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interaction?.messages?.length, isResponding]);

  // Speech synthesis playback helper
  const speakText = (text: string) => {
    if (!voicePlaybackEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`~]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

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

  // Human-in-the-loop memory deletion — only ever fires from this explicit click.
  const handleConfirmDeletion = async (messageId: string, memoryId: string) => {
    chronicleAudio.playClick();
    setResolvedDeletionMessageIds((prev) => new Set(prev).add(messageId));
    try {
      await onConfirmMemoryDeletion(memoryId);
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleDismissDeletion = (messageId: string) => {
    chronicleAudio.playClick();
    setResolvedDeletionMessageIds((prev) => new Set(prev).add(messageId));
  };

  // Process user message (Voice or typed)
  const handleProcessMessage = async (content: string, inputType: 'voice' | 'text' = 'voice') => {
    const prompt = content.trim();
    if (!prompt || isResponding) return;

    setErrorMessage(null);
    setIsResponding(true);

    const now = Date.now();
    const interactionId =
      interaction?.id || `vent_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const userMessage: JournalMessage = {
      id: `msg_user_${now}`,
      role: 'user',
      content: prompt,
      timestamp: now,
      inputType,
    };

    const existingMessages = interaction?.messages || [];
    const updatedMessages = [...existingMessages, userMessage];

    try {
      // 1. Send to Chronicle API with past sessions for contextual memory review
      const formattedPast = (allPastSessions || [])
        .filter((s) => s.id !== interactionId)
        .map((s) => ({
          title: s.title,
          date: new Date(s.createdAt).toLocaleDateString(),
          userPrompt: s.userPrompt,
          geminiResponse: s.geminiResponse,
          mood: s.mood?.weather,
        }));

      // Most-referenced, non-session graph nodes give the agent's tools richer,
      // structured context beyond the flat memory text list.
      const graphContext = [...graphNodes]
        .filter((n) => n.type !== 'session')
        .sort((a, b) => b.referenceCount - a.referenceCount)
        .slice(0, 20)
        .map((n) => (n.description ? `${n.label}: ${n.description}` : n.label));

      // People the user has actually mentioned before — powers "have you
      // talked to X?" nudges without needing real Contacts API access.
      const peopleContext = graphNodes
        .filter((n) => n.type === 'person')
        .sort((a, b) => b.referenceCount - a.referenceCount)
        .map((n) => (n.description ? `${n.label}: ${n.description}` : n.label));

      const res = await fetch('/api/chronicle/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: selectedMode,
          history: existingMessages,
          memories: memories.map((m) => ({ id: m.id, text: m.text })),
          graphContext,
          people: peopleContext,
          pastSessions: formattedPast,
          tone: moodPersonality === 'angry' ? 'roast' : moodPersonality === 'heavy' ? 'gentle' : 'friend',
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Chronicle was unable to respond.');
      }

      const replyText = data.text;

      // Subtle audio feedback chime
      chronicleAudio.playIntimateChime();

      // Speak response if voice playback is on
      speakText(replyText);

      const companionMessage: JournalMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        content: replyText,
        timestamp: Date.now(),
        song: data.song,
        places: data.places,
        pendingDeletion: data.pendingDeletion,
      };

      const finalMessages = [...updatedMessages, companionMessage];

      const title = customTitle || interaction?.title;
      const updatedInteraction: JournalInteraction = {
        id: interactionId,
        userId,
        title: title || (prompt.length > 35 ? prompt.slice(0, 32) + '...' : prompt),
        mode: selectedMode,
        userPrompt: prompt,
        geminiResponse: replyText,
        turnCount: finalMessages.length,
        messages: finalMessages,
        createdAt: interaction?.createdAt || now,
        updatedAt: Date.now(),
        mood: interaction?.mood,
      };

      // 2. Persist to Firestore
      await onSaveInteraction(updatedInteraction);
      setInputText('');

      // 2b. Deterministic graph sync — always creates/updates a session node,
      // independent of any LLM call, so the graph stays populated even when
      // Gemini extraction is degraded or offline.
      try {
        const existingSessionNode = graphNodes.find((n) => n.id === `node_session_${interactionId}`);
        await onSaveGraphNode(buildSessionNode(userId, updatedInteraction, existingSessionNode));
      } catch (graphErr) {
        console.warn('Session graph node sync non-blocking error:', graphErr);
      }

      // 3. Asynchronous memory extraction & title update
      (async () => {
        try {
          const fullSessionText = finalMessages
            .map((m) => `${m.role === 'user' ? 'User' : 'Chronicle'}: ${m.content}`)
            .join('\n');

          const extractRes = await fetch('/api/chronicle/extract-memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionText: fullSessionText,
              graphNodeLabels: graphNodes.map((n) => n.label),
            }),
          });

          const extractData = await extractRes.json();
          if (extractData.success) {
            // Layer 1 (cheap, deterministic): shortlist existing memories
            // that might already describe the same fact as each candidate,
            // scoped to the same category. Layer 2 (LLM judge, only called
            // if at least one candidate has a shortlist) decides per
            // candidate whether it's genuinely new or should update an
            // existing memory instead — this is what stops near-duplicates
            // like two separately-worded "loves this song" memories.
            const candidates: Array<{ text: string; category: string; type: string; importance: number }> =
              Array.isArray(extractData.memories) ? extractData.memories : [];

            const shortlistByCandidate = candidates.map((c) =>
              findSimilarMemories(memories, c.text, (c.category || 'general') as ChronicleMemory['category'], 5)
            );
            const shortlistUnion = new Map<string, ChronicleMemory>();
            shortlistByCandidate.forEach((list) => list.forEach((m) => shortlistUnion.set(m.id, m)));

            let verdicts: Array<{ index: number; action: 'new' | 'update'; matchedMemoryId?: string; mergedText?: string }> = [];
            if (shortlistUnion.size > 0) {
              try {
                const judgeRes = await fetch('/api/chronicle/judge-memory-duplicates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    candidates: candidates.map((c, index) => ({ index, ...c })),
                    shortlist: Array.from(shortlistUnion.values()).map((m) => ({
                      id: m.id,
                      text: m.text,
                      category: m.category,
                    })),
                  }),
                });
                const judgeData = await judgeRes.json();
                if (judgeData.success && Array.isArray(judgeData.verdicts)) {
                  verdicts = judgeData.verdicts;
                }
              } catch (judgeErr) {
                console.warn('Memory duplicate judge non-blocking error:', judgeErr);
              }
            }

            const processedMemories: ChronicleMemory[] = [];
            for (let index = 0; index < candidates.length; index++) {
              const mem = candidates[index];
              const verdict = verdicts.find((v) => v.index === index);
              const existingMatch =
                verdict?.action === 'update' && verdict.matchedMemoryId
                  ? memories.find((m) => m.id === verdict.matchedMemoryId)
                  : undefined;

              if (existingMatch) {
                const updatedMem: ChronicleMemory = {
                  ...existingMatch,
                  text: verdict?.mergedText || mem.text,
                  importance: Math.max(existingMatch.importance, mem.importance || 0.8),
                  updatedAt: Date.now(),
                  history: [
                    ...(existingMatch.history || []),
                    { text: existingMatch.text, updatedAt: existingMatch.updatedAt || existingMatch.createdAt },
                  ],
                };
                await onSaveMemory(updatedMem);
                processedMemories.push(updatedMem);
              } else {
                const newMem: ChronicleMemory = {
                  id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  userId,
                  text: mem.text,
                  category: (mem.category || 'general') as ChronicleMemory['category'],
                  type: (mem.type || 'semantic') as ChronicleMemory['type'],
                  importance: mem.importance || 0.8,
                  createdAt: Date.now(),
                  sourceSessionId: interactionId,
                };
                await onSaveMemory(newMem);
                processedMemories.push(newMem);
              }
            }

            // Knowledge graph sync from the LLM's extracted nodes/edges (or
            // the deterministic fallback's trivial ones), linked against the
            // graph state already known to this client.
            try {
              const { updatedNodes, newEdges } = applyExtractionToGraph({
                userId,
                existingNodes: graphNodes,
                existingEdges: graphEdges,
                extractedNodes: Array.isArray(extractData.nodes) ? extractData.nodes : [],
                extractedEdges: Array.isArray(extractData.edges) ? extractData.edges : [],
                sourceSessionId: interactionId,
              });
              for (const node of updatedNodes) {
                await onSaveGraphNode(node);
              }
              for (const edge of newEdges) {
                await onSaveGraphEdge(edge);
              }
            } catch (graphErr) {
              console.warn('Extraction graph sync non-blocking error:', graphErr);
            }

            // Attach whatever got captured/refined THIS turn to the specific
            // message that produced it, so the "remembered" chip renders
            // inline right there — not as a separate list pinned to the
            // bottom of the whole conversation, out of chronological order.
            const messagesWithMemoryChip = finalMessages.map((m) =>
              m.id === companionMessage.id && processedMemories.length > 0
                ? { ...m, extractedMemories: processedMemories }
                : m
            );

            const refreshedInteraction: JournalInteraction = {
              ...updatedInteraction,
              title: extractData.title || updatedInteraction.title,
              mood: extractData.mood,
              messages: messagesWithMemoryChip,
              extractedMemoriesCount:
                (updatedInteraction.extractedMemoriesCount || 0) + processedMemories.length,
            };
            await onSaveInteraction(refreshedInteraction);

            // The session node's label mirrors the interaction title — refresh
            // it now that extraction may have set a better title.
            try {
              const existingSessionNode = graphNodes.find((n) => n.id === `node_session_${interactionId}`);
              await onSaveGraphNode(buildSessionNode(userId, refreshedInteraction, existingSessionNode));
            } catch (graphErr) {
              console.warn('Session graph node title refresh non-blocking error:', graphErr);
            }
          }
        } catch (memErr) {
          console.warn('Memory extraction non-blocking error:', memErr);
        }
      })();
    } catch (err: any) {
      console.warn('Network alert, engaging instant local companion response:', err);
      const emergencyReply = "Yeah. I'm right here with you. Keep going, I'm listening.";
      const companionMessage: JournalMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        content: emergencyReply,
        timestamp: Date.now(),
      };
      const finalMessages = [...updatedMessages, companionMessage];
      const fallbackInteraction: JournalInteraction = {
        id: interactionId,
        userId,
        title: customTitle || interaction?.title || (prompt.length > 35 ? prompt.slice(0, 32) + '...' : prompt),
        mode: selectedMode,
        userPrompt: prompt,
        geminiResponse: emergencyReply,
        turnCount: finalMessages.length,
        messages: finalMessages,
        createdAt: interaction?.createdAt || now,
        updatedAt: Date.now(),
        mood: interaction?.mood,
      };
      await onSaveInteraction(fallbackInteraction);
      setInputText('');
      chronicleAudio.playIntimateChime();
    } finally {
      setIsResponding(false);
    }
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    handleProcessMessage(inputText.trim(), 'text');
  };

  const handleSaveTitle = async () => {
    if (!interaction) return;
    const trimmed = customTitle.trim();
    if (!trimmed || trimmed === interaction.title) {
      setEditingTitle(false);
      return;
    }
    const updated = { ...interaction, title: trimmed, updatedAt: Date.now() };
    await onSaveInteraction(updated);
    setEditingTitle(false);
  };

  // Human greeting based on mood personality
  const getGreeting = () => {
    switch (moodPersonality) {
      case 'angry':
        return (
          <div className="space-y-0.5">
            <h2 className="font-mono text-xl sm:text-2xl font-bold text-[#FF6B6B]">
              yeah okay.
            </h2>
            <p className="font-hand text-2xl sm:text-3xl text-[#F3F0EB]">
              get it out.
            </p>
          </div>
        );
      case 'heavy':
        return (
          <div className="space-y-1">
            <h2 className="font-serif italic text-2xl sm:text-3xl text-[#A5A6D6]">
              I&apos;m here.
            </h2>
            <p className="font-mono text-xs text-[#8E8A9F]">
              no rush. take all the time you need.
            </p>
          </div>
        );
      case 'happy':
        return (
          <div className="space-y-0.5">
            <h2 className="font-hand text-3xl sm:text-4xl text-amber-300 font-bold -rotate-1">
              oh??? we&apos;re having a
            </h2>
            <p className="font-serif italic text-2xl text-[#F3F0EB] rotate-1">
              GOOD day???
            </p>
          </div>
        );
      case 'overwhelmed':
        return (
          <div className="space-y-1">
            <h2 className="font-mono text-lg text-teal-300">
              hey.
            </h2>
            <p className="font-hand text-3xl text-[#F3F0EB]">
              breathe for a sec.
            </p>
          </div>
        );
      default:
        return (
          <div className="space-y-0.5">
            <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#F3F0EB]">
              you seem a little
            </h2>
            <p className="font-mono text-lg sm:text-xl text-[#FF6B4A] font-bold">
              moody today
            </p>
          </div>
        );
    }
  };

  const hasMessages = Boolean(interaction && interaction.messages && interaction.messages.length > 0);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] text-[#F3F0EB] overflow-hidden relative">
      {/* Top Bar (Active session mode or Room navigation) */}
      {hasMessages ? (
        <div className="px-4 sm:px-8 py-3 border-b border-[#232336] bg-[#0E0E18]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onNewVentSession}
              className="flex items-center gap-1.5 text-xs font-mono text-[#8E8A9F] hover:text-[#F3F0EB] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              title="Return to bedroom wall"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">bedroom wall</span>
            </button>

            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  className="text-xs font-mono text-[#F3F0EB] border border-[#34344E] bg-[#141422] rounded-lg px-2.5 py-1 focus:border-[#FF6B4A] focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="text-xs px-2.5 py-1 bg-[#FF6B4A] text-white rounded-md font-mono"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-serif italic text-base text-[#F3F0EB] truncate">
                  &ldquo;{interaction?.title || 'Current Vent Session'}&rdquo;
                </h2>
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-[#8E8A9F] hover:text-[#FF6B4A] p-1 cursor-pointer"
                  title="Rename session"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNewVentSession}
              className="px-3 py-1 rounded-lg bg-[#FF6B4A]/20 hover:bg-[#FF6B4A]/30 border border-[#FF6B4A]/40 text-[#FF6B4A] font-mono text-xs cursor-pointer transition-colors"
            >
              new vent &rarr;
            </button>
          </div>
        </div>
      ) : (
        <RoomNavigation
          onOpenLittleThings={onOpenLittleThings}
          onOpenHappyPlace={onOpenHappyPlace}
          onOpenMemoryDrawer={onOpenMemoryDrawer}
          currentMood={moodPersonality}
          onSelectMood={setManualOverride}
          isAutoMode={manualOverride === null}
          onClearOverride={() => setManualOverride(null)}
          onNewVentSession={onNewVentSession}
          isSessionActive={hasMessages}
        />
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="px-6 py-2.5 bg-[#2A1414] border-b border-[#5C2323] text-[#FF8B8B] text-xs flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#FF6B4A]" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-[#FF8B8B] underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-8 z-10">
        {!hasMessages ? (
          /* THE HOME SCREEN / BEDROOM WALL */
          <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
            {/* 1. Header with Clock: chronicle \n 11:47 pm */}
            <div className="mb-4 select-none">
              <span className="font-serif italic tracking-wide text-sm text-[#8E8A9F] block mb-0.5">
                chronicle
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-[#FF6B4A] font-semibold">
                {currentTimeStr || '11:47 pm'}
              </span>
            </div>

            {/* 2. Raw human greeting */}
            <div className="mb-6 select-none">
              {getGreeting()}
            </div>

            {/* 3. The Giant Squishy Vent Blob */}
            <div className="w-full max-w-md mx-auto">
              <VentButton
                onTranscriptComplete={(transcript) => handleProcessMessage(transcript, 'voice')}
                isProcessing={isResponding}
                onTextFallbackClick={() => setShowTextFallback(true)}
                voicePlaybackEnabled={voicePlaybackEnabled}
                onToggleVoicePlayback={() => setVoicePlaybackEnabled(!voicePlaybackEnabled)}
                moodPersonality={moodPersonality}
              />
            </div>

            {/* 4. Things Lying Around (Desk / Bedroom clutter) */}
            <ThingsLyingAround
              memories={memories}
              onOpenHappyPlace={onOpenHappyPlace}
              onOpenMemoryDrawer={onOpenMemoryDrawer}
              onOpenLittleThings={onOpenLittleThings}
              moodPersonality={moodPersonality}
            />
          </div>
        ) : (
          /* ACTIVE CONVERSATION THREAD: Human speaks, AI makes room */
          <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {interaction?.messages &&
              interaction.messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${
                      isUser ? 'items-end' : 'items-start pl-2 sm:pl-4'
                    }`}
                  >
                    {/* Tiny speaker label */}
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-[#8E8A9F] uppercase tracking-wider">
                      <span className={isUser ? 'text-[#FF6B4A] font-semibold' : 'text-[#A09CB2]'}>
                        {isUser ? (msg.inputType === 'voice' ? 'me (voice):' : 'me:') : 'chronicle:'}
                      </span>
                      <span>&bull;</span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!isUser && voicePlaybackEnabled && (
                        <button
                          onClick={() => speakText(msg.content)}
                          className="text-[#8E8A9F] hover:text-[#FF6B4A] p-0.5 cursor-pointer ml-1"
                          title="Replay voice response"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    {isUser ? (
                      /* Human Speaks: full, expressive, prominent */
                      <div className="w-full max-w-xl p-4.5 rounded-2xl bg-[#151524] border border-[#2D2D42] text-[#F3F0EB] shadow-md">
                        <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    ) : (
                      /* AI Makes Room: visually tiny, understated, conversational */
                      <div className="w-full max-w-lg pt-1 pb-2 pl-3 border-l-2 border-[#FF6B4A]/50">
                        <p className="font-hand text-2xl text-[#EDEDF5] leading-snug whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        {msg.song && (
                          <div className="mt-3 max-w-sm rounded-xl overflow-hidden border border-[#2B2B3E] bg-[#0E0E18] shadow-lg">
                            <iframe
                              width="100%"
                              height="200"
                              src={`https://www.youtube.com/embed/${msg.song.videoId}`}
                              title={msg.song.title}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                            <div className="px-3 py-2 text-[10px] font-mono text-[#8E8A9F] truncate">
                              🎵 {msg.song.title} &middot; {msg.song.channelTitle}
                            </div>
                          </div>
                        )}

                        {msg.places && msg.places.length > 0 && (
                          <div className="mt-3 max-w-sm rounded-xl border border-[#2B2B3E] bg-[#0E0E18] shadow-lg p-3 space-y-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#FF6B4A]">
                              📍 nearby
                            </div>
                            {msg.places.map((place, placeIdx) => (
                              <div key={placeIdx} className="text-xs font-sans">
                                <span className="text-[#F3F0EB] font-medium">{place.name}</span>
                                {typeof place.rating === 'number' && (
                                  <span className="text-[#8E8A9F]"> &middot; ⭐ {place.rating}</span>
                                )}
                                <div className="text-[10px] text-[#8E8A9F]">{place.address}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.extractedMemories && msg.extractedMemories.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {msg.extractedMemories.map((mem) => (
                              <span
                                key={mem.id}
                                title={mem.text}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1A1A28] border border-[#2E2E42] text-[10px] font-mono text-[#A09CB2] max-w-[220px]"
                              >
                                <span className="shrink-0">📌</span>
                                <span className="truncate">{mem.updatedAt ? 'updated: ' : 'remembered: '}{mem.text}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {msg.pendingDeletion && !resolvedDeletionMessageIds.has(msg.id) && (
                          <div className="mt-3 max-w-sm rounded-xl border border-[#5C2323] bg-[#1A1216] p-3">
                            <p className="text-xs font-sans text-[#F3F0EB] mb-2">
                              Forget this? &ldquo;{msg.pendingDeletion.memoryText}&rdquo;
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleConfirmDeletion(msg.id, msg.pendingDeletion!.memoryId)}
                                className="px-3 py-1 rounded-lg bg-[#FF6B4A] hover:bg-[#FF5530] text-white text-[11px] font-mono cursor-pointer transition-colors"
                              >
                                Yes, forget it
                              </button>
                              <button
                                onClick={() => handleDismissDeletion(msg.id)}
                                className="px-3 py-1 rounded-lg bg-[#242430] hover:bg-[#2E2E3E] text-[#A09CB2] text-[11px] font-mono cursor-pointer transition-colors"
                              >
                                No, keep it
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[#6E6A7D]">
                          <button
                            onClick={() => handleCopy(msg.content, index)}
                            className="hover:text-[#F3F0EB] cursor-pointer"
                          >
                            {copiedIndex === index ? 'copied' : 'copy'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Live Thinking/Listening Indicator */}
            {isResponding && (
              <div className="flex flex-col items-start pl-4">
                <div className="text-[11px] font-mono text-[#FF6B4A] mb-1">
                  chronicle:
                </div>
                <div className="pl-3 border-l-2 border-[#FF6B4A]/30 py-1">
                  <span className="font-hand text-xl text-[#8E8A9F] animate-pulse">
                    listening...
                  </span>
                </div>
              </div>
            )}

            {/* In-Thread Squishy Vent Button to continue talking */}
            <div className="pt-6 pb-2">
              <VentButton
                onTranscriptComplete={(transcript) => handleProcessMessage(transcript, 'voice')}
                isProcessing={isResponding}
                onTextFallbackClick={() => setShowTextFallback(true)}
                voicePlaybackEnabled={voicePlaybackEnabled}
                onToggleVoicePlayback={() => setVoicePlaybackEnabled(!voicePlaybackEnabled)}
                moodPersonality={moodPersonality}
              />
            </div>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Fallback Bar (For typing quietly) */}
      {(showTextFallback || hasMessages) && (
        <div className="p-3 sm:px-8 border-t border-[#232336] bg-[#0C0C14] shrink-0 z-20">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleTextSubmit} className="relative flex items-center">
              <input
                id="journal-input-text"
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isResponding
                    ? 'Chronicle is listening...'
                    : 'Or type your thoughts quietly here...'
                }
                disabled={isResponding}
                className="w-full py-2.5 pl-4 pr-14 text-sm font-mono text-[#F3F0EB] placeholder:text-[#6E6A7D] bg-[#12121E] border border-[#28283C] rounded-xl focus:outline-none focus:border-[#FF6B4A] transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isResponding}
                className="absolute right-2 p-1.5 rounded-lg bg-[#FF6B4A] text-white hover:bg-[#E04828] disabled:opacity-30 transition-all cursor-pointer"
                title="Send text"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
