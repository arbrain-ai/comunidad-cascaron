/** Bounded entry requests, including browsers without AbortSignal.timeout. */
export async function entryRequest(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => { expired = true; controller.abort(); }, timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (expired) { const timeout = new Error('La sala tardó demasiado en responder.'); timeout.name = 'TimeoutError'; throw timeout; }
    throw error;
  } finally { clearTimeout(timer); }
}
