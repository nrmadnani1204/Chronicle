import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Mail, CheckCircle2, Send, Clock, Sparkles } from 'lucide-react';
import type { JournalInteraction, WeeklyReceipt } from '../types';

interface WeeklyReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  interactions: JournalInteraction[];
  userEmail?: string | null;
}

export const WeeklyReceiptsModal: React.FC<WeeklyReceiptsModalProps> = ({
  isOpen,
  onClose,
  interactions,
  userEmail,
}) => {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<WeeklyReceipt | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(userEmail || '');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  useEffect(() => {
    if (userEmail && !recipientEmail) {
      setRecipientEmail(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    if (isOpen && !receipt) {
      generateReceipt();
    }
  }, [isOpen]);

  const generateReceipt = async () => {
    try {
      setLoading(true);
      setEmailStatus(null);
      const recentSessions = interactions.slice(0, 7).map((i) => ({
        title: i.title,
        snippet: i.userPrompt.slice(0, 100),
      }));

      const res = await fetch('/api/chronicle/weekly-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: recentSessions }),
      });

      const data = await res.json();
      const currentUserId = interactions[0]?.userId || 'anonymous';
      if (data.success && data.receipt) {
        setReceipt({
          id: `receipt_${Date.now()}`,
          userId: currentUserId,
          title: data.receipt.subject || 'Weekly Meme Receipt',
          subject: data.receipt.subject || 'Weekly Meme Receipt',
          arcSummary: data.receipt.arcSummary || '',
          narrativeLines: data.receipt.narrativeLines || [],
          verdict: data.receipt.verdict || '',
          createdAt: Date.now(),
        });
      }
    } catch {
      const currentUserId = interactions[0]?.userId || 'anonymous';
      setReceipt({
        id: `receipt_${Date.now()}`,
        userId: currentUserId,
        title: 'Weekly Meme Receipt',
        subject: "chronicle.exe has reviewed the evidence 💀",
        arcSummary: "You endured the plot, held your ground, and survived another week.",
        narrativeLines: [
          { day: "Monday", event: "Claimed everything was fine while everything was clearly on fire." },
          { day: "Midweek", event: "Emergency reset, deep breathing, and sheer determination." },
          { day: "Friday", event: "We made it. Witnesses confirmed." },
        ],
        verdict: "Certified survivor. Anyway, proud of you. 🫡",
        createdAt: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !receipt || isSendingEmail) return;

    try {
      setIsSendingEmail(true);
      setEmailStatus(null);
      const res = await fetch('/api/chronicle/send-receipt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recipientEmail,
          receipt,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmailStatus(`Dispatched! Chronicle weekly meme receipt sent to ${recipientEmail}`);
      } else {
        setEmailStatus(data.error || 'Failed to dispatch receipt email.');
      }
    } catch (err: any) {
      setEmailStatus(err?.message || 'Error delivering meme email.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card (Dark Sanctuary Obsidian Theme) */}
      <div className="relative w-full max-w-lg bg-[#0F0F18] rounded-2xl shadow-2xl border border-[#26263A] overflow-hidden z-10 animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-[#232336] bg-[#141422] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#201726] border border-[#FF6B4A]/30 flex items-center justify-center text-lg shadow-xs">
              💀
            </div>
            <div>
              <h2 className="font-serif text-base text-[#F3F0EB] font-semibold leading-tight flex items-center gap-2">
                <span>Chronicle Weekly Meme Evidence</span>
              </h2>
              <p className="text-[11px] text-[#8E8A9F] font-sans font-light">
                What your week actually looked like to your attentive companion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8A9F] hover:text-[#F3F0EB] hover:bg-[#1E1E2E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-serif italic text-sm text-[#F3F0EB]">
                Chronicle is reviewing the evidence...
              </p>
              <p className="text-xs text-[#8E8A9F]">
                Cataloging the plot twists, late-night venting, and emotional survival
              </p>
            </div>
          ) : receipt ? (
            <div className="space-y-5">
              {/* Receipt Ticket Card with Retro Escaped Terminal Feel */}
              <div className="p-5 rounded-2xl bg-[#101018] border border-[#2B2B3E] shadow-2xl space-y-4 relative font-mono">
                {/* Washi tape on top */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-5 tape-strip rounded-xs z-10" />

                <div className="border-b border-dashed border-[#34344C] pb-3 text-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#FF6B4A] font-bold block mb-1">
                    chronicle.exe has reviewed your week 💀
                  </span>
                  <h3 className="font-mono text-lg sm:text-xl text-[#FFFFFF] font-bold">
                    {receipt.subject}
                  </h3>
                  <p className="text-xs text-[#A8A4B8] font-hand text-base mt-1.5 italic">
                    &ldquo;{receipt.arcSummary}&rdquo;
                  </p>
                </div>

                {/* ASCII Visual Chaos/Recovery Gauge */}
                <div className="p-3 bg-[#0A0A10] rounded-xl border border-white/5 space-y-1 text-xs">
                  <div className="text-[10px] uppercase text-[#8E8A9F] tracking-wider mb-1">
                    YOUR WEEK:
                  </div>
                  <div className="text-[#FF6B4A] tracking-wider font-bold">
                    █████████ chaos
                  </div>
                  <div className="text-amber-400/80 tracking-wider">
                    ████
                  </div>
                  <div className="text-indigo-400/80 tracking-wider">
                    ██
                  </div>
                  <div className="text-emerald-400 tracking-wider font-bold">
                    ███████ recovery
                  </div>
                  <div className="text-center text-[#8E8A9F] pt-1">
                    &darr;
                  </div>
                </div>

                {/* Timeline Breakdown */}
                <div className="space-y-2 py-1">
                  {receipt.narrativeLines &&
                    receipt.narrativeLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 text-xs text-[#EDEDF5] p-2.5 rounded-lg bg-[#0C0C14] border border-[#222234]"
                      >
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[#FF6B4A] shrink-0 pt-0.5">
                          {line.day}
                        </span>
                        <span className="font-light leading-relaxed text-[#D5D2E0]">{line.event}</span>
                      </div>
                    ))}
                </div>

                {/* Verdict / Meme Tagline */}
                <div className="border-t border-dashed border-[#34344C] pt-3 text-center">
                  <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#FF6B4A] block mb-1">
                    CHRONICLE VERDICT
                  </span>
                  <p className="font-hand text-xl text-[#FFFFFF] font-bold mb-1">
                    &ldquo;bro really thought Thursday was going to be normal&rdquo;
                  </p>
                  <p className="text-xs text-[#8E8A9F] italic font-serif">
                    {receipt.verdict || "anyway. proud of you."}
                  </p>
                  <div className="mt-2 text-[11px] text-emerald-400/90 font-hand text-base">
                    anyway. proud of you. 🫡
                  </div>
                </div>
              </div>

              {/* Weekly Meme Email Delivery Box */}
              <div className="p-4 rounded-xl bg-[#141422] border border-[#2B2B3E] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F3F0EB] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#FF6B4A]" />
                    <span>Send Weekly Meme Receipt Email</span>
                  </span>
                  <span className="text-[10px] text-[#8E8A9F] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#FF6B4A]" />
                    <span>Every Sunday 8 PM</span>
                  </span>
                </div>

                <form onSubmit={handleSendEmail} className="flex gap-2">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Enter your email to receive this receipt..."
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-[#2B2B3E] bg-[#0A0A10] text-[#F3F0EB] placeholder:text-[#5E5A6D] focus:outline-none focus:border-[#FF6B4A]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSendingEmail || !recipientEmail}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#FF6B4A] to-[#D94A2A] text-white text-xs rounded-lg hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer font-medium shadow-xs"
                  >
                    {isSendingEmail ? (
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>Send Email</span>
                  </button>
                </form>

                {emailStatus && (
                  <div className="p-2.5 rounded-lg bg-[#182618] border border-[#2F4D2F] text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{emailStatus}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-[#8E8A9F]">
              <p>No receipt generated yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#232336] bg-[#141422] flex items-center justify-between">
          <button
            onClick={generateReceipt}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-[#8E8A9F] hover:text-[#F3F0EB] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate evidence</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#222234] text-[#F3F0EB] rounded-xl text-xs font-medium hover:bg-[#2F2F48] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
