// ============================================
// prefetchFull — prefetch REAL de una ruta dinámica
// ============================================
// `router.prefetch(href)` usa kind:'auto', y para una página DINÁMICA eso
// precarga solo la cáscara: al navegar, el payload RSC se vuelve a pedir
// igual (medido: 253ms de espera en una tarjeta que ya se había
// "prefetcheado"). El único kind que trae la página entera es 'full' — es lo
// que hace <Link prefetch={true}> por dentro.
//
// No se importa PrefetchKind de las tripas de Next (ruta interna que cambia
// entre versiones): se declara la forma que necesitamos. Next compara contra
// los strings 'auto' | 'full'.

type FullPrefetchRouter = {
  prefetch: (href: string, options?: { kind: 'auto' | 'full' }) => void;
};

export function prefetchFull(
  router: { prefetch: (href: string) => void },
  href: string
): void {
  try {
    (router as unknown as FullPrefetchRouter).prefetch(href, { kind: 'full' });
  } catch {
    // Si una versión futura cambia la firma, degradamos al prefetch normal
    // en vez de romper la navegación.
    router.prefetch(href);
  }
}
