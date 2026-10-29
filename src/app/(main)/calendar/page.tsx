'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ListBullets, CalendarBlank, Plus } from '@phosphor-icons/react/dist/ssr';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useZonaMiembro } from '@/features/agenda/hooks/useZonaMiembro';
import { useAgenda } from '@/features/agenda/hooks/useAgenda';
import { Agenda } from '@/features/agenda/components/Agenda';
import { VistaMes } from '@/features/agenda/components/VistaMes';
import { DetalleClase } from '@/features/agenda/components/DetalleClase';
import { SelectorZona } from '@/features/agenda/components/SelectorZona';
import { alternarRecordatorio, traerClase } from '@/features/agenda/services/agendaService';
import { getOrCreateRoomForEvent } from '@/features/video-calling/services/eventBridgeService';
import { asegurarPush } from '@/features/agenda/lib/push';
import { nivelBloquea } from '@/features/agenda/lib/candado';
import { useToast } from '@/shared/hooks/useToast';
import type { Clase } from '@/features/agenda/types';

type Vista = 'agenda' | 'mes';

/**
 * /calendar — LA AGENDA.
 *
 * Reemplaza la grilla de mes anterior. La vista por
 * defecto es una columna unica, identica en movil y escritorio, con la clase
 * de hoy visible en el primer viewport. El mes queda de vista secundaria.
 */
export default function CalendarPage() {
  const { userProfile } = useUserProfile();
  const { showError } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { zona, cambiar } = useZonaMiembro();
  const { dias, clases, cargando, error, recargar, marcarAviso } = useAgenda(zona);

  const [vista, setVista] = useState<Vista>('agenda');
  const [abierta, setAbierta] = useState<Clase | null>(null);

  const esStaff = userProfile?.role === 'admin' || userProfile?.role === 'owner';
  const esAnfitrion = esStaff || clases.some((c) => c.anfitrion?.id === userProfile?.id);

  /** El candado por nivel: LA MISMA regla que aplica la puerta de la sala
      (`/api/video-calling/token`), via `nivelBloquea`. Staff pasa, los
      los VIP pasan por grant. */
  const estaBloqueada = useCallback((c: Clase) => nivelBloquea(
    { role: userProfile?.role, tier: userProfile?.tier, current_level: userProfile?.current_level },
    c.required_level,
  ), [userProfile?.role, userProfile?.tier, userProfile?.current_level]);

  // deep link ?event=<id> (lo usan el banner y las notificaciones)
  useEffect(() => {
    const id = params.get('event');
    if (!id || abierta) return;
    const local = clases.find((c) => c.id === id);
    if (local) { setAbierta(local); router.replace('/calendar', { scroll: false }); return; }
    traerClase(id).then((c) => {
      if (c) { setAbierta(c); router.replace('/calendar', { scroll: false }); }
    });
  }, [params, clases, abierta, router]);

  const entrar = useCallback(async (c: Clase) => {
    if (c.google_meet_link) { window.open(c.google_meet_link, '_blank', 'noopener'); return; }
    if (!userProfile?.id) return;
    try {
      const sala = await getOrCreateRoomForEvent(c.id);
      if (sala) router.push(`/call/${sala.slug}`);
    } catch (e) {
      console.error('No pude abrir la sala', e);
      showError(e instanceof Error ? e.message : 'No pudimos abrir la sala. Intenta entrar de nuevo.');
    }
  }, [userProfile?.id, router, showError]);

  const recordar = useCallback(async (c: Clase, on: boolean) => {
    if (!userProfile?.id) return;
    marcarAviso(c.id, on);                       // optimista
    setAbierta((a) => (a && a.id === c.id ? { ...a, recordatorio: on } : a));
    try {
      await alternarRecordatorio(c.id, userProfile.id, on);
      // el aviso es PUSH: si no lo tiene activado, este es el momento de pedirlo
      if (on) await asegurarPush(userProfile.id);
    } catch {
      marcarAviso(c.id, !on);                    // rollback visible
      setAbierta((a) => (a && a.id === c.id ? { ...a, recordatorio: !on } : a));
    }
  }, [userProfile?.id, marcarAviso]);

  return (
    <div className="w-full">
      {/* Cabecera: dos vistas + la zona horaria SIEMPRE visible */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-glass bg-surface/40 p-0.5">
          {([['agenda', 'Agenda', ListBullets], ['mes', 'Mes', CalendarBlank]] as const).map(
            ([v, label, Icono]) => (
              <button key={v} onClick={() => setVista(v)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors
                  ${vista === v ? 'bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,.06)]' : 'text-muted hover:text-foreground'}`}>
                <Icono size={15} weight="duotone" /> {label}
              </button>
            ))}
        </div>

        <div className="flex min-w-0 items-center gap-1">
          <SelectorZona zona={zona} onCambiar={cambiar} />
          {esAnfitrion && (
            <button
              onClick={() => router.push('/calendar/nueva')}
              title="Crear clase"
              className="btn-primary !px-3 !py-1.5 !text-[13px] !rounded-lg">
              <Plus size={15} weight="bold" />
              <span className="hidden sm:inline">Clase</span>
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-spotlight flex gap-3.5 p-3">
              <div className="aspect-video h-[46px] shrink-0 animate-pulse rounded-lg bg-card/60 sm:h-[56px]" />
              <div className="flex flex-1 flex-col gap-2 py-1">
                <div className="h-3 w-28 animate-pulse rounded bg-card/60" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-card/50" />
                <div className="h-3 w-32 animate-pulse rounded bg-card/40" />
              </div>
            </div>
          ))}
        </div>
      ) : vista === 'agenda' ? (
        <Agenda
          dias={dias} zona={zona} estaBloqueada={estaBloqueada}
          onAbrir={setAbierta} onEntrar={entrar}
          onRecordar={recordar}
        />
      ) : (
        <VistaMes
          clases={clases} zona={zona} onAbrir={setAbierta}
          estaBloqueada={estaBloqueada} onEntrar={entrar} onRecordar={recordar}
        />
      )}

      {abierta && (
        <DetalleClase
          clase={abierta} zona={zona} bloqueada={estaBloqueada(abierta)}
          onCerrar={() => setAbierta(null)}
          onEntrar={() => entrar(abierta)}
          onRecordar={(on) => recordar(abierta, on)}
        />
      )}
    </div>
  );
}
