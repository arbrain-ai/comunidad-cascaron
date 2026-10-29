// ============================================
// API Route: VAPID public key
// ============================================
// La VAPID public key es informacion publica (viaja en cada subscribe del
// navegador). Este endpoint existe para que el Service Worker pueda
// re-suscribirse en pushsubscriptionchange cuando event.oldSubscription es
// null y no tiene de donde sacar el applicationServerKey (bug historico:
// se suscribia sin key y fallaba en silencio).

import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID no configurado' }, { status: 500 });
  }

  return NextResponse.json(
    { publicKey },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
