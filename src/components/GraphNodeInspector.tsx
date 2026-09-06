import React from 'react';
import { X, Clock, Link2, ArrowUpRight } from 'lucide-react';
import type { GraphNode, JournalInteraction } from '../types';
import { getNodeColor, NODE_TYPE_LABELS } from '../utils/graphNodeColors';

interface GraphNodeInspectorProps {
  node: GraphNode | null;
  interactions: JournalInteraction[];
  onClose: () => void;
  onRevisitSession: (interactionId: string) => void;
}

export const GraphNodeInspector: React.FC<GraphNodeInspectorProps> = ({
  node,
  interactions,
  onClose,
  onRevisitSession,
}) => {
  if (!node) return null;

  const relatedSession =
    node.type === 'session' && node.sourceSessionId
      ? interactions.find((i) => i.id === node.sourceSessionId)
      : undefined;

  const color = getNodeColor(node);

  return (
    <div className="absolute top-4 right-4 w-full max-w-xs bg-[#0F0F1A]/95 backdrop-blur-md rounded-2xl border border-[#2B2B42] shadow-2xl text-[#F3F0EB] z-20 animate-fade-in overflow-hidden">
      <div className="p-4 border-b border-[#232336] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="inline-block text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5"
            style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
          >
            {NODE_TYPE_LABELS[node.type]}
          </span>
          <h3 className="font-serif text-sm font-semibold leading-snug break-words">{node.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg text-[#8E8A9F] hover:text-[#F3F0EB] hover:bg-[#1E1E30] transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 text-xs">
        {node.description && (
          <p className="text-[#D8D4E2] font-sans leading-relaxed">{node.description}</p>
        )}

        {node.mood?.weather && (
          <div className="text-[#A09CB2] font-mono text-[11px]">
            Atmosphere at the time: <span className="text-[#F3F0EB]">{node.mood.weather}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-[#6E6A7D] font-mono text-[10px]">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(node.createdAt).toLocaleDateString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            referenced {node.referenceCount}x
          </span>
        </div>

        {relatedSession && (
          <div className="pt-2 border-t border-white/5 space-y-2">
            <p className="text-[#8E8A9F] text-[11px] font-sans italic line-clamp-2">
              &ldquo;{relatedSession.userPrompt}&rdquo;
            </p>
            <button
              onClick={() => onRevisitSession(relatedSession.id)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#FF5530] text-white font-mono text-[11px] font-medium transition-all cursor-pointer"
            >
              <span>Revisit this session</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
