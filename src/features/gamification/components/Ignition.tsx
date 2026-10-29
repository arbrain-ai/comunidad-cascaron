// ============================================
// Ignition v3 — EL ASCENSO (subir de nivel, hecho cine)
// ============================================
// Narrativa en dos actos con corte en flash (técnica de cine: el corte
// se esconde dentro del destello):
//
//   ACTO 1 · EL ASCENSO — oscuridad. Aparece el tramo de escalera: tu
//   nodo viejo abajo (morado, vivo) y el nuevo arriba (hueco, apagado).
//   El nodo viejo SUELTA su luz: un cometa dorado viaja por el riel
//   hacia arriba, el riel queda encendido a su paso, y el nodo nuevo
//   se CARGA con tres pulsos.
//
//   FLASH — un destello blanco-dorado de 2 frames + sacudida de cámara.
//
//   ACTO 2 · LA REVELACIÓN — el nodo nuevo, ya protagonista: el número
//   se ESTAMPA (scale-down con blur de movimiento), anillo cónico
//   girando, halo y chispas anclados al nodo, el nombre del nivel en
//   tipografía gigante con barrido de oro, y los premios flotan hacia
//   su lugar — sin caja, sin tarjeta.
//
// Sin sonido. Sin emojis. Clic durante el acto 1 = saltar al acto 2.
//
// Demo sin ganar puntos reales: /leaderboard?ignicion=N la dispara.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import { getLevelInfo } from '../types';
import { getRungConfig, getThreshold, type LadderPrize } from '../config/levels';

interface IgnitionProps {
  previousLevel: number;
  newLevel: number;
  onDismiss: () => void;
}

const RIG_MS = 2350; // duración del acto 1

function PrizeFace({ prize }: { prize: LadderPrize }) {
  if (prize.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={prize.image}
        alt={prize.title}
        className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 ring-1 ring-gold/30 shadow-[0_6px_28px_rgba(255,145,1,0.22)]"
      />
    );
  }
  const Icon = prize.fallback;
  return (
    <span className="w-16 h-16 rounded-2xl bg-primary/12 ring-1 ring-gold/25 shadow-[0_6px_28px_rgba(139,92,246,0.18)] flex items-center justify-center flex-shrink-0 text-gold">
      <Icon size={28} strokeWidth={1.7} />
    </span>
  );
}

export function Ignition({ previousLevel, newLevel, onDismiss }: IgnitionProps) {
  const [phase, setPhase] = useState<'rig' | 'reveal'>('rig');
  const [flash, setFlash] = useState(false);
  const levelInfo = getLevelInfo(newLevel);
  const rung = getRungConfig(newLevel);
  const threshold = getThreshold(newLevel);

  // Toda la luz del acto 2 emana DEL NODO: se mide dónde quedó y ahí se
  // anclan halo, rayos, ondas y ráfaga.
  const nodeRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (phase !== 'reveal') return;
    const measure = () => {
      const r = nodeRef.current?.getBoundingClientRect();
      if (r) setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [phase]);

  // Chispas de la ráfaga radial: ángulo/distancia deterministas
  const sparks = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        angle: (i / 42) * 360 + (i % 5) * 5,
        dist: 30 + ((i * 37) % 42),
        size: 1.5 + ((i * 13) % 30) / 10,
        delay: ((i * 29) % 22) / 100,
        gold: i % 5 !== 1,
      })),
    []
  );

  const embers = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        left: 6 + ((i * 41) % 88),
        delay: ((i * 53) % 45) / 10,
        duration: 5 + ((i * 17) % 40) / 10,
        size: 2 + ((i * 7) % 3),
        gold: i % 2 === 0,
      })),
    []
  );

  const ignite = () => {
    setFlash(true);
    setPhase('reveal');
    setTimeout(() => setFlash(false), 500);
  };

  // El guion: acto 1 → flash → acto 2 (o clic para saltar)
  useEffect(() => {
    if (phase !== 'rig') return;
    const t = setTimeout(ignite, RIG_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      data-ignition={newLevel}
      data-phase={phase}
    >
      {/* Oscuridad total: el escenario de la luz */}
      <div
        className="absolute inset-0 bg-[#030308]"
        onClick={phase === 'rig' ? ignite : onDismiss}
      />

      {/* ================= ACTO 1 · EL ASCENSO ================= */}
      {phase === 'rig' && (
        <div className="ign3-rig relative flex flex-col items-center pointer-events-none select-none">
          {/* El nodo NUEVO: hueco, esperando la luz */}
          <div className="ign3-target relative w-16 h-16 rounded-full border-2 border-gold/35 bg-background/40 flex items-center justify-center text-2xl font-black text-gold/60">
            {newLevel}
          </div>

          {/* El riel: la luz lo va conquistando de abajo hacia arriba */}
          <div className="relative w-[3px] h-[32vh] min-h-[180px] max-h-[340px] my-4 rounded-full bg-white/[0.08]">
            <span className="ign3-rail-lit absolute bottom-0 left-0 w-full rounded-full" />
            <span className="ign3-comet absolute left-1/2 -translate-x-1/2" />
          </div>

          {/* Tu nodo viejo: suelta la luz que acumulaste */}
          <div className="ign3-old w-14 h-14 rounded-full bg-primary/25 border-2 border-primary/60 flex items-center justify-center text-xl font-bold text-primary-hover">
            {previousLevel}
          </div>
        </div>
      )}

      {/* ================= EL FLASH (el corte vive adentro) ================= */}
      {flash && <div className="ign3-flash absolute inset-0 pointer-events-none" />}

      {/* ================= ACTO 2 · LA REVELACIÓN ================= */}
      {phase === 'reveal' && origin && (
        <div
          className="absolute pointer-events-none"
          style={{ left: `${origin.x}px`, top: `${origin.y}px` }}
        >
          {/* Onda expansiva + ráfaga radial, desde el nodo */}
          {[0, 1, 2].map((i) => (
            <span key={i} className="ign3-shockwave" style={{ animationDelay: `${i * 0.14}s` }} />
          ))}
          {sparks.map((s, i) => (
            <span
              key={i}
              className="ign3-spark"
              style={
                {
                  '--angle': `${s.angle}deg`,
                  '--dist': `${s.dist}vmin`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  animationDelay: `${s.delay}s`,
                  background: s.gold ? 'var(--gold)' : 'var(--primary)',
                } as React.CSSProperties
              }
            />
          ))}

          {/* El halo: núcleo dorado + corona morada */}
          <div className="ign3-halo-core absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="ign3-halo-crown absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full" />

          {/* Rayos orgánicos: pocos, largos distintos, casi aire */}
          <div className="ign3-rays absolute left-0 top-0">
            {[
              { r: 8, h: 42, o: 0.32 },
              { r: 63, h: 30, o: 0.2 },
              { r: 118, h: 46, o: 0.28 },
              { r: 167, h: 26, o: 0.16 },
              { r: 224, h: 40, o: 0.3 },
              { r: 283, h: 30, o: 0.18 },
              { r: 331, h: 44, o: 0.26 },
            ].map((ray, i) => (
              <span
                key={i}
                className="ign3-ray"
                style={{
                  transform: `rotate(${ray.r}deg)`,
                  height: `min(${ray.h}vmin, ${ray.h * 8}px)`,
                  opacity: ray.o,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'reveal' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {embers.map((e, i) => (
            <span
              key={i}
              className="ign3-ember"
              style={{
                left: `${e.left}%`,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.duration}s`,
                width: `${e.size}px`,
                height: `${e.size}px`,
                background: e.gold ? 'var(--gold)' : 'var(--primary)',
              }}
            />
          ))}
        </div>
      )}

      {/* Viñeta + grano fino: mata el look plástico */}
      <div className="ign3-vignette absolute inset-0 pointer-events-none" />
      <div className="ign3-grain absolute inset-0 pointer-events-none" />

      <button
        onClick={onDismiss}
        className="absolute top-6 right-6 z-10 p-2 text-muted hover:text-foreground rounded-lg transition-all"
        aria-label="Cerrar"
      >
        <X size={22} />
      </button>

      {phase === 'reveal' && (
        <div className="ign3-stage relative text-center px-6 py-8 max-w-md w-full max-h-dvh overflow-y-auto">
          {/* El nodo, ya protagonista */}
          <div ref={nodeRef} className="ign3-node relative mx-auto mb-7 w-28 h-28">
            <div className="ign3-ring absolute -inset-2.5 rounded-full" />
            <div className="ign3-core absolute inset-0 rounded-full" />
            <span className="ign3-number absolute inset-0 flex items-center justify-center text-5xl font-black text-white">
              {newLevel}
            </span>
          </div>

          <p className="ign3-kicker text-2xs font-bold uppercase text-gold mb-2.5">
            Nivel encendido
          </p>
          <h2 className="ign3-name text-6xl md:text-7xl font-black tracking-tight mb-2">
            {levelInfo.name}
          </h2>
          <p className="ign3-sub text-sm text-muted mb-8">
            Nivel {previousLevel} → <span className="text-gold font-semibold">Nivel {newLevel}</span>
            {' · '}
            {threshold.toLocaleString()} pts acumulados
          </p>

          {/* Los premios: flotan a su lugar, sin caja */}
          <div className="mb-8">
            <p className="ign3-unlock text-3xs font-bold uppercase tracking-[0.3em] text-gold/80 mb-4">
              Desbloqueaste
            </p>
            <div className="space-y-4">
              {rung.prizes.map((prize, i) => (
                <div
                  key={prize.title}
                  className="ign3-prize flex items-center gap-4 text-left mx-auto max-w-sm"
                  style={{ animationDelay: `${1.05 + i * 0.16}s` }}
                >
                  <PrizeFace prize={prize} />
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground leading-tight">
                      {prize.title}
                    </p>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{prize.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ign3-outro">
            <p className="text-xs text-muted/70 mb-5 flex items-center justify-center gap-1.5">
              <Camera size={13} className="text-muted/60" />
              Captura este momento y compártelo en{' '}
              <span className="text-foreground/80">Logros</span>
            </p>
            <button onClick={onDismiss} className="btn-gold text-sm px-8 py-2.5">
              Seguir acumulando luz
            </button>
          </div>
        </div>
      )}

      {/* global: styled-jsx scoped no alcanza classNames dinámicos — prefijo
          ign3-. Fill-mode both en todo para arrancar oculto. */}
      <style jsx global>{`
        /* ---------- ACTO 1 ---------- */
        .ign3-rig {
          animation: ign3-fade-in 0.55s ease-out both;
        }
        .ign3-old {
          box-shadow: 0 0 26px rgba(139, 92, 246, 0.55), 0 0 60px rgba(139, 92, 246, 0.25);
          animation: ign3-release 1.1s ease-out 0.5s both;
        }
        .ign3-rail-lit {
          height: 0%;
          /* la estela del cometa: ámbar tenue, monocromo — nada de arcoíris */
          background: linear-gradient(to top, rgba(255, 176, 70, 0.28), rgba(255, 210, 140, 0.85));
          box-shadow: 0 0 12px rgba(255, 170, 60, 0.4);
          animation: ign3-rail 1.15s cubic-bezier(0.5, 0, 0.7, 0.4) 0.7s both;
        }
        .ign3-comet {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: #ffd9a0;
          filter: blur(0.5px);
          box-shadow:
            0 0 10px 3px rgba(255, 200, 120, 0.9),
            0 6px 18px 6px rgba(255, 145, 1, 0.5),
            0 18px 40px 10px rgba(139, 92, 246, 0.35);
          bottom: 0;
          animation: ign3-comet-rise 1.15s cubic-bezier(0.5, 0, 0.7, 0.4) 0.7s both;
        }
        .ign3-target {
          animation: ign3-charge 0.55s ease-in-out 1.85s both;
        }
        @keyframes ign3-release {
          0% { box-shadow: 0 0 26px rgba(139, 92, 246, 0.55), 0 0 60px rgba(139, 92, 246, 0.25); }
          25% { box-shadow: 0 0 46px rgba(139, 92, 246, 0.9), 0 0 110px rgba(139, 92, 246, 0.5); }
          100% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.3), 0 0 24px rgba(139, 92, 246, 0.12); }
        }
        @keyframes ign3-rail {
          from { height: 0%; }
          to { height: 100%; }
        }
        @keyframes ign3-comet-rise {
          0% { bottom: 0; opacity: 1; }
          92% { opacity: 1; }
          100% { bottom: calc(100% - 6px); opacity: 0; }
        }
        @keyframes ign3-charge {
          0% { border-color: rgba(255, 145, 1, 0.35); box-shadow: none; transform: scale(1); }
          30% { border-color: rgba(255, 200, 120, 1); box-shadow: 0 0 30px rgba(255, 145, 1, 0.7); transform: scale(1.07); }
          55% { border-color: rgba(255, 145, 1, 0.6); box-shadow: 0 0 16px rgba(255, 145, 1, 0.4); transform: scale(1.02); }
          80% { border-color: rgba(255, 220, 160, 1); box-shadow: 0 0 44px rgba(255, 145, 1, 0.9); transform: scale(1.1); }
          100% { border-color: rgba(255, 235, 200, 1); box-shadow: 0 0 60px rgba(255, 170, 40, 1); transform: scale(1.12); }
        }

        /* ---------- EL FLASH (luz, no pintura: blend screen + caída suave) ---------- */
        .ign3-flash {
          background: radial-gradient(
            circle at 50% 44%,
            rgba(255, 252, 245, 1) 0%,
            rgba(255, 241, 214, 0.92) 10%,
            rgba(255, 214, 150, 0.72) 22%,
            rgba(255, 178, 80, 0.45) 36%,
            rgba(200, 130, 90, 0.22) 52%,
            rgba(139, 92, 246, 0.1) 68%,
            transparent 85%
          );
          mix-blend-mode: screen;
          filter: blur(2px);
          animation: ign3-flash-pop 0.38s cubic-bezier(0.1, 0.8, 0.3, 1) both;
          z-index: 5;
        }
        @keyframes ign3-flash-pop {
          0% { opacity: 0; transform: scale(0.9); }
          10% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.12); }
        }

        /* ---------- ACTO 2 ---------- */
        .ign3-stage {
          animation: ign3-shake 0.45s linear both;
        }
        @keyframes ign3-shake {
          0% { transform: translate(0, 0); }
          15% { transform: translate(-7px, 4px); }
          30% { transform: translate(6px, -5px); }
          45% { transform: translate(-4px, 3px); }
          60% { transform: translate(3px, -2px); }
          75% { transform: translate(-1px, 1px); }
          100% { transform: translate(0, 0); }
        }
        .ign3-core {
          /* ECLIPSE: disco morado profundo, la luz vive en la CORONA dorada
             fina y el halo — cero gradiente bicolor */
          background:
            radial-gradient(circle at 34% 26%, rgba(196, 181, 253, 0.32) 0%, transparent 42%),
            radial-gradient(circle at 50% 50%, #2b1650 0%, #180c2e 62%, #0e0720 100%);
          box-shadow:
            inset 0 0 34px rgba(139, 92, 246, 0.3),
            0 0 0 2px rgba(255, 186, 90, 0.65),
            0 0 26px rgba(255, 160, 40, 0.35),
            0 0 90px rgba(139, 92, 246, 0.4);
          animation: ign3-core-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both, ign3-breathe 2.6s ease-in-out 0.6s infinite;
        }
        .ign3-number {
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.35);
          animation: ign3-stamp 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
        }
        .ign3-ring {
          /* un solo destello dorado orbitando: luz, no arcoíris */
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            rgba(255, 190, 100, 0.75) 10%,
            transparent 26%
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
          animation: ign3-spin 4.5s linear infinite, ign3-fade-in 0.6s ease-out 0.25s both;
        }
        @keyframes ign3-core-in {
          0% { transform: scale(0.2); opacity: 0; }
          62% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ign3-stamp {
          0% { transform: scale(2.6); opacity: 0; filter: blur(12px); }
          55% { transform: scale(0.94); opacity: 1; filter: blur(0); }
          100% { transform: scale(1); opacity: 1; filter: blur(0); }
        }
        .ign3-shockwave {
          position: absolute;
          left: 0;
          top: 0;
          width: 12px;
          height: 12px;
          margin: -6px 0 0 -6px;
          border-radius: 9999px;
          border: 1.5px solid rgba(255, 172, 61, 0.7);
          box-shadow: 0 0 30px rgba(255, 145, 1, 0.4), inset 0 0 30px rgba(139, 92, 246, 0.3);
          animation: ign3-shock 1.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ign3-shock {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(80); opacity: 0; }
        }
        .ign3-spark {
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 9999px;
          transform: rotate(var(--angle)) translateX(6px);
          animation: ign3-burst 1.15s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ign3-burst {
          0% { transform: rotate(var(--angle)) translateX(6px); opacity: 1; }
          100% { transform: rotate(var(--angle)) translateX(var(--dist)); opacity: 0; }
        }
        .ign3-halo-core {
          width: min(34vmin, 300px);
          height: min(34vmin, 300px);
          background: radial-gradient(circle, rgba(255, 170, 40, 0.4) 0%, rgba(255, 145, 1, 0.12) 55%, transparent 75%);
          filter: blur(10px);
          animation: ign3-halo-in 1s ease-out both, ign3-breathe 3s ease-in-out 1s infinite;
        }
        .ign3-halo-crown {
          width: min(92vmin, 760px);
          height: min(92vmin, 760px);
          background: radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, rgba(139, 92, 246, 0.08) 45%, transparent 70%);
          filter: blur(14px);
          animation: ign3-halo-in 1.6s ease-out 0.1s both, ign3-breathe 4.2s ease-in-out 1.6s infinite;
        }
        @keyframes ign3-halo-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .ign3-rays {
          width: 0;
          height: 0;
          animation: ign3-fade-in 1.4s ease-out 0.4s both, ign3-spin 90s linear infinite;
        }
        .ign3-ray {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2px;
          margin-left: -1px;
          transform-origin: top center;
          background: linear-gradient(to bottom, rgba(255, 190, 90, 0.6), transparent 85%);
          filter: blur(1px);
        }
        .ign3-ember {
          position: absolute;
          bottom: -8px;
          border-radius: 9999px;
          opacity: 0;
          animation-name: ign3-rise;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }
        @keyframes ign3-rise {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 0.85; }
          100% { transform: translateY(-105vh); opacity: 0; }
        }
        .ign3-vignette {
          background: radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 2, 0.6) 100%);
        }
        .ign3-grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.5;
        }
        .ign3-kicker {
          animation: ign3-kicker-in 0.9s ease-out 0.45s both;
        }
        @keyframes ign3-kicker-in {
          from { opacity: 0; letter-spacing: 0.14em; }
          to { opacity: 1; letter-spacing: 0.4em; }
        }
        .ign3-name {
          background: linear-gradient(
            110deg,
            var(--foreground) 0%,
            var(--foreground) 40%,
            var(--gold) 50%,
            var(--foreground) 60%,
            var(--foreground) 100%
          );
          background-size: 240% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: ign3-up-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.55s both, ign3-shimmer 3.4s ease-in-out 1.4s infinite;
        }
        .ign3-sub {
          animation: ign3-up-in 0.7s ease-out 0.75s both;
        }
        .ign3-unlock {
          animation: ign3-up-in 0.7s ease-out 0.95s both;
        }
        .ign3-prize {
          animation: ign3-prize-in 0.65s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
        @keyframes ign3-prize-in {
          from { opacity: 0; transform: translateY(24px) scale(0.92); filter: blur(6px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .ign3-outro {
          animation: ign3-fade-in 0.9s ease-out 1.75s both;
        }
        @keyframes ign3-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ign3-up-in {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ign3-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ign3-breathe {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.18); }
        }
        @keyframes ign3-shimmer {
          0%, 55%, 100% { background-position: 120% 0; }
          25% { background-position: -120% 0; }
        }
      `}</style>
    </div>
  );
}
