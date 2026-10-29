'use client';

import { useState, useEffect } from 'react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { X, Search } from 'lucide-react';

// GIPHY API key - Get yours at https://developers.giphy.com/
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || '';

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
  variant?: 'modal' | 'dropdown';
}

export function GifPicker(props: GifPickerProps) {
  const { isOpen, onClose, onSelect } = props;
  // Always use modal on mobile for better UX
  const [search, setSearch] = useState('');
  const [gf, setGf] = useState<GiphyFetch | null>(null);
  const [gridWidth, setGridWidth] = useState(300);

  useEffect(() => {
    if (GIPHY_API_KEY) {
      setGf(new GiphyFetch(GIPHY_API_KEY));
    }
  }, []);

  // Calculate grid width based on container
  useEffect(() => {
    const updateWidth = () => {
      // Account for padding (32px total) and max container width
      const containerWidth = Math.min(window.innerWidth - 32, 400);
      setGridWidth(containerWidth - 32); // 32px for internal padding
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (!isOpen) return null;

  const fetchGifs = (offset: number) => {
    if (!gf) {
      return Promise.resolve({
        data: [],
        pagination: { total_count: 0, count: 0, offset: 0 },
        meta: { status: 200, msg: 'OK', response_id: '' }
      });
    }

    if (search.trim()) {
      return gf.search(search, { offset, limit: 10 });
    }
    return gf.trending({ offset, limit: 10 });
  };

  const handleGifClick = (gif: any, e: any) => {
    e.preventDefault();
    onSelect(gif.images.fixed_height.url);
    onClose();
  };

  // Shared content for both variants
  const GifContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">
            Buscar GIF
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar GIFs..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            autoFocus
          />
        </div>
      </div>

      {/* GIF Grid */}
      <div className="p-4 max-h-80 overflow-y-auto overscroll-contain">
        {!GIPHY_API_KEY ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-3xl">🎬</div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Configura tu GIPHY API Key
              </p>
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://developers.giphy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  developers.giphy.com
                </a>
              </p>
            </div>

            {/* Manual URL input fallback */}
            <div className="pt-3 border-t border-border/20">
              <p className="text-xs text-muted-foreground mb-2">O pega una URL:</p>
              <input
                type="url"
                placeholder="https://media.giphy.com/..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value) {
                      onSelect(input.value);
                      onClose();
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
          </div>
        ) : gf ? (
          <Grid
            key={search}
            width={gridWidth}
            columns={2}
            fetchGifs={fetchGifs}
            onGifClick={handleGifClick}
            noLink={true}
            hideAttribution={true}
          />
        ) : (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* GIPHY Attribution */}
      {GIPHY_API_KEY && (
        <div className="p-2 border-t border-border/20 text-center">
          <span className="text-xs text-muted-foreground">Powered by GIPHY</span>
        </div>
      )}
    </>
  );

  // Always use modal - better UX on all devices
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - slides up on mobile, centered on desktop */}
      <div className="relative w-full max-w-md mx-4 mb-0 sm:mb-0 glass-panel rounded-t-2xl sm:rounded-2xl border border-border/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <GifContent />
      </div>
    </div>
  );
}
