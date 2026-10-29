// ============================================
// NIVELES — config de peldaños y acciones (fuente única en CÓDIGO)
// ============================================
// Los umbrales numéricos viven en ../types (LEVEL_THRESHOLDS) y deben ser
// espejo exacto de calculate_level() en la base de datos.
// Personaliza los premios de cada peldaño editando LEVEL_LADDER.

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Star,
  Award,
  Crown,
} from 'lucide-react';
import { LEVEL_THRESHOLDS } from '../types';

export interface LadderPrize {
  title: string;
  description: string;
  /** Imagen del premio (opcional). Sin ella se pinta el ícono de respaldo. */
  image?: string;
  /** Ícono lucide de respaldo mientras el premio no tiene imagen propia */
  fallback: LucideIcon;
  /** Clic en el premio = ir al premio */
  href?: string;
  external?: boolean;
  /** Nota para premios sin destino (se activan o se reclaman aparte) */
  nota?: string;
}

export interface LadderRungConfig {
  level: number;
  name: string;
  prizes: LadderPrize[];
  /** La ACCIÓN que te lleva a este peldaño (nunca solo el número) */
  cta: { label: string; href: string };
}

/** ¿Este curso se abre para este miembro por nivel? */
export function courseUnlockSatisfied(requiredLevel: number, currentLevel: number): boolean {
  return currentLevel >= requiredLevel;
}

/** Nombre del nivel (única fuente: LEVEL_THRESHOLDS en ../types). */
export function getLevelName(level: number): string {
  return LEVEL_THRESHOLDS[Math.min(Math.max(level, 1), LEVEL_THRESHOLDS.length) - 1].name;
}

function coursesPrize(level: number): LadderPrize {
  return {
    title: `Cursos de nivel ${level}`,
    description: `Acceso a los cursos que se desbloquean en el nivel ${level}`,
    fallback: GraduationCap,
    href: '/classroom',
  };
}

// LA ESCALERA — 9 peldaños. Los nombres vienen de LEVEL_THRESHOLDS.
export const LEVEL_LADDER: LadderRungConfig[] = [
  {
    level: 1,
    name: getLevelName(1),
    prizes: [
      { title: 'La comunidad', description: 'Publica, pregunta y comparte con los demás miembros', fallback: Users, href: '/community' },
      { title: 'Cursos abiertos', description: 'Todo el contenido abierto del Classroom', fallback: BookOpen, href: '/classroom' },
    ],
    cta: { label: 'Entra a la comunidad', href: '/community' },
  },
  {
    level: 2,
    name: getLevelName(2),
    prizes: [coursesPrize(2)],
    cta: { label: 'Preséntate en la comunidad', href: '/community' },
  },
  {
    level: 3,
    name: getLevelName(3),
    prizes: [coursesPrize(3)],
    cta: { label: 'Comparte lo que estás haciendo', href: '/community' },
  },
  {
    level: 4,
    name: getLevelName(4),
    prizes: [coursesPrize(4), { title: 'Insignia de participante', description: 'Reconocimiento visible en tu perfil', fallback: MessageSquare }],
    cta: { label: 'Asiste a los eventos de la comunidad', href: '/calendar' },
  },
  {
    level: 5,
    name: getLevelName(5),
    prizes: [coursesPrize(5)],
    cta: { label: 'Comenta y ayuda a otros miembros', href: '/community' },
  },
  {
    level: 6,
    name: getLevelName(6),
    prizes: [coursesPrize(6), { title: 'Insignia de referente', description: 'Tu aporte destaca en la comunidad', fallback: Star }],
    cta: { label: 'Publica contenido de valor', href: '/community' },
  },
  {
    level: 7,
    name: getLevelName(7),
    prizes: [coursesPrize(7)],
    cta: { label: 'Sigue aportando cada semana', href: '/community' },
  },
  {
    level: 8,
    name: getLevelName(8),
    prizes: [coursesPrize(8), { title: 'Insignia de mentor', description: 'Reconocimiento como mentor de la comunidad', fallback: Award }],
    cta: { label: 'Sé constante en la comunidad', href: '/community' },
  },
  {
    level: 9,
    name: getLevelName(9),
    prizes: [
      coursesPrize(9),
      { title: 'La cima', description: 'El nivel más alto de la comunidad', fallback: Crown },
    ],
    cta: { label: 'Llega a la cima', href: '/community' },
  },
];

export interface PointActionConfig {
  label: string;
  points: number;
  /** Nota corta: techo, condición o verificación */
  note?: string;
  href?: string;
  /** Resultados verificados por un admin */
  verified?: boolean;
}

// Espejo de lo que otorga el motor de puntos en la base de datos.
export const POINT_ACTIONS: PointActionConfig[] = [
  { label: 'Recibir like en tu post', points: 1, href: '/community' },
  { label: 'Recibir like en tu comentario', points: 1, href: '/community' },
];

export function getRungConfig(level: number): LadderRungConfig {
  return LEVEL_LADDER[Math.min(Math.max(level, 1), LEVEL_LADDER.length) - 1];
}

export function getThreshold(level: number): number {
  const info = LEVEL_THRESHOLDS[Math.min(Math.max(level, 1), LEVEL_THRESHOLDS.length) - 1];
  return info.minPoints;
}
