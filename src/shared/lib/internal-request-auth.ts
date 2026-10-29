import { createHash, timingSafeEqual } from 'node:crypto';

type HeaderRequest = { headers: Pick<Headers, 'get'> };

/** Node-only. Compare fixed-size digests without leaking matching prefixes. */
function matchesSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || !expected.trim()) return false;
  return timingSafeEqual(
    createHash('sha256').update(actual).digest(),
    createHash('sha256').update(expected).digest(),
  );
}

/** Vercel and GitHub jobs authenticate with this header, never x-vercel-cron. */
export function verifyCronRequest(request: HeaderRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return false;
  return matchesSecret(request.headers.get('authorization'), `Bearer ${secret}`);
}

/** Existing manual POST callers use this explicit shared-secret header. */
export function verifyLegacyCronSecretHeader(request: HeaderRequest): boolean {
  return matchesSecret(request.headers.get('x-cron-secret'), process.env.CRON_SECRET);
}

/** Preserve the database webhook's header and configured-secret whitespace handling. */
export function verifySupabaseWebhookRequest(request: HeaderRequest): boolean {
  return matchesSecret(
    request.headers.get('x-webhook-secret'),
    process.env.SUPABASE_WEBHOOK_SECRET?.trim(),
  );
}

/** Existing recording pipeline credential; no privilege on other admin routes. */
export function verifyRecordingWorkerRequest(request: HeaderRequest): boolean {
  return matchesSecret(request.headers.get('x-internal-secret'), process.env.INTERNAL_API_SECRET);
}
