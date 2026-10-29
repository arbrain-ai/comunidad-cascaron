// ============================================
// API Route: el estado de la sala EN VIVO
// ============================================
// GET /api/video-calling/sala/estado?session_id=...&identidades=a,b,c
//
// Lo pide cada cliente al entrar, cada pocos segundos y cada vez que Realtime
// avisa que cambio `estado_version`. De paso dispara el arbitro
// (reconciliar): turnos vencidos, cierre por reloj y "ya entro el anfitrion".
// Asi la sala se gobierna sola aunque el anfitrion cierre la pestaña: basta
// con que UN cliente siga preguntando.

import { NextRequest, NextResponse, after } from 'next/server';
import { quienLlama } from '../_auth';
import { cargarSesion, estadoParaCliente, reconciliar, nombreSala } from '@/features/video-calling/services/salaService';
import { asegurarPistasGrabadas } from '@/features/video-calling/services/recordingService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const quien = await quienLlama(request);
    if (!quien) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    const identidades = (searchParams.get('identidades') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

    const cargada = await cargarSesion(sessionId);
    if (!cargada) return NextResponse.json({ error: 'Sesion no encontrada' }, { status: 404 });

    const reconciliada = await reconciliar(cargada);
    // 6 oct 2026: el mismo polling que gobierna la sala vigila la grabacion. Si
    // el ancla vive, cada pista publicada debe estar grabandose; lo que falte
    // (egress que no conecto, webhook perdido, reconexion) se repara solo.
    // Con freno de 20 s por sesion y fuera de la respuesta al cliente.
    if (!reconciliada.sesion.ended_at) {
      const sala = nombreSala(reconciliada.sala);
      after(async () => {
        await asegurarPistasGrabadas(sala, sessionId).catch((err) => console.error('[sala/estado] arbitro de grabacion:', err));
      });
    }
    const estado = await estadoParaCliente(reconciliada, quien.id, quien.role, identidades, searchParams.get('yo'));
    return NextResponse.json({ success: true, data: estado });
  } catch (error) {
    console.error('[sala/estado] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
