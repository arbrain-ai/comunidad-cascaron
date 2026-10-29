import 'server-only';

import { NextResponse } from 'next/server';
import { ActionAuthorizationError, requireAdminActionActor } from './server-action-auth';
import { verifyRecordingWorkerRequest } from './internal-request-auth';

/** Require MFA before a route reads business data or executes any side effect.
 * Existing route-specific checks still enforce owner-only and resource rules.
 * An explicit malformed bearer cannot fall back to a valid cookie session.
 */
export async function guardAdminRequest(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s,]+$/.test(authorization)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  }
  try {
    await requireAdminActionActor(authorization === null ? undefined : authorization.slice(7));
    return null;
  } catch (error) {
    if (error instanceof ActionAuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'private, no-store' } });
    }
    return NextResponse.json({ error: 'No se pudo verificar el acceso', code: 'AUTH_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

/** Only the three existing recording worker entry points opt into this path. */
export async function guardRecordingAdminRequest(request: Request): Promise<Response | null> {
  if (verifyRecordingWorkerRequest(request)) return null;
  return guardAdminRequest(request);
}
