'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/shared/lib/supabase';
import { BRAND } from '@/shared/config/brand';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    setIsLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/community'), 2000);
    }
  };

  if (!hasSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt={BRAND.name}
            width={48}
            height={48}
            className="rounded-xl"
          />
          <h1 className="text-xl font-semibold text-white">
            {success ? 'Contrasena actualizada' : 'Nueva contrasena'}
          </h1>
          {!success && (
            <p className="text-sm text-zinc-400">
              Ingresa tu nueva contrasena
            </p>
          )}
        </div>

        {success ? (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-center text-sm text-green-400">
            Tu contrasena fue actualizada. Redirigiendo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Nueva contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-purple-500"
                autoFocus
                minLength={8}
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Confirmar contrasena"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-purple-500"
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="text-center text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-purple-600 py-3 text-sm font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
            >
              {isLoading ? 'Actualizando...' : 'Actualizar contrasena'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
