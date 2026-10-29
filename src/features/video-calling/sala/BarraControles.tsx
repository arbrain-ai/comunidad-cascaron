'use client';

// ============================================
// SALA v2 - la barra de controles (participante y anfitrion)
// ============================================
// Regla: todo lo que hace el anfitrion lleva TEXTO y cabe en movil. Un solo
// boton rojo en pantalla: colgar. Los controles del anfitrion van en su propia
// fila (arriba de la barra) para que en 390 px no se corte nada.

import { useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Smile, Hand, MessageCircle, PhoneOff, MoreVertical, Users, Lock, Timer, VolumeX,
} from 'lucide-react';
import type { Modo } from '../services/salaService';
import type { BackgroundEffectMode } from '../hooks/useBackgroundEffect';
import { REACTIONS } from '../hooks/useReactions';
import { MoreMenu } from '../components/MoreMenu';
import { ControlesAnfitrion } from './ControlesAnfitrion';
import { InCallSettings } from '../components/InCallSettings';
import { BackgroundSelector } from '../components/BackgroundSelector';
import type { VideoLayoutMode } from '../types';

export interface BarraProps {
  // Estado de mis medios
  micAbierto: boolean;
  camaraAbierta: boolean;
  compartiendo: boolean;
  puedoMicrofono: boolean;
  puedoCamara: boolean;
  puedoPantalla: boolean;
  conTurno: boolean;
  manoLevantada: boolean;
  modo: Modo;
  gobierna: boolean;
  personas: number;
  chatSinLeer: number;
  chatAbierto: boolean;
  genteAbierta: boolean;
  manosLevantadas: number;
  vista: VideoLayoutMode;
  pantallaCompleta: boolean;
  // Acciones
  onMic: () => void;
  onCamara: () => void;
  onPantalla: () => void;
  /** Cambiar la ventana compartida sin cortar la pantalla (replaceTrack, mismo SID). */
  onCambiarVentana?: () => void;
  onMano: () => void;
  onCederPalabra: () => void;
  onReaccion: (emoji: string) => void;
  onChat: () => void;
  onGente: () => void;
  onSilenciarTodos: () => Promise<void>;
  onModo: (modo: Modo) => Promise<void>;
  onVista: (v: VideoLayoutMode) => void;
  onPantallaCompleta: () => void;
  onSalir: () => void;
  /** Presenting without sound (23 sep 2026): shown where the presenter looks, until dismissed. */
  avisoSinSonido?: string | null;
  onEntendidoSinSonido?: () => void;
  // Ajustes
  backgroundMode?: BackgroundEffectMode;
  onChangeBackground?: (m: BackgroundEffectMode) => void;
  isBackgroundSupported?: boolean;
}

function Redondo({ activo, apagado, bloqueado, title, onClick, children, testid, className = '' }: {
  activo?: boolean; apagado?: boolean; bloqueado?: boolean; title: string; onClick: () => void; children: React.ReactNode; testid?: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueado}
      title={title}
      aria-label={title}
      data-testid={testid}
      className={`sala-control relative md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
        bloqueado ? 'bg-[#2a2a2e] text-white/35 cursor-not-allowed' : apagado ? 'bg-[#3a3034] hover:bg-[#44373d] text-[#f4b8b5]' : activo ? 'bg-[var(--primary)] text-white' : 'bg-[#2a2a2e] hover:bg-[#3a3a3f] text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function BarraControles(p: BarraProps) {
  const [reacciones, setReacciones] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [fondos, setFondos] = useState(false);
  const micBloqueado = !p.puedoMicrofono;

  return (
    <div className="bg-[#161618] border-t border-white/[0.06] flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
      {p.compartiendo && (
        <div className="bg-blue-950/60" data-testid="presentacion-activa">
          {p.avisoSinSonido && (
            <div role="alert" className="flex items-start sm:items-center justify-center gap-2 px-3 py-2 bg-amber-400/15 border-b border-amber-300/30 text-amber-50" data-testid="aviso-sin-sonido">
              <VolumeX className="w-4 h-4 mt-0.5 sm:mt-0 shrink-0 text-amber-200" />
              <p className="text-sm leading-snug max-w-3xl">{p.avisoSinSonido}</p>
              {p.onEntendidoSinSonido && (
                <button type="button" onClick={p.onEntendidoSinSonido} className="shrink-0 min-h-9 px-3 rounded-lg border border-amber-200/40 text-amber-100 text-xs font-semibold hover:bg-amber-300/10" data-testid="aviso-sin-sonido-entendido">Entendido</button>
              )}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 px-2 py-2">
            <span className="text-xs text-blue-100">{p.avisoSinSonido ? 'Estás compartiendo sin sonido' : 'Estás compartiendo'}</span>
            {/* Solo donde hay getDisplayMedia (en movil casi nunca): misma regla que Compartir pantalla. */}
            {p.onCambiarVentana && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && (
              <button type="button" onClick={p.onCambiarVentana} data-testid="cambiar-ventana" title="Elegir otra ventana o pestaña sin dejar de compartir"
                className="min-h-10 rounded-lg px-3 border border-blue-100/40 text-blue-100 text-sm font-semibold hover:bg-blue-100/10 flex items-center gap-2">
                <MonitorUp className="w-4 h-4 shrink-0" />Cambiar ventana
              </button>
            )}
            <button type="button" onClick={p.onPantalla} data-testid="dejar-de-compartir"
              className="min-h-10 rounded-lg px-3 bg-blue-100 text-blue-950 text-sm font-semibold hover:bg-white flex items-center gap-2">
              <MonitorOff className="w-4 h-4 shrink-0" />Dejar de compartir
            </button>
          </div>
        </div>
      )}
      {/* Fila del anfitrion: en MOVIL vive aqui (arriba de la barra); en escritorio, en la barra superior. */}
      {p.gobierna && (
        <div className="flex md:hidden items-center justify-center gap-2 px-2 pt-2 pb-1 flex-wrap" data-testid="fila-anfitrion">
          <ControlesAnfitrion modo={p.modo} onSilenciarTodos={p.onSilenciarTodos} onModo={p.onModo} manosLevantadas={p.manosLevantadas} onGente={p.onGente} />
        </div>
      )}

      <div className="px-2 py-2 md:px-4 md:py-3 flex items-center justify-center">
        {/* UN solo grupo centrado (critico ciego, ronda 1: la barra partida en dos
            clusters dejaba un hueco muerto y el colgar-pill rompia el ritmo). */}
        <div className="flex items-center gap-0.5 md:gap-2">
          {/* Microfono: bloqueado sin turno en clase */}
          <Redondo
            onClick={p.onMic}
            apagado={!p.micAbierto && !micBloqueado}
            bloqueado={micBloqueado}
            title={micBloqueado ? (p.modo === 'clase' ? 'Micrófono cerrado: levanta la mano para pedir la palabra' : 'Micrófono no permitido') : p.micAbierto ? 'Silenciar mi micrófono' : 'Activar mi micrófono'}
            testid="boton-mic"
          >
            {micBloqueado ? <Lock className="w-4 h-4 md:w-5 md:h-5" /> : p.micAbierto ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
          </Redondo>
          <Redondo onClick={p.onCamara} apagado={!p.camaraAbierta} bloqueado={!p.puedoCamara} title={p.camaraAbierta ? 'Apagar cámara' : 'Encender cámara'} testid="boton-camara">
            {p.camaraAbierta ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <VideoOff className="w-4 h-4 md:w-5 md:h-5" />}
          </Redondo>
          {(
            <Redondo onClick={p.onPantalla} activo={p.compartiendo} title={p.compartiendo ? 'Dejar de compartir pantalla' : !p.puedoPantalla ? (p.modo === 'clase' ? 'Pide la palabra para compartir pantalla' : 'Compartir pantalla desactivado') : 'Compartir pantalla'} className={`hidden md:flex ${!p.puedoPantalla && !p.compartiendo ? "opacity-60" : ""}`} testid="boton-pantalla">
              {p.compartiendo ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </Redondo>
          )}
          {/* Mano / ceder */}
          {p.conTurno ? (
            <button onClick={p.onCederPalabra} className="sala-control flex items-center justify-center md:gap-1.5 md:h-12 md:w-auto md:px-3 rounded-2xl bg-emerald-500 text-black text-xs font-semibold" title="Ceder la palabra" data-testid="boton-ceder">
              <Timer className="w-4 h-4" /><span className="hidden md:inline">Ceder la palabra</span>
            </button>
          ) : (
            <Redondo onClick={p.onMano} activo={p.manoLevantada} title={p.manoLevantada ? 'Bajar la mano' : p.modo === 'clase' ? 'Pedir la palabra' : 'Levantar la mano'} testid="boton-mano">
              <Hand className="w-4 h-4 md:w-5 md:h-5" />
            </Redondo>
          )}
          <div className="relative hidden md:block">
            {reacciones && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 titanium-panel rounded-2xl p-2 flex gap-1 shadow-2xl">
                {REACTIONS.map(({ emoji, label }) => (
                  <button key={emoji} onClick={() => { p.onReaccion(emoji); setReacciones(false); }} title={label} className="w-10 h-10 rounded-xl hover:bg-white/10 text-2xl">{emoji}</button>
                ))}
              </div>
            )}
            <Redondo onClick={() => setReacciones((v) => !v)} activo={reacciones} title="Reacciones"><Smile className="w-5 h-5" /></Redondo>
          </div>
          <div className="relative">
            {menu && (
              <MoreMenu
                layout={p.vista}
                isFullscreen={p.pantallaCompleta}
                isBackgroundSupported={p.isBackgroundSupported}
                onChangeLayout={p.onVista}
                onToggleFullscreen={p.onPantallaCompleta}
                onOpenSettings={() => { setMenu(false); setAjustes(true); }}
                onOpenBackgroundSelector={p.onChangeBackground ? () => { setMenu(false); setFondos(true); } : undefined}
                onClose={() => setMenu(false)}
              />
            )}
            {ajustes && (
              <InCallSettings
                onClose={() => setAjustes(false)}
              />
            )}
            {fondos && p.onChangeBackground && p.backgroundMode !== undefined && (
              <BackgroundSelector currentMode={p.backgroundMode} onChangeMode={p.onChangeBackground} onClose={() => setFondos(false)} />
            )}
            <Redondo onClick={() => { if (ajustes) setAjustes(false); else if (fondos) setFondos(false); else setMenu((v) => !v); }} activo={menu || ajustes || fondos} title="Más opciones">
              <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
            </Redondo>
          </div>

          <div className="hidden md:block w-px h-7 bg-white/15 mx-0.5" />

          {/* Gente y chat: en el mismo grupo, mismo tamaño */}
          <Redondo onClick={p.onGente} activo={p.genteAbierta} title="Gente en la sala" testid="boton-gente">
            <Users className="w-4 h-4 md:w-5 md:h-5" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-black text-3xs font-bold flex items-center justify-center tabular-nums">{p.personas}</span>
            {p.manosLevantadas > 0 && <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-black text-3xs font-bold flex items-center justify-center">{p.manosLevantadas}</span>}
          </Redondo>
          <Redondo onClick={p.onChat} activo={p.chatAbierto} title="Chat" testid="boton-chat">
            <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
            {p.chatSinLeer > 0 && !p.chatAbierto && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-3xs font-bold flex items-center justify-center">{p.chatSinLeer > 99 ? '99+' : p.chatSinLeer}</span>}
          </Redondo>

          <div className="hidden md:block w-px h-7 bg-white/15 mx-0.5" />

          {/* Colgar: el UNICO rojo, redondo como los demas */}
          <button onClick={p.onSalir} title="Salir de la clase" aria-label="Salir de la clase" className="sala-control bg-[#ea4335] hover:bg-[#d33426] text-white rounded-2xl flex items-center justify-center" data-testid="boton-salir">
            <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
