'use client';

// ============================================
// usePostDraft Hook
// ============================================
// Persiste el draft del post en localStorage
// FIX: Guarda inmediatamente al cambiar de pestaña (visibilitychange)

import { useState, useEffect, useCallback, useRef } from 'react';
import { PostAttachment, CreatePollInput } from '../types';
import { videoEmbedAttachment } from '@/shared/utils/mediaType';

const DRAFT_KEY = 'app:post-draft';
const DEBOUNCE_MS = 500; // Reducido para mejor UX
const DRAFT_EXPIRY_HOURS = 24;

export interface PostDraft {
  title: string;
  content: string;
  categoryId: string;
  /** LEGADO (antes del 1 sep 2026): el video y el GIF vivian aparte. Hoy van
   *  dentro de `attachments` (type 'video/embed' / 'image/gif'); se conservan
   *  los campos para que un borrador viejo se restaure sin perder nada. */
  videoUrl: string;
  gifUrl: string;
  attachments: PostAttachment[];
  poll: CreatePollInput | null;
  savedAt: number;
}

/** La bandeja de medios de un borrador, plegando los campos legado. */
export function draftMediaAttachments(
  draft: Pick<PostDraft, 'attachments' | 'videoUrl' | 'gifUrl'>
): PostAttachment[] {
  const list: PostAttachment[] = [...(draft.attachments || [])];
  if (draft.gifUrl && !list.some(a => a.url === draft.gifUrl)) {
    list.push({ url: draft.gifUrl, name: 'GIF', size: 0, type: 'image/gif' });
  }
  if (draft.videoUrl && !list.some(a => a.url === draft.videoUrl)) {
    list.push(videoEmbedAttachment(draft.videoUrl));
  }
  return list;
}

interface UsePostDraftReturn {
  draft: PostDraft | null;
  saveDraft: (data: Omit<PostDraft, 'savedAt'>) => void;
  clearDraft: () => void;
  hasDraft: boolean;
  lastSaved: Date | null;
  isSaving: boolean;
}

const emptyDraft: Omit<PostDraft, 'savedAt'> = {
  title: '',
  content: '',
  categoryId: '',
  videoUrl: '',
  gifUrl: '',
  attachments: [],
  poll: null,
};

function isExpired(savedAt: number): boolean {
  const hoursElapsed = (Date.now() - savedAt) / (1000 * 60 * 60);
  return hoursElapsed > DRAFT_EXPIRY_HOURS;
}

function hasContent(draft: Omit<PostDraft, 'savedAt'>): boolean {
  return !!(
    draft.title.trim() ||
    draft.content.trim() ||
    draft.videoUrl ||
    draft.gifUrl ||
    draft.attachments.length > 0 ||
    draft.poll
  );
}

export function usePostDraft(): UsePostDraftReturn {
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  // Ref para guardar el pending data en caso de tab switch
  const pendingDataRef = useRef<Omit<PostDraft, 'savedAt'> | null>(null);

  // Guardar inmediatamente (sin debounce)
  const saveImmediately = useCallback((data: Omit<PostDraft, 'savedAt'>) => {
    if (!hasContent(data)) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }

    try {
      const draftWithTimestamp: PostDraft = {
        ...data,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftWithTimestamp));
      setDraft(draftWithTimestamp);
    } catch (error) {
      console.warn('[usePostDraft] Error saving draft:', error);
    }
  }, []);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed: PostDraft = JSON.parse(stored);

        // Check if draft has expired
        if (isExpired(parsed.savedAt)) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }

        // Only restore if there's actual content
        if (hasContent(parsed)) {
          setDraft(parsed);
        }
      }
    } catch (error) {
      console.warn('[usePostDraft] Error loading draft:', error);
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Save draft with debounce
  const saveDraft = useCallback((data: Omit<PostDraft, 'savedAt'>) => {
    // Guardar referencia para visibilitychange/unmount
    pendingDataRef.current = data;

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't save empty drafts
    if (!hasContent(data)) {
      localStorage.removeItem(DRAFT_KEY);
      setDraft(null);
      pendingDataRef.current = null;
      return;
    }

    setIsSaving(true);

    debounceRef.current = setTimeout(() => {
      saveImmediately(data);
      setIsSaving(false);
    }, DEBOUNCE_MS);
  }, [saveImmediately]);

  // Clear draft (call after successful publish)
  const clearDraft = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
    setIsSaving(false);
  }, []);

  // Guardar inmediatamente cuando la página pierde visibilidad o se cierra
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingDataRef.current) {
        // Cancelar debounce y guardar inmediatamente
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        saveImmediately(pendingDataRef.current);
        setIsSaving(false);
      }
    };

    const handleBeforeUnload = () => {
      if (pendingDataRef.current) {
        saveImmediately(pendingDataRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveImmediately]);

  // Cleanup on unmount - guardar pending data
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Guardar al desmontar si hay datos pendientes
      if (pendingDataRef.current && hasContent(pendingDataRef.current)) {
        saveImmediately(pendingDataRef.current);
      }
    };
  }, [saveImmediately]);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: draft !== null && hasContent(draft),
    lastSaved: draft?.savedAt ? new Date(draft.savedAt) : null,
    isSaving,
  };
}
