import type { Transition, Variants } from 'framer-motion';

/**
 * Motion Foundation — Design System
 *
 * Fisica basada en masa/tension/damping en vez de curves. Inspirado en:
 * - Linear (refresh Mar 2026): warm grays + subtle springs
 * - Apple UIKit: spring(mass, stiffness, damping)
 * - Stripe Dashboard: calm defaults + decisive tap states
 *
 * Uso:
 *   <motion.div transition={spring.smooth} ... />
 *   <motion.div {...fadeInUp} />
 *
 * Regla: si la duracion importa, usa `duration`. Si el TACTO importa, usa `spring`.
 */

// ============================================================
// SPRING PRESETS (tacto premium)
// ============================================================

export const spring = {
  /** Micro — hovers, focus, tap feedback. ~120ms feel. */
  snap: {
    type: 'spring',
    stiffness: 600,
    damping: 38,
    mass: 0.5,
  } as Transition,

  /** Default — buttons, cards entering, modals. ~220ms feel. */
  smooth: {
    type: 'spring',
    stiffness: 380,
    damping: 30,
    mass: 0.8,
  } as Transition,

  /** Bouncy — celebration, achievement unlock, success toasts. */
  bouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 18,
    mass: 0.8,
  } as Transition,

  /** Gentle — large layout shifts, sidebars, side panels. ~350ms feel. */
  gentle: {
    type: 'spring',
    stiffness: 170,
    damping: 26,
    mass: 1,
  } as Transition,

  /** Stiff — drag-to-move, knob drags, slider thumbs. */
  stiff: {
    type: 'spring',
    stiffness: 900,
    damping: 40,
    mass: 0.4,
  } as Transition,
} as const;

// ============================================================
// EASING CURVES (para duration-based transitions)
// ============================================================

export const easing = {
  /** Estandar del sistema. Igual a --ease-out-expo. */
  outExpo: [0.16, 1, 0.3, 1] as const,
  /** Overshoot sutil — para elementos que aparecen. Igual a --ease-out-back. */
  outBack: [0.34, 1.3, 0.64, 1] as const,
  /** Material Design standard. */
  standard: [0.4, 0, 0.2, 1] as const,
  /** "Architect" — calm start, decisive middle, graceful land. Custom. */
  architect: [0.2, 0.9, 0.1, 1] as const,
} as const;

// ============================================================
// DURATIONS (segundos — unidad de framer-motion)
// ============================================================

export const duration = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.35,
  slower: 0.6,
  cinematic: 1.0,
} as const;

// ============================================================
// MOTION PRESETS (spread en <motion.*>)
// ============================================================

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.normal, ease: easing.outExpo },
} as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: spring.smooth,
} as const;

export const fadeInDown = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: spring.smooth,
} as const;

export const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: spring.bouncy,
} as const;

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: spring.gentle,
} as const;

// ============================================================
// STAGGER HELPERS
// ============================================================

export const staggerContainer = (childrenDelay = 0.06, initialDelay = 0.05): Variants => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: childrenDelay,
      delayChildren: initialDelay,
    },
  },
});

export const staggerChild: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: spring.smooth },
};

// ============================================================
// HOVER VARIANTS (para whileHover / whileTap)
// ============================================================

export const lift = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.005 },
  tap: { y: 0, scale: 0.995 },
} as const;

export const glow = {
  rest: { boxShadow: '0 0 0 rgba(139, 92, 246, 0)' },
  hover: { boxShadow: '0 0 24px rgba(139, 92, 246, 0.25)' },
} as const;

// ============================================================
// VIEWPORT REVEAL (whileInView)
// ============================================================

export const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: spring.smooth,
} as const;
