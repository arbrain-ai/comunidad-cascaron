'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { BRAND } from '@/shared/config/brand';
import { Mic, MicOff, Video, VideoOff, Settings, ChevronDown, Monitor, Volume2, Users, DoorOpen, ScanLine } from 'lucide-react';
import type { VideoRoomWithDetails, VideoPermissions } from '../types';
import type { PreferenciasEntrada } from '../hooks/useVideoRoom';
import { abrirCamaraConGuardia, avisoDeFormato, type FormatoCamara } from '../sala/useFormatoCamara';
import { retireNoisePreference, voiceCaptureConstraints } from '../services/voiceCapturePolicy';
import { readMudanza } from '../sala/mudanzaPolicy';
import { AvisoMudanza } from '../sala/Mudanza';

interface RoomLobbyProps {
  room: VideoRoomWithDetails;
  permissions: VideoPermissions;
  onJoin: (preferences: PreferenciasEntrada) => Promise<boolean> | void;
  onCancel: () => void;
  joinError?: string | null;
  initialMedia?: { audio: boolean; video: boolean };
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

function DeviceSelector({
  devices,
  selectedId,
  onSelect,
  icon: Icon,
  label,
}: {
  devices: MediaDeviceInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
  icon: React.ElementType;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (devices.length === 0) return null;

  const selected = devices.find(d => d.deviceId === selectedId) || devices[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:border-violet-500/30 transition-colors"
      >
        <Icon className="w-4 h-4 text-violet-400/60 flex-shrink-0" />
        <span className="truncate flex-1 text-left">{selected?.label || label}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-violet-500/20 rounded-lg shadow-xl shadow-violet-500/5 z-10 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-violet-500/30 scrollbar-track-transparent">
          {devices.map(device => (
            <button
              key={device.deviceId}
              onClick={() => { onSelect(device.deviceId); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                device.deviceId === selectedId
                  ? 'bg-violet-500/10 text-violet-300'
                  : 'text-white/70 hover:bg-white/5'
              }`}
            >
              {device.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomLobby({ room, permissions, onJoin, onCancel, joinError, initialMedia }: RoomLobbyProps) {
  useEffect(() => {
    try { retireNoisePreference(window.localStorage); } catch { /* Storage may be unavailable. */ }
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const entregados = useRef(false);
  const [joining, setJoining] = useState(false);
  const joiningRef = useRef(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialMedia?.audio ?? true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialMedia?.video ?? true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [formato, setFormato] = useState<FormatoCamara | null>(null);
  const [abriendoCamara, setAbriendoCamara] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'audio' | 'video'>('audio');
  const requiresConsent = room.room_settings?.require_recording_consent ?? true;

  // Device enumeration
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput' && d.deviceId);
      const speakers = devices.filter(d => d.kind === 'audiooutput' && d.deviceId);
      const cameras = devices.filter(d => d.kind === 'videoinput' && d.deviceId);

      setAudioInputs(mics);
      setAudioOutputs(speakers);
      setVideoInputs(cameras);

      if (!selectedMic && mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (!selectedSpeaker && speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);
      if (!selectedCamera && cameras.length > 0) setSelectedCamera(cameras[0].deviceId);
    } catch (err) {
      console.error('[RoomLobby] Failed to enumerate devices:', err);
    }
  }, [selectedMic, selectedSpeaker, selectedCamera]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let cancelado = false;
    const tracks: MediaStreamTrack[] = [];

    async function startPreview() {
      try {
        stream?.getTracks().forEach(track => track.stop());
        setAbriendoCamara(true);
        setMediaError(null);

        if (isAudioEnabled) {
          // Las MISMAS opciones que la sala: lo que se oye en el lobby es lo que se publica.
          const a = await navigator.mediaDevices.getUserMedia({
            audio: voiceCaptureConstraints(selectedMic),
          });
          tracks.push(...a.getAudioTracks());
          if (cancelado) { tracks.forEach(t => t.stop()); return; }
        }

        if (isVideoEnabled) {
          // LA GUARDIA DE FORMATO (5 sep 2026): pide 16:9, lee lo que la camara
          // entrega y lo muestra. Este track es el que se publica en la sala.
          const { track, formato: f } = await abrirCamaraConGuardia(selectedCamera || undefined);
          if (cancelado) { track.stop(); tracks.forEach(t => t.stop()); return; }
          tracks.push(track);
          setFormato(f);
        } else {
          setFormato(null);
        }

        if (cancelado) { tracks.forEach(t => t.stop()); return; }
        const mediaStream = new MediaStream(tracks);
        currentStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current && isVideoEnabled) {
          videoRef.current.srcObject = mediaStream;
        }

        await enumerateDevices();
      } catch (err) {
        console.error('[RoomLobby] Failed to access media devices:', err);
        if (!cancelado) { setFormato(null); setStream(null); setMediaError('No pudimos abrir tu cámara o micrófono. Puedes entrar sin ellos y activarlos dentro de la sala.'); }
        tracks.forEach(t => t.stop());
      } finally {
        if (!cancelado) setAbriendoCamara(false);
      }
    }

    if (isAudioEnabled || isVideoEnabled) {
      startPreview();
    } else {
      setAbriendoCamara(false);
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
      setFormato(null);
    }

    return () => {
      cancelado = true;
      // Al entrar, los tracks viajan a la sala (entregados = true): no se detienen aqui.
      if (!entregados.current) {
        currentStream?.getTracks().forEach(track => track.stop());
        tracks.forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAudioEnabled, isVideoEnabled, selectedMic, selectedCamera]);

  useEffect(() => {
    enumerateDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El <video> del preview se monta DESPUES de que llega el stream (solo existe
  // si hay stream): el srcObject se asigna aqui, cuando ya existen los dos.
  useEffect(() => {
    if (videoRef.current && stream && isVideoEnabled) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isVideoEnabled]);

  const canJoin = permissions.can_join && (!requiresConsent || hasConsented) && !abriendoCamara && !joining;
  const aviso = avisoDeFormato(isVideoEnabled ? formato : null);

  const mudanza = readMudanza(room.active_session?.metadata);
  return (
    // h-full, not min-h: the call page is a fixed, overflow-hidden frame, so a min-height root
    // grew past the screen and the join button was clipped on short laptops (28 sep class).
    // Centering is my-auto on the child: it collapses to 0 when the content overflows.
    <div className="h-full bg-zinc-950 flex items-start justify-center px-4 overflow-y-auto overscroll-contain">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      <div className="relative w-full max-w-2xl z-10 my-auto pt-4">
        {/* Logo + Room info */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Image
              src="/logo.png"
              alt={BRAND.name}
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-sm font-medium text-violet-300/80 tracking-wide uppercase">
              {BRAND.shortName}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-white/40 text-sm">
            <Users className="w-3.5 h-3.5" />
            <span>
              {room.participant_count} participante{room.participant_count !== 1 ? 's' : ''} en la sala
            </span>
          </div>
        </div>

        {/* The class moved (23 sep 2026): late arrivals see the new link before entering. */}
        {mudanza && <div className="-mx-2 md:-mx-4 mb-4"><AvisoMudanza mudanza={mudanza} gobierna={false} /></div>}

        <div className="flex flex-col md:flex-row gap-4">
          {/* Video preview */}
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-xl shadow-violet-500/5"
                 style={{ background: 'rgba(24, 24, 27, 0.85)', backdropFilter: 'blur(24px)' }}>
              <div className="relative aspect-video flex items-center justify-center bg-zinc-900/80">
                {isVideoEnabled && stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/40">
                    <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <VideoOff className="w-8 h-8 text-violet-400" />
                    </div>
                    <span className="text-sm">Camara desactivada</span>
                  </div>
                )}

                {/* Mic/Camera/Settings controls overlay */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isAudioEnabled
                        ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-white/10'
                        : 'bg-red-500/90 hover:bg-red-600 text-white border border-red-400/30'
                    }`}
                    title={isAudioEnabled ? 'Silenciar microfono' : 'Activar microfono'}
                  >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isVideoEnabled
                        ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-white/10'
                        : 'bg-red-500/90 hover:bg-red-600 text-white border border-red-400/30'
                    }`}
                    title={isVideoEnabled ? 'Apagar camara' : 'Encender camara'}
                  >
                    {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      showSettings
                        ? 'bg-violet-500 text-white border border-violet-400/30'
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-white/10'
                    }`}
                    title="Configuracion"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="w-full md:w-72 rounded-2xl border border-white/[0.06] flex flex-col overflow-hidden flex-shrink-0 shadow-xl shadow-violet-500/5"
                 style={{ background: 'rgba(24, 24, 27, 0.85)', backdropFilter: 'blur(24px)' }}>
              {/* Tabs */}
              <div className="flex border-b border-white/[0.06]">
                {(['audio', 'video'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                      settingsTab === tab
                        ? 'text-violet-300 border-b-2 border-violet-500'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {tab === 'audio' ? 'Audio' : 'Video'}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4 overflow-y-auto">
                {settingsTab === 'audio' ? (
                  <>
                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block font-medium">Microfono</label>
                      <DeviceSelector
                        devices={audioInputs}
                        selectedId={selectedMic}
                        onSelect={setSelectedMic}
                        icon={Mic}
                        label="Seleccionar microfono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block font-medium">Bocina</label>
                      <DeviceSelector
                        devices={audioOutputs}
                        selectedId={selectedSpeaker}
                        onSelect={setSelectedSpeaker}
                        icon={Volume2}
                        label="Seleccionar bocina"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-xs text-white/60 mb-1.5 block font-medium">Camara</label>
                    <DeviceSelector
                      devices={videoInputs}
                      selectedId={selectedCamera}
                      onSelect={setSelectedCamera}
                      icon={Monitor}
                      label="Seleccionar camara"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recording consent */}
        {requiresConsent && (
          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] mt-4 cursor-pointer transition-colors hover:border-violet-500/20"
                 style={{ background: 'rgba(24, 24, 27, 0.6)' }}>
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => setHasConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-sm text-white/60">
              Acepto que esta llamada puede ser grabada. La grabacion se usara para generar un resumen y estara disponible para los miembros.
            </span>
          </label>
        )}

        {/* La guardia de formato: lo que la camara ENTREGA, no lo que se pidio */}
        {aviso && (
          <div
            className={`flex items-start gap-3 p-3 rounded-xl border mt-4 ${
              aviso.nivel === 'ok' ? 'border-emerald-500/20' : aviso.nivel === 'aviso' ? 'border-amber-500/30' : 'border-red-500/30'
            }`}
            style={{ background: aviso.nivel === 'ok' ? 'rgba(16, 185, 129, 0.05)' : aviso.nivel === 'aviso' ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)' }}
            data-testid={`formato-camara-${aviso.nivel}`}
          >
            <ScanLine className={`w-4 h-4 flex-shrink-0 mt-0.5 ${aviso.nivel === 'ok' ? 'text-emerald-400' : aviso.nivel === 'aviso' ? 'text-amber-400' : 'text-red-400'}`} />
            <p className={`text-xs leading-snug ${aviso.nivel === 'ok' ? 'text-emerald-200/80' : aviso.nivel === 'aviso' ? 'text-amber-200/90' : 'text-red-200/90'}`}>{aviso.texto}</p>
          </div>
        )}

        {/* La sala abre antes del anfitrion (5 sep 2026) */}
        {!room.active_session && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 mt-4" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <DoorOpen className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-200">La sala abre antes de la clase</p>
              <p className="text-xs text-white/40 mt-0.5">Puedes entrar y platicar. Cuando llegue el anfitrión, la sala toma el modo que él elija: Clase (se habla con turno) o Libre (todos pueden hablar).</p>
            </div>
          </div>
        )}

        {(abriendoCamara || mediaError) && <div role="status" className="mt-4 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-100">
          <p>{mediaError || 'Esperando permiso de cámara o micrófono. Si el aviso no aparece, puedes continuar sin ellos.'}</p>
          <button type="button" disabled={joining} className="btn-secondary mt-3" onClick={() => { setIsAudioEnabled(false); setIsVideoEnabled(false); setMediaError(null); }}>Continuar sin cámara ni micrófono</button>
        </div>}
        {/* Join error message */}
        {joinError && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 mt-4"
               style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
            <p className="text-sm text-red-300">{joinError}</p>
          </div>
        )}

        {/* Audio quality advisory — usar audifonos elimina el loop acustico
            que provoco el eco en la clase del 22 Abr. Recordatorio obligado
            hasta que podamos detectarlo programmaticamente. */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
          <Volume2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-amber-200/90 leading-snug">
            <span className="font-semibold">Usa audífonos.</span> Altavoces abiertos generan eco para todos — el cancelador de eco solo filtra al emisor, no al receptor.
          </p>
        </div>

        {/* Action buttons: pinned to the bottom so "Unirse" is always visible, however short the screen */}
        <div className="sticky bottom-0 flex gap-3 mt-4 pt-3 pb-4 bg-zinc-950">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-zinc-800/50 border border-white/[0.06] text-white/70 hover:text-white hover:bg-zinc-700/50 hover:border-white/10 transition-all duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (joiningRef.current) return;
              joiningRef.current = true; setJoining(true);
              entregados.current = true;
              try { const joined = await onJoin({
                audio: isAudioEnabled,
                video: isVideoEnabled,
                audioDeviceId: selectedMic || undefined,
                videoDeviceId: selectedCamera || undefined,
                audioTrack: stream?.getAudioTracks()[0] ?? null,
                videoTrack: stream?.getVideoTracks()[0] ?? null,
                formato,
              });
              if (joined === false) { entregados.current = false; setIsAudioEnabled(false); setIsVideoEnabled(false); setStream(null); }
              } finally { joiningRef.current = false; setJoining(false); }
            }}
            disabled={!canJoin}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
              canJoin
                ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {joining ? 'Conectando…' : 'Unirse a la llamada'}
          </button>
        </div>
      </div>
    </div>
  );
}
