/**
 * EL ESTADO SE DERIVA DEL RELOJ, JAMAS SE ESCRIBE.
 *
 * Un estado que hay que escribir es un organo que se pudre sin sensor: el
 * calendario viejo dejaba "La clase terminó. Procesando grabación..." colgado
 * para siempre en eventos de hace meses, porque nadie volvia a escribirlo.
 * Aqui solo `cancelado` es un hecho persistido; lo demas es una funcion del
 * reloj y no puede mentir.
 */
export const MINUTOS_ANTES_DE_ABRIR = 10;

export type EstadoEvento =
  | 'cancelado'
  | 'futuro'        // falta mas de la ventana
  | 'por_empezar'   // la sala ya abrio (-10 min)
  | 'en_vivo'       // entre inicio y fin
  | 'terminado';

export interface Reloj {
  estado: EstadoEvento;
  msAlInicio: number;
  msAlFin: number;
  /** el miembro puede entrar a la sala ahora mismo */
  puedeEntrar: boolean;
}

/**
 * REGLA (1 sep 2026, clase N7 de 101 min sobre 60 programados): si la sala tiene
 * una sesion ABIERTA, la sesion manda sobre el reloj. El reloj solo gobierna
 * cuando no hay sesion viva. Aquel dia la UI dio la clase por terminada a los
 * 60 min y apago el boton de entrar con 7 personas adentro y la grabacion
 * corriendo; el anfitrion tuvo que volver por la URL cruda.
 */
export function leerReloj(
  inicioISO: string,
  duracionMin: number | null,
  cancelado = false,
  ahora: number = Date.now(),
  salaViva = false
): Reloj {
  const ini = new Date(inicioISO).getTime();
  const fin = ini + (duracionMin ?? 60) * 60000;
  const abre = ini - MINUTOS_ANTES_DE_ABRIR * 60000;
  const msAlInicio = ini - ahora;
  const msAlFin = fin - ahora;

  let estado: EstadoEvento;
  if (cancelado) estado = 'cancelado';
  else if (salaViva) estado = 'en_vivo';
  else if (ahora > fin) estado = 'terminado';
  else if (ahora >= ini) estado = 'en_vivo';
  else if (ahora >= abre) estado = 'por_empezar';
  else estado = 'futuro';

  return {
    estado,
    msAlInicio,
    msAlFin,
    puedeEntrar: estado === 'en_vivo' || estado === 'por_empezar',
  };
}

/** Cada cuanto repintar: 1s cerca de la ventana, 60s lejos. Sin quemar bateria. */
export function cadenciaTick(r: Reloj): number {
  if (r.estado === 'en_vivo' || r.estado === 'por_empezar') return 1000;
  if (r.msAlInicio > 0 && r.msAlInicio <= (MINUTOS_ANTES_DE_ABRIR + 1) * 60000) return 1000;
  return 60000;
}
