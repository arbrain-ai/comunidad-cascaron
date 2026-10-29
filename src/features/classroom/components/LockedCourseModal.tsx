'use client';

import { Course } from '../types';
import { AccessCheckResult } from '../services/classroomService';
import { BRAND } from '@/shared/config/brand';

interface LockedCourseModalProps {
  course: Course;
  accessResult?: AccessCheckResult;
  userId?: string;
  userEmail?: string;
  onClose: () => void;
}

// Helper para formatear precio
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function LockedCourseModal({
  course,
  accessResult,
  userId,
  userEmail,
  onClose,
}: LockedCourseModalProps) {

  // Determinar el contenido basado en el motivo de bloqueo
  const getLockedContent = () => {
    if (!accessResult) {
      return {
        icon: '🔒',
        title: 'Curso Bloqueado',
        description: 'Este curso no está disponible actualmente.',
        showBuyButton: false,
      };
    }

    switch (accessResult.reason) {
      case 'level_too_low':
        return {
          icon: '⬆️',
          title: `Requiere Nivel ${accessResult.requiredLevel}`,
          description: `Tu nivel actual es ${accessResult.currentLevel || 1}. Gana puntos recibiendo likes en tus posts y comentarios.`,
          showBuyButton: false,
          showLevelGuide: true,
          badge: `Nivel ${accessResult.requiredLevel}+`,
        };

      case 'time_not_reached':
        return {
          icon: '⏰',
          title: `${accessResult.requiredDays} días requeridos`,
          description: `Llevas ${accessResult.currentDays || 0} días en la comunidad. Este curso se desbloquea después de ${accessResult.requiredDays} días de membresía.`,
          showBuyButton: false,
          badge: `${accessResult.currentDays || 0}/${accessResult.requiredDays} días`,
        };

      case 'level_and_time_required':
        return {
          icon: '🔐',
          title: `Nivel ${accessResult.requiredLevel} + ${accessResult.requiredDays} días`,
          description: `Necesitas nivel ${accessResult.requiredLevel} (tienes ${accessResult.currentLevel || 1}) y ${accessResult.requiredDays} días de membresía (llevas ${accessResult.currentDays || 0}).`,
          showBuyButton: false,
          showLevelGuide: true,
          badge: `Nivel ${accessResult.requiredLevel}+`,
        };

      case 'not_purchased':
        return {
          icon: '💰',
          title: 'Curso Premium',
          description: course.description || 'Obtén acceso completo a este curso exclusivo.',
          showBuyButton: true,
          price: accessResult.priceCents,
          badge: formatPrice(accessResult.priceCents || 0),
        };

      case 'private':
        return {
          icon: '💎',
          title: 'Programa DWY Exclusivo',
          description: 'Este curso forma parte del programa "Done With You" de alto nivel. Es un programa de mentoría personalizada donde construimos tu SaaS contigo. Aplica para saber si calificas.',
          showBuyButton: false,
          showApplyButton: true,
          badge: 'Acceso Exclusivo',
        };

      default:
        return {
          icon: '🔒',
          title: 'Curso Bloqueado',
          description: 'Este curso no está disponible actualmente.',
          showBuyButton: false,
        };
    }
  };

  const content = getLockedContent();

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Course thumbnail - Full image, no text overlay */}
        <div className="relative aspect-video w-full overflow-hidden">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10" />
          )}

          {/* Lock icon overlay - subtle, centered */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <svg className="w-10 h-10 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Content section - Solid background, all text here */}
        <div className="px-6 py-5 bg-[#1a1a1a]">
          {/* Badge */}
          {content.badge && (
            <div className="flex justify-center mb-3">
              <span className="px-4 py-1.5 bg-primary/20 text-primary text-sm font-bold rounded-full border border-primary/40">
                {content.badge}
              </span>
            </div>
          )}

          {/* Course title */}
          <h3 className="text-white text-xl font-bold text-center mb-2 line-clamp-2">
            {course.title}
          </h3>

          {/* Lock reason */}
          <p className="text-primary text-center font-semibold mb-3">
            {content.title}
          </p>

          {/* Description */}
          <p className="text-white/70 text-sm text-center mb-5 leading-relaxed">
            {content.description}
          </p>

          {/* Curso de pago: el cascaron no trae pasarela. Conecta la tuya
              (Stripe, Lemon Squeezy, etc.) y que su webhook registre el acceso. */}
          {content.showBuyButton && content.price && (
            <a
              href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(`Acceso a ${course.title}`)}`}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <span>Solicitar acceso ({formatPrice(content.price)})</span>
            </a>
          )}

          {/* Apply button - Redirect to landing for qualification */}
          {(content as any).showApplyButton && (
            <a
              href="/"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Aplicar al Programa</span>
            </a>
          )}

          {/* How to level up guide */}
          {(content as any).showLevelGuide && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-3">Cómo subir de nivel</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Like en tu post</span>
                  <span className="font-medium text-primary">+1 punto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Like en tu comentario</span>
                  <span className="font-medium text-primary">+1 punto</span>
                </div>
              </div>
              <a
                href="/leaderboard"
                className="block text-center text-xs text-primary hover:text-primary-hover mt-3 transition-colors"
              >
                Ver todos los premios por nivel →
              </a>
            </div>
          )}

        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 border border-white/20"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
