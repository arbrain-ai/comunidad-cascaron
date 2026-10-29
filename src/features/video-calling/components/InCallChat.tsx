'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Paperclip, FileText, Loader2 } from 'lucide-react';
import type { InCallChatMessage } from '../types';

interface InCallChatProps {
  messages: InCallChatMessage[];
  onSendMessage: (content: string) => void;
  onSendAttachment?: (file: File, captionContent?: string) => Promise<string | null>;
  isUploadingAttachment?: boolean;
  currentUserId: string;
  prefillContent?: string;
  onClearPrefill?: () => void;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Comma-separated mime list for the file picker. Images render inline,
// the rest as document cards.
const ALLOWED_FILE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
].join(',');

export function InCallChat({
  messages,
  onSendMessage,
  onSendAttachment,
  isUploadingAttachment,
  currentUserId,
  prefillContent,
  onClearPrefill,
}: InCallChatProps) {
  const [input, setInput] = useState('');
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply prefill content when it changes
  useEffect(() => {
    if (prefillContent) {
      setInput(prefillContent);
      onClearPrefill?.();
    }
  }, [prefillContent, onClearPrefill]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-collapse pinned message after 5 chat messages
  const chatMessages = messages.filter(m => !m.is_pinned);
  useEffect(() => {
    if (chatMessages.length >= 5 && !isPinnedCollapsed) {
      setIsPinnedCollapsed(true);
    }
  }, [chatMessages.length, isPinnedCollapsed]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  }, [input, onSendMessage]);

  // Ctrl+V image from clipboard → upload as attachment.
  // We attach this on the input itself rather than a global listener to
  // avoid hijacking paste in chat messages or other inputs of the app.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (!onSendAttachment) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onSendAttachment(file, input.trim());
            setInput('');
            return;
          }
        }
      }
    },
    [onSendAttachment, input],
  );

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onSendAttachment) {
        onSendAttachment(file, input.trim());
        setInput('');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onSendAttachment, input],
  );

  const pinnedMessage = messages.find(m => m.is_pinned);

  return (
    <div className="flex flex-col h-full">
      {/* Mensaje fijo de bienvenida - colapsable */}
      {pinnedMessage && (
        <button
          onClick={() => setIsPinnedCollapsed(!isPinnedCollapsed)}
          className="border-b border-white/10 px-3 py-2 bg-purple-500/5 flex-shrink-0 w-full text-left hover:bg-purple-500/10 transition-colors"
        >
          {isPinnedCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-3 h-3 text-purple-400" />
              </div>
              <span className="text-[11px] text-purple-400 font-medium flex-1">{pinnedMessage.user_name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold text-purple-400">{pinnedMessage.user_name}</span>
                <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-line mt-0.5">
                  {pinnedMessage.content}
                </p>
              </div>
              <ChevronUp className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-1" />
            </div>
          )}
        </button>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {chatMessages.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-8">
            No hay mensajes aun. Se el primero!
          </p>
        ) : (
          chatMessages.map(msg => {
            const isOwn = msg.user_id === currentUserId;
            const hasAvatar = !!msg.user_avatar;
            const attachment = msg.attachment;
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                  {hasAvatar ? (
                    <img src={msg.user_avatar!} alt={msg.user_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#8ab4f8]/20 flex items-center justify-center text-[10px] font-bold text-[#8ab4f8]">
                      {msg.user_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] ${isOwn ? 'text-right' : ''}`}>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-white/90">
                      {isOwn ? 'Tu' : msg.user_name}
                    </span>
                    <span className="text-[10px] text-white/40">{formatTime(msg.timestamp)}</span>
                  </div>

                  {/* Attachment renders ABOVE the optional caption text */}
                  {attachment?.type === 'image' && (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block rounded-xl overflow-hidden border border-white/10 max-w-[260px] mb-1 ${isOwn ? 'ml-auto' : ''}`}
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full h-auto max-h-[280px] object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  {attachment?.type === 'document' && (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors mb-1 ${isOwn ? 'ml-auto' : ''}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#8ab4f8]/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-[#8ab4f8]" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-[12px] text-white/90 truncate">{attachment.name}</p>
                        <p className="text-[10px] text-white/40">{formatBytes(attachment.size)}</p>
                      </div>
                    </a>
                  )}

                  {msg.content && (
                    <div className={`inline-block px-3 py-1.5 rounded-xl text-sm ${
                      isOwn
                        ? 'bg-[#8ab4f8]/20 text-white'
                        : 'bg-white/5 text-white/90'
                    }`}>
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2 items-center">
          {/* File picker — supports images + PDFs + Office docs */}
          {onSendAttachment && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_TYPES}
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAttachment}
                title="Adjuntar imagen o documento"
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {isUploadingAttachment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
            </>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isUploadingAttachment ? 'Subiendo archivo...' : 'Escribe un mensaje...'}
            disabled={isUploadingAttachment}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#8ab4f8]/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isUploadingAttachment}
            className="px-4 py-2 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
