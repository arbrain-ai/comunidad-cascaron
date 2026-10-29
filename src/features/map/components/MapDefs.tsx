/**
 * Los `<defs>` del mapa: gradientes, filtros y tramas.
 *
 * Todo el color sale del núcleo de marca
 * (.claude/skills/diseno-de-marca/references/nucleo.md §2): morado #8C27F1 es
 * la noche/la sombra/lo secundario, oro #ff9101 es la luz/lo protagonista,
 * sobre near-black #09090b.
 *
 * La doctrina que ordena la escena es la del Grabado ("LA LUZ ES EL ARGUMENTO"):
 * una sola fuente de luz dorada baña al protagonista, todo lo demás cae en
 * sombra violácea sobre un fondo casi negro que domina el lienzo, y la frontera
 * luz/sombra cuenta la historia. Aquí el protagonista es la comunidad: la luz
 * no es un foco decorativo puesto encima del mapa, EMANA de los miembros. Donde
 * hay gente hay luz; el resto del mundo queda en sombra.
 */

export const MAP_COLORS = {
  void: '#09090b',
  purple: '#8C27F1',
  gold: '#ff9101',
  goldSoft: '#ffac3d',
  shadowLand: '#141021',
  shadowLandLight: '#e9e4f2',
  textPrimary: '#f7f8f8',
  textMuted: '#a1a1aa',
} as const;

interface MapDefsProps {
  /** el tema claro invierte el claroscuro sin cambiar los roles del color */
  light: boolean;
  uid: string;
}

export function MapDefs({ light, uid }: MapDefsProps) {
  const { purple, gold, goldSoft } = MAP_COLORS;

  return (
    <defs>
      {/* El resplandor de un asentamiento. Los círculos que lo usan se apilan
          en modo screen, así que dos ciudades cercanas suman su luz: la
          densidad se lee como brillo antes de que el ojo cuente un solo punto. */}
      <radialGradient id={`${uid}-glow`}>
        <stop offset="0%" stopColor={gold} stopOpacity={light ? 0.45 : 0.7} />
        <stop offset="30%" stopColor={gold} stopOpacity={light ? 0.14 : 0.2} />
        <stop offset="65%" stopColor={goldSoft} stopOpacity={light ? 0.04 : 0.06} />
        <stop offset="100%" stopColor={goldSoft} stopOpacity="0" />
      </radialGradient>

      {/* Luz cayendo sobre la tierra habitada. Va en los países CON comunidad,
          para que el continente se encienda por debajo de sus ciudades. */}
      <radialGradient id={`${uid}-landlight`}>
        <stop offset="0%" stopColor={gold} stopOpacity={light ? 0.3 : 0.42} />
        <stop offset="100%" stopColor={gold} stopOpacity="0" />
      </radialGradient>

      {/* Viñeta: el claroscuro pide que la oscuridad domine el lienzo y que el
          ojo caiga al centro. Sin esto el mapa se ve plano, no pictórico. */}
      <radialGradient id={`${uid}-vignette`}>
        <stop offset="55%" stopColor={MAP_COLORS.void} stopOpacity="0" />
        <stop offset="100%" stopColor={MAP_COLORS.void} stopOpacity={light ? 0.14 : 0.62} />
      </radialGradient>

      {/* Cross-hatching: la trama del aguafuerte. Se aplica solo a la tierra en
          sombra, que es donde el grabado pone su rayado. */}
      {/* Cross-hatching del aguafuerte. Va CRUZADO (dos direcciones) y con
          presencia real: en los referentes la trama se ve en toda la
          superficie, también dentro de la sombra. Una sola dirección apenas
          insinuada leía como vector plano, no como grabado. */}
      <pattern
        id={`${uid}-hatch`}
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(35)"
      >
        <line x1="0" y1="0" x2="0" y2="7" stroke={purple} strokeWidth="0.55"
          strokeOpacity={light ? 0.2 : 0.46} />
        <line x1="3.5" y1="0" x2="3.5" y2="7" stroke={purple} strokeWidth="0.3"
          strokeOpacity={light ? 0.11 : 0.26} />
      </pattern>
      <pattern
        id={`${uid}-hatch2`}
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(-52)"
      >
        <line x1="0" y1="0" x2="0" y2="7" stroke={purple} strokeWidth="0.4"
          strokeOpacity={light ? 0.13 : 0.3} />
      </pattern>

      {/* El agua de una carta antigua no es un plano vacío: lleva líneas de
          sonda paralelas. Es lo que separa "fondo" de "papel grabado". */}
      <pattern id={`${uid}-water`} width="26" height="16" patternUnits="userSpaceOnUse">
        <line x1="0" y1="8" x2="26" y2="8" stroke={purple} strokeWidth="0.35"
          strokeOpacity={light ? 0.035 : 0.045} />
      </pattern>

      {/* Halo suave para los puntos: un punto duro se ve a vector plano; con
          este desenfoque se ve como una lámpara encendida sobre el papel. */}
      <filter id={`${uid}-soft`} x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="0.9" />
      </filter>
    </defs>
  );
}
