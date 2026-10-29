'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabase';
import { BRAND } from '@/shared/config/brand';
import { beginMfaEnrollment, loadMfaState, mfaErrorMessage, mfaLoginPath, safeMfaNext,
  verifyMfaCode, type MfaEnrollment, type MfaState } from '@/shared/lib/mfa-flow';

export default function MfaForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<MfaState | { kind: 'loading' }>({ kind: 'loading' });
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const operation = useRef(false);
  const actor = useRef<string | null>(null);
  const epoch = useRef(0);
  const destination = safeMfaNext(next);

  useEffect(() => {
    let mounted = true;
    const version = epoch.current;
    loadMfaState(supabase.auth).then(result => {
      if (!mounted || epoch.current !== version) return;
      actor.current = result.kind === 'signed_out' ? null : result.userId;
      setState(result);
      if (result.kind === 'challenge') setFactorId(result.factors[0].id);
    }).catch(reason => { if (mounted) setError(mfaErrorMessage(reason)); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (actor.current && session?.user.id !== actor.current)) {
        epoch.current++;
        setEnrollment(null); setCode(''); setFactorId(''); setState({ kind: 'signed_out' });
      }
    });
    return () => { mounted = false; epoch.current++; subscription.unsubscribe(); };
  }, [retry]);

  async function configure() {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    const version = epoch.current;
    try {
      const result = await beginMfaEnrollment(supabase.auth);
      if (version !== epoch.current) return;
      setEnrollment(result); setFactorId(result.factorId); setCode('');
    } catch (reason) { if (version === epoch.current) setError(mfaErrorMessage(reason)); }
    finally { operation.current = false; setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    const version = epoch.current;
    try {
      await verifyMfaCode(supabase.auth, factorId, code);
      if (version !== epoch.current) return;
      setEnrollment(null); setCode('');
      setState({ kind: 'ready', userId: actor.current || '' });
      router.replace(destination); router.refresh();
    } catch (reason) { if (version === epoch.current) setError(mfaErrorMessage(reason)); }
    finally { setCode(''); operation.current = false; setBusy(false); }
  }

  const showCode = state.kind === 'challenge' || enrollment !== null;
  return (
    <main className="sf-auth-shell min-h-dvh flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-6" aria-labelledby="mfa-title">
        <div><p className="text-sm text-primary mb-2">{BRAND.name} · Seguridad</p>
          <h1 id="mfa-title" className="text-2xl font-bold text-foreground">Verificación en dos pasos</h1></div>
        {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        {state.kind === 'loading' && !error && <p role="status">Comprobando tu sesión…</p>}
        {state.kind === 'loading' && error && <button type="button" className="btn-primary w-full"
          onClick={() => { setError(''); setRetry(value => value + 1); }}>Reintentar</button>}
        {state.kind === 'signed_out' && <><p>Inicia sesión para proteger tu cuenta.</p>
          <a className="btn-primary block text-center" href={mfaLoginPath(destination)}>Iniciar sesión</a></>}
        {state.kind === 'setup' && !enrollment && <>
          <p className="text-muted">Protege las operaciones de tu cuenta con un código de tu app autenticadora.</p>
          <p className="text-sm text-muted">Ten a mano tu autenticador y termina la configuración antes de cerrar esta página.</p>
          <button type="button" disabled={busy} className="btn-primary w-full" onClick={configure}>
            {busy ? 'Preparando…' : 'Configurar autenticador'}</button>
        </>}
        {enrollment && <div className="space-y-4">
          <p>Escanea este código con tu app autenticadora y escribe abajo los seis dígitos que aparezcan.</p>
          {/* SVG stays an image, never injected markup. No remote QR service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="Código QR para configurar tu autenticador" width={240} height={240}
            className="mx-auto rounded-lg bg-white p-3" referrerPolicy="no-referrer" />
          <details><summary className="cursor-pointer text-sm text-primary">No puedo escanear el código</summary>
            <p className="text-sm text-muted mt-2">Introduce esta clave en tu autenticador. Guárdala únicamente en tu gestor seguro.</p>
            <code className="block break-all select-all rounded-lg bg-background p-3 mt-2">{enrollment.secret}</code></details>
        </div>}
        {showCode && <form onSubmit={verify} className="space-y-4">
          {state.kind === 'challenge' && <><p className="text-muted">Abre tu app autenticadora y escribe el código de esta cuenta.</p>
            {state.factors.length > 1 && <label className="block text-sm">Autenticador
              <select className="input-field mt-2" value={factorId} disabled={busy} onChange={e => { setFactorId(e.target.value); setCode(''); }}>
                {state.factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Autenticador ${index + 1}`}</option>)}
              </select></label>}</>}
          <label htmlFor="mfa-code" className="block text-sm font-medium">Código de seis dígitos</label>
          <input id="mfa-code" name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-field w-full px-4 py-3 text-center text-2xl tracking-[0.4em]" />
          <button className="btn-primary w-full" type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Verificando…' : 'Verificar y continuar'}</button>
        </form>}
        {state.kind === 'ready' && <><p role="status">Tu sesión ya tiene la verificación de seguridad activa.</p>
          <button className="btn-primary w-full" type="button" onClick={() => { router.replace(destination); router.refresh(); }}>Continuar</button></>}
        <p className="text-xs text-muted">Si perdiste tu autenticador, contacta al administrador. Esta pantalla no desactiva factores ya verificados.</p>
        <a href="/community" className="block text-center text-sm text-muted hover:text-foreground">Volver a la comunidad</a>
      </section>
    </main>
  );
}
