'use client';

// ============================================
// SALA v2 - la GUARDIA de formato de camara
// ============================================
// El 5 sep 2026 el anfitrion publico 640x480 (4:3) con una Sony por Cam Link
// (señal 16:9): la imagen llego aplastada. El "arreglo" del 1 sep pedia
// 1280x720 como *ideal* y Chrome no lo respeto para ese dispositivo. Esta
// guardia hace tres cosas que aquel no hacia:
//   1. Pide 16:9 y LEE lo que la camara entrega (getSettings), no lo que pidio.
//   2. Si la camara contesta 4:3, vuelve a pedir con formatos 16:9 EXACTOS
//      (1080p → 720p → 360p) hasta que alguno entre.
//   3. Devuelve el veredicto para mostrarlo en el lobby y registrarlo en la
//      telemetria (`camara_publicada` ya existia; ahora ademas `formato_camara`).
// Y el track que se valido aqui es EL MISMO que se publica en la sala (se
// entrega por referencia), asi que no hay una segunda negociacion que pueda
// cambiar el formato a mitad de camino.

export type EtiquetaFormato = '16:9' | '4:3' | 'vertical' | 'otro';

export interface FormatoCamara {
  width: number;
  height: number;
  aspecto: number;
  etiqueta: EtiquetaFormato;
  /** Lo que la camara contesto a la PRIMERA peticion (16:9 ideal). */
  primerIntento: { width: number; height: number; etiqueta: EtiquetaFormato };
  /** true si la camara respondio 4:3 al principio y hubo que forzar 16:9. */
  corregido: boolean;
  /** false si ni forzando se consiguio un 16:9. */
  aceptado: boolean;
  frameRate: number | null;
}

export const FORMATOS_16_9 = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 640, height: 360 },
] as const;

export function etiquetaDe(width: number, height: number): EtiquetaFormato {
  if (!width || !height) return 'otro';
  const a = width / height;
  if (Math.abs(a - 16 / 9) < 0.03) return '16:9';
  if (Math.abs(a - 4 / 3) < 0.03) return '4:3';
  if (a < 1) return 'vertical';
  return 'otro';
}

function leer(track: MediaStreamTrack): { width: number; height: number; frameRate: number | null } {
  const s = track.getSettings();
  return { width: s.width ?? 0, height: s.height ?? 0, frameRate: typeof s.frameRate === 'number' ? s.frameRate : null };
}

function conDispositivo(deviceId: string | undefined, extra: MediaTrackConstraints): MediaTrackConstraints {
  return { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), ...extra };
}

/**
 * Abre la camara con la guardia puesta. Devuelve el track (vivo, sin detener)
 * y el veredicto. Lanza si el navegador niega el permiso o no hay camara.
 */
export async function abrirCamaraConGuardia(deviceId?: string): Promise<{ track: MediaStreamTrack; formato: FormatoCamara }> {
  // 1) La peticion honesta: 16:9 como ideal. Lo que conteste la camara es el veredicto.
  const primera = await navigator.mediaDevices.getUserMedia({
    video: conDispositivo(deviceId, { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } }),
  });
  const t1 = primera.getVideoTracks()[0];
  const s1 = leer(t1);
  const e1 = etiquetaDe(s1.width, s1.height);
  const primerIntento = { width: s1.width, height: s1.height, etiqueta: e1 };
  if (e1 === '16:9') {
    return { track: t1, formato: { ...s1, aspecto: +(s1.width / s1.height).toFixed(3), etiqueta: e1, primerIntento, corregido: false, aceptado: true } };
  }

  // 2) Contesto otra cosa: soltar y forzar 16:9 exacto de mayor a menor.
  t1.stop();
  for (const f of FORMATOS_16_9) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: conDispositivo(deviceId, { width: { exact: f.width }, height: { exact: f.height } }),
      });
      const t = stream.getVideoTracks()[0];
      const s = leer(t);
      const e = etiquetaDe(s.width, s.height);
      if (e === '16:9') {
        return { track: t, formato: { ...s, aspecto: +(s.width / s.height).toFixed(3), etiqueta: e, primerIntento, corregido: true, aceptado: true } };
      }
      t.stop();
    } catch {
      // ese formato no entra en este dispositivo; probar el siguiente
    }
  }

  // 3) Nada entro: se abre como sea y se avisa. Publicar deformado NO es opcion silenciosa.
  const ultimo = await navigator.mediaDevices.getUserMedia({ video: conDispositivo(deviceId, {}) });
  const t3 = ultimo.getVideoTracks()[0];
  const s3 = leer(t3);
  return { track: t3, formato: { ...s3, aspecto: s3.height ? +(s3.width / s3.height).toFixed(3) : 0, etiqueta: etiquetaDe(s3.width, s3.height), primerIntento, corregido: false, aceptado: false } };
}

export function describirFormato(f: FormatoCamara | null): string {
  if (!f) return '';
  return `${f.width}×${f.height} (${f.etiqueta})`;
}

/** El texto de la guardia para el lobby. null = todo bien, sin aviso. */
export function avisoDeFormato(f: FormatoCamara | null): { nivel: 'ok' | 'aviso' | 'alerta'; texto: string } | null {
  if (!f) return null;
  if (f.aceptado && !f.corregido) return { nivel: 'ok', texto: `Tu cámara entrega ${f.width}×${f.height}, formato 16:9.` };
  if (f.aceptado && f.corregido) {
    return {
      nivel: 'aviso',
      texto: `Tu cámara respondió en ${f.primerIntento.width}×${f.primerIntento.height} (${f.primerIntento.etiqueta}); se fijó a ${f.width}×${f.height}. Si te ves deformado, cierra otras apps que usen la cámara (SFCam, OBS) y vuelve a entrar.`,
    };
  }
  return {
    nivel: 'alerta',
    texto: `Tu cámara solo entrega ${f.width}×${f.height} (${f.etiqueta}): te verás deformado. Cambia de cámara o cierra otras apps que la estén usando.`,
  };
}
