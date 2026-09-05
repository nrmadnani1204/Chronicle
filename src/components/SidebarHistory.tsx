import React, { useState } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  Calendar,
  Sparkles,
  MessageSquare,
  Lightbulb,
  FileText,
  Clock,
  ChevronRight,
  Shield,
} from 'lucide-react';
import type { JournalInteraction, ReflectionMode } from '../types';

interface SidebarHistoryProps {
  interactions: JournalInteraction[];
  activeId: string | null;
  onSelect: (interaction: JournalInteraction) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  userId: string;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  interactions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  userId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');

  const filteredInteractions = interactions.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.userPrompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.geminiResponse && item.geminiResponse.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMode = filterMode === 'all' || item.mode === filterMode;
    return matchesSearch && matchesMode;
  });

  const getModeIcon = (mode: ReflectionMode) => {
    switch (mode) {
      case 'summarize':
        return <FileText className="w-3 h-3 text-blue-600" />;
      case 'brainstorm':
        return <Lightbulb className="w-3 h-3 text-amber-600" />;
      case 'chat':
        return <MessageSquare className="w-3 h-3 text-purple-600" />;
      case 'reflect':
      default:
        return <Sparkles className="w-3 h-3 text-emerald-600" />;
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <aside className="w-full md:w-80 lg:w-88 border-r border-[#E5E1DA] bg-[#FAF8F4] flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Action Bar */}
      <div className="p-4 sm:p-5 border-b border-[#E5E1DA] space-y-3.5 bg-[#FAF8F4]">
        <button
          id="sidebar-new-entry-btn"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1A1A] text-[#FBF9F6] hover:bg-[#333333] active:scale-[0.99] transition-all font-medium text-xs uppercase tracking-[0.1em] shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Reflection</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#A09D96] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="sidebar-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search past reflections..."
            className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E1DA] bg-white focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-[#1A1A1A] placeholder:text-[#A09D96] transition-colors"
          />
        </div>

        {/* Mode Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] uppercase tracking-wider font-semibold scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'reflect', label: 'Mirror' },
            { id: 'summarize', label: 'Summary' },
            { id: 'brainstorm', label: 'Ideas' },
            { id: 'chat', label: 'Dialogue' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer border ${
                filterMode === tab.id
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-[#716E68] border-[#E5E1DA] hover:text-[#1A1A1A] hover:bg-[#FAF8F4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List of past entries */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E1DA]/40 p-2.5 space-y-1.5">
        {filteredInteractions.length === 0 ? (
          <div className="py-12 px-4 text-center text-[#716E68] space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-[#C8B6A6] stroke-1" />
            <p className="text-xs font-serif italic text-[#1A1A1A]">
              {searchTerm ? 'No matching reflections found' : 'No reflections recorded yet'}
            </p>
            <p className="text-[11px] text-[#A09D96] max-w-[200px] mx-auto leading-relaxed">
              {searchTerm
                ? 'Try adjusting your search terms or filter.'
                : 'Click "New Reflection" above to begin your first entry.'}
            </p>
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const isSelected = activeId === item.id;
            return (
              <div
                key={item.id}
                id={`sidebar-entry-${item.id}`}
                onClick={() => onSelect(item)}
                className={`group relative p-3.5 rounded-xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-white border-[#E5E1DA] shadow-xs'
                    : 'bg-transparent border-transparent hover:bg-white/80 hover:border-[#E5E1DA]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-[#C8B6A6] font-semibold block mb-1">
                      {formatDate(item.updatedAt || item.createdAt)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">{getModeIcon(item.mode)}</span>
                      <h3
                        className={`font-serif text-sm leading-tight truncate ${
                          isSelected ? 'text-[#1A1A1A] font-medium' : 'text-[#1A1A1A]'
                        }`}
                      >
                        {item.title || 'Untitled Reflection'}
                      </h3>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    id={`delete-entry-${item.id}`}
                    onClick={(e) => onDelete(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#A09D96] hover:text-red-700 hover:bg-red-50 transition-all cursor-pointer"
                    title="Delete reflection"
                    aria-label="Delete reflection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-[#716E68] line-clamp-2 mt-1.5 leading-relaxed font-sans font-light">
                  {item.userPrompt}
                </p>

                <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-[#E5E1DA]/60 text-[10px] text-[#A09D96]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(item.updatedAt || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {item.messages && item.messages.length > 2 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FAF8F4] border border-[#E5E1DA] text-[#716E68] text-[9px] uppercase tracking-wider font-medium">
                      {Math.floor(item.messages.length / 2)} turns
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Isolation Security Footer */}
      <div className="p-3.5 border-t border-[#E5E1DA] bg-[#FAF8F4] text-[10px] text-[#716E68] flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-[#C8B6A6] shrink-0" />
        <span className="truncate uppercase tracking-wider text-[9px] font-medium">
          Protected: <code className="font-mono text-[#1A1A1A] lowercase">/users/{userId.slice(0, 6)}...</code>
        </span>
      </div>
    </aside>
  );
};
