import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  return (
    <div
      className={`prose prose-stone max-w-none text-[#1A1A1A] leading-relaxed space-y-3 font-sans font-light ${className}`}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-2xl font-normal text-[#1A1A1A] mt-4 mb-2 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-xl font-normal text-[#1A1A1A] mt-3 mb-2 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-lg font-normal text-[#1A1A1A] mt-3 mb-1.5 tracking-tight">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-[15px] leading-relaxed text-[#1A1A1A] font-light my-2">
              {children}
            </p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#C8B6A6] pl-4 my-3 italic font-serif text-[#716E68] bg-[#FAF8F4]/50 py-1 rounded-r">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1 text-[14px] text-[#1A1A1A]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1 text-[14px] text-[#1A1A1A]">
              {children}
            </ol>
          ),
          code: ({ children, className }) => (
            <code className={`px-1.5 py-0.5 rounded bg-[#FAF8F4] border border-[#E5E1DA] text-[#1A1A1A] font-mono text-xs ${className || ''}`}>
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

