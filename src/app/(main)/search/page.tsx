'use client';

import { useRouter } from 'next/navigation';
import { SearchOverlay } from '@/features/search/components/SearchOverlay';

/**
 * /search abre la paleta de búsqueda a pantalla completa.
 * Al cerrarla vuelve a la comunidad.
 */
export default function SearchPage() {
  const router = useRouter();
  return <SearchOverlay isOpen onClose={() => router.push('/community')} />;
}
