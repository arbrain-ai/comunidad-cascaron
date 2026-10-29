'use client';

// ============================================
// EmailBroadcastToast
// ============================================
// Acuse visible de que el correo de un anuncio SALIO (o no).
//
// ORIGEN (25 jul 2026): el toggle "Enviar por email a miembros" no daba ninguna señal.
// Se publicaba, la app decia "listo", y nadie sabia si los ~471 correos habian salido.
// Entre el 9 y el 25 jul se perdieron 4 anuncios completos sin que nada avisara.
//
// REGLA DE ESTE COMPONENTE: nunca afirmar exito sin evidencia. Si el registro no llega
// dentro de la ventana, dice "no pude confirmar" — jamas "enviado". Un falso verde aqui
// reproduce exactamente el bug que este componente existe para hacer visible.

import { useEffect, useState } from 'react';
import { getEmailBroadcastStatus, EmailBroadcastStatus } from '../services/communityService';

const POLL_MS = 3000;
const MAX_ESPERA_MS = 90_000; // el envio va en lotes de 100 con pausa entre lotes

interface EmailBroadcastToastProps {
  postId: string;
  onClose: () => void;
}

type Estado =
  | { fase: 'enviando' }
  | { fase: 'listo'; data: EmailBroadcastStatus }
  | { fase: 'sin_confirmar' };

export function EmailBroadcastToast({ postId, onClose }: EmailBroadcastToastProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'enviando' });

  useEffect(() => {
    let vivo = true;
    const inicio = Date.now();

    const revisar = async () => {
      const data = await getEmailBroadcastStatus(postId);
      if (!vivo) return;

      if (data) {
        setEstado({ fase: 'listo', data });
        if (data.status === 'sent') setTimeout(() => vivo && onClose(), 8000);
        return;
      }

      if (Date.now() - inicio > MAX_ESPERA_MS) {
        setEstado({ fase: 'sin_confirmar' });
        return;
      }

      setTimeout(revisar, POLL_MS);
    };

    revisar();
    return () => {
      vivo = false;
    };
  }, [postId, onClose]);

  const { icono, titulo, detalle, tono } = describir(estado);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="glass-panel-strong rounded-xl border border-glass-strong shadow-elevation-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">{icono}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${tono}`}>{titulo}</p>
            {detalle && <p className="text-xs text-muted mt-1">{detalle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted hover:text-foreground transition-all duration-fast text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function describir(estado: Estado): {
  icono: string;
  titulo: string;
  detalle: string | null;
  tono: string;
} {
  if (estado.fase === 'enviando') {
    return {
      icono: '📧',
      titulo: 'Enviando el correo a los miembros…',
      detalle: 'Te confirmo aquí mismo cuántos lo recibieron.',
      tono: 'text-foreground',
    };
  }

  if (estado.fase === 'sin_confirmar') {
    return {
      icono: '⚠️',
      titulo: 'No pude confirmar el envío',
      detalle:
        'El post se publicó, pero el correo no dio acuse. Revisa el briefing de mañana: el watchdog lo verifica.',
      tono: 'text-warning',
    };
  }

  const { status, sent, failed, recipients_total, errors } = estado.data;

  if (status === 'sent') {
    return {
      icono: '✅',
      titulo: `Correo enviado a ${sent} miembros`,
      detalle: null,
      tono: 'text-emerald-400',
    };
  }

  if (status === 'partial') {
    return {
      icono: '⚠️',
      titulo: `Entrega parcial: ${sent} de ${recipients_total}`,
      detalle: `${failed} correos fallaron. ${errors[0] ?? ''}`.trim(),
      tono: 'text-warning',
    };
  }

  if (status === 'no_recipients') {
    return {
      icono: '🔴',
      titulo: 'Ningún miembro elegible para recibirlo',
      detalle: 'El correo no salió. Revisa los permisos de notificación de los miembros.',
      tono: 'text-error',
    };
  }

  return {
    icono: '🔴',
    titulo: 'El correo NO salió',
    detalle: errors[0] ?? 'El proveedor de email rechazó el envío.',
    tono: 'text-error',
  };
}
