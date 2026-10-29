'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase';
import {
  Video,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Users,
  Loader2,
  X,
} from 'lucide-react';

interface VideoRoomRow {
  id: string;
  name: string;
  slug: string;
  room_type: string;
  status: string;
  max_participants: number;
  event_id: string | null;
  created_at: string;
  livekit_room_name: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="px-2 py-0.5 text-[10px] font-medium bg-success/10 text-success rounded-full flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
        En vivo
      </span>
    );
  }
  if (status === 'ended') {
    return (
      <span className="px-2 py-0.5 text-[10px] font-medium bg-muted/50 text-muted rounded-full">
        Finalizada
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
      Disponible
    </span>
  );
}

function TypeBadge({ type, hasEvent }: { type: string; hasEvent: boolean }) {
  if (hasEvent) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-400 rounded-full">
        Evento
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 rounded-full">
      Ad-hoc
    </span>
  );
}

interface CreateRoomFormData {
  name: string;
  slug: string;
  max_participants: number;
}

export function VideoRoomsAdmin() {
  const [rooms, setRooms] = useState<VideoRoomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateRoomFormData>({
    name: '',
    slug: '',
    max_participants: 100,
  });

  const loadRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('video_rooms')
        .select('id, name, slug, room_type, status, max_participants, event_id, created_at, livekit_room_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms((data || []) as VideoRoomRow[]);
    } catch (err) {
      console.error('Error loading rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleCopyUrl = useCallback((slug: string) => {
    const url = `${window.location.origin}/call/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) {
      setCreateError('El nombre es obligatorio');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No autenticado');

      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        room_type: 'adhoc',
        max_participants: formData.max_participants,
      };

      if (formData.slug.trim()) {
        body.slug = formData.slug.trim().toLowerCase();
      }

      const response = await fetch('/api/video-calling/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear la sala');
      }

      // Reset form and reload
      setFormData({ name: '', slug: '', max_participants: 100 });
      setShowCreate(false);
      await loadRooms();

      // Auto-copy the new room URL
      if (result.data?.slug) {
        handleCopyUrl(result.data.slug);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsCreating(false);
    }
  }, [formData, loadRooms, handleCopyUrl]);

  // Auto-generate slug from name
  const handleNameChange = useCallback((name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      // Auto-generate slug if user hasn't manually edited it
      slug: prev.slug === slugify(prev.name) || prev.slug === ''
        ? slugify(name)
        : prev.slug,
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  const adhocRooms = rooms.filter(r => !r.event_id);
  const eventRooms = rooms.filter(r => r.event_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-sans font-black text-foreground">Video Rooms</h2>
          <p className="text-sm text-muted mt-1">
            Crea salas ad-hoc y comparte el link. Perfectas para entrevistas o sesiones 1:1.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancelar' : 'Nueva Sala'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="solid-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Crear Sala Ad-hoc</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">
                Nombre de la sala *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Testimonio con Carlos"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">
                URL personalizada (opcional)
              </label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-2.5 bg-muted/20 border border-r-0 border-border rounded-l-lg text-xs text-muted whitespace-nowrap">
                  /call/
                </span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="sesion-1a1"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-r-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                />
              </div>
              <p className="text-[10px] text-muted mt-1">Solo letras minusculas, numeros y guiones</p>
            </div>
          </div>

          <div className="w-full md:w-48">
            <label className="block text-xs text-muted mb-1.5 font-medium">
              Max participantes
            </label>
            <input
              type="number"
              value={formData.max_participants}
              onChange={(e) => setFormData(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 100 }))}
              min={2}
              max={500}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating || !formData.name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                Crear y copiar URL
              </>
            )}
          </button>
        </div>
      )}

      {/* Ad-hoc Rooms */}
      {adhocRooms.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Salas Ad-hoc ({adhocRooms.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {adhocRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                copiedSlug={copiedSlug}
                onCopy={handleCopyUrl}
              />
            ))}
          </div>
        </div>
      )}

      {/* Event Rooms */}
      {eventRooms.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Salas de Eventos ({eventRooms.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {eventRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                copiedSlug={copiedSlug}
                onCopy={handleCopyUrl}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {rooms.length === 0 && (
        <div className="text-center py-12">
          <Video className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">No hay salas creadas todavia</p>
          <p className="text-muted/60 text-xs mt-1">Crea tu primera sala ad-hoc con el boton de arriba</p>
        </div>
      )}
    </div>
  );
}

function RoomCard({
  room,
  copiedSlug,
  onCopy,
}: {
  room: VideoRoomRow;
  copiedSlug: string | null;
  onCopy: (slug: string) => void;
}) {
  const isCopied = copiedSlug === room.slug;

  return (
    <div className="card-interactive p-4 group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">{room.name}</h4>
          <p className="text-xs text-muted font-mono mt-0.5">/call/{room.slug}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={room.status} />
          <TypeBadge type={room.room_type} hasEvent={!!room.event_id} />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted mb-3">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          Max {room.max_participants}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(room.created_at)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onCopy(room.slug)}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            isCopied
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
          }`}
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copiar URL
            </>
          )}
        </button>
        <a
          href={`/call/${room.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-background border border-border text-foreground hover:bg-muted/20 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir
        </a>
      </div>
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}
