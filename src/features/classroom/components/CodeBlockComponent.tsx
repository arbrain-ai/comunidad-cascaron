'use client';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { useState } from 'react';

export const CodeBlockComponent = ({ node }: { node: any }) => {
  const [copied, setCopied] = useState(false);
  const language = node.attrs.language || 'plaintext';

  const handleCopy = async () => {
    try {
      const code = node.textContent;
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <NodeViewWrapper className="relative code-block-wrapper my-4">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface/50 border border-primary/20 rounded-t-lg backdrop-blur-sm">
        <span className="text-xs font-mono text-muted uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all hover:bg-primary/10 text-foreground/80 hover:text-foreground"
          title="Copy code"
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="!mt-0 !rounded-t-none">
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  );
};
