'use client';

import { useState, useEffect, useRef } from 'react';
import { LocationInput as LocationInputType, LocationSearchResult } from '../types';

interface LocationInputProps {
  value: LocationInputType | null;
  onChange: (location: LocationInputType | null) => void;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export function LocationInput({
  value,
  onChange,
  visible,
  onVisibilityChange,
}: LocationInputProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize search with current value
  useEffect(() => {
    if (value) {
      setSearch(`${value.city}, ${value.country}`);
    }
  }, []);

  // Search locations using Nominatim (OpenStreetMap)
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );
      const data = await response.json();

      const locations: LocationSearchResult[] = data.map((item: any) => ({
        display_name: item.display_name,
        city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || item.name,
        country: item.address?.country || '',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));

      setResults(locations);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching locations:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchLocations(value);
    }, 500);
  };

  // Select a location from results
  const handleSelect = (location: LocationSearchResult) => {
    setSearch(`${location.city}, ${location.country}`);
    onChange({
      city: location.city,
      country: location.country,
      lat: location.lat,
      lng: location.lng,
    });
    setShowResults(false);
  };

  // Clear location
  const handleClear = () => {
    setSearch('');
    onChange(null);
    setResults([]);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Ubicación
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-muted">Mostrar en mapa</span>
        </label>
      </div>

      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Buscar ciudad..."
            className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
          {value && !isSearching && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 rounded-lg border border-border/30 shadow-lg max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="font-medium">{result.city}</div>
                <div className="text-xs text-muted truncate">{result.display_name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {value && (
        <p className="text-xs text-muted">
          {value.city}, {value.country}
        </p>
      )}
    </div>
  );
}
