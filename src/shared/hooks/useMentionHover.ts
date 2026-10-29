import { useEffect, useRef } from 'react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { getUserCardData, generateUserCardHTML } from '@/shared/services/userCardService';

/**
 * Hook to add hover previews to user mentions in HTML content.
 * Detects <span class="mention"> elements and attaches Tippy.js popovers
 * using the shared UserProfileCard template.
 *
 * - 300ms delay before showing popover
 * - Lazy-loads profile data, cached per session
 * - Click navigates to profile
 */
export function useMentionHover(
  contentRef: React.RefObject<HTMLElement | null>,
  enabled: boolean = true
) {
  const tippyInstancesRef = useRef<TippyInstance[]>([]);

  useEffect(() => {
    if (!enabled || !contentRef.current) return;

    const container = contentRef.current;

    const initializeMentions = () => {
      const mentions = container.querySelectorAll('span.mention[data-id]');

      mentions.forEach((mention) => {
        // Skip if already has Tippy instance
        if ((mention as any)._tippy) return;

        const userId = mention.getAttribute('data-id');
        if (!userId) return;

        // Make mention clickable
        (mention as HTMLElement).style.cursor = 'pointer';
        (mention as HTMLElement).style.transition = 'opacity 0.2s';

        const handleMouseEnter = () => {
          (mention as HTMLElement).style.opacity = '0.8';
        };
        const handleMouseLeave = () => {
          (mention as HTMLElement).style.opacity = '1';
        };

        const handleClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = `/profile/${userId}`;
        };

        mention.addEventListener('mouseenter', handleMouseEnter);
        mention.addEventListener('mouseleave', handleMouseLeave);
        mention.addEventListener('click', handleClick);

        const instance = tippy(mention as Element, {
          content: 'Cargando...',
          allowHTML: true,
          interactive: true,
          placement: 'top',
          delay: [300, 0],
          arrow: true,
          theme: 'mention-preview',
          maxWidth: 320,
          onShow: (inst) => {
            (async () => {
              try {
                const data = await getUserCardData(userId);
                if (data) {
                  inst.setContent(generateUserCardHTML(data));
                } else {
                  inst.setContent('Usuario no encontrado');
                }
              } catch (err) {
                console.error('Error loading mention profile:', err);
                inst.setContent('Error al cargar perfil');
              }
            })();
          },
          onDestroy: () => {
            mention.removeEventListener('mouseenter', handleMouseEnter);
            mention.removeEventListener('mouseleave', handleMouseLeave);
            mention.removeEventListener('click', handleClick);
          }
        });

        tippyInstancesRef.current.push(instance);
      });
    };

    initializeMentions();

    // Watch for dynamically added mentions
    const observer = new MutationObserver(() => {
      initializeMentions();
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      tippyInstancesRef.current.forEach((instance) => instance.destroy());
      tippyInstancesRef.current = [];
    };
  }, [contentRef, enabled]);
}
