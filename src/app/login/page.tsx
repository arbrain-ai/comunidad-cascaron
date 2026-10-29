'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/shared/lib/supabase';
import { getAuthCallbackUrl } from '@/shared/utils/getRedirectUrl';
import { safeLoginRedirect } from '@/shared/lib/safe-login-redirect';
import { BRAND } from '@/shared/config/brand';

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password' | 'verify_otp';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Default to /community - Server Layout handles access control
  // Users with access → community, users without → redirected to /about
  const redirectTo = safeLoginRedirect(searchParams.get('redirect'));
  const [view, setView] = useState<AuthView>('sign_in');

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const resetState = () => {
    setError(null);
    setMessage(null);
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      resetState();

      const redirectUrl = getAuthCallbackUrl(`/auth/callback?next=${encodeURIComponent(redirectTo)}`);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setError('Error al iniciar sesión con Google');
        setGoogleLoading(false);
      }
    } catch {
      setError('Error inesperado');
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(loginError.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : loginError.message);
        setLoading(false);
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push(redirectTo);
      }
    } catch {
      setError('Error inesperado');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(`/auth/callback?next=${encodeURIComponent(redirectTo)}`),
          data: {
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
      } else {
        setView('verify_otp');
        setMessage('Te enviamos un código de verificación. Revisa tu bandeja de entrada y SPAM.');
        setLoading(false);
      }
    } catch {
      setError('Error inesperado');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      });

      if (verifyError) {
        setError(verifyError.message === 'Token has expired or is invalid'
          ? 'Código inválido o expirado'
          : verifyError.message);
        setLoading(false);
      } else {
        router.push(redirectTo);
      }
    } catch {
      setError('Error inesperado');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthCallbackUrl('/auth/callback?next=/reset-password'),
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage('Te enviamos un link para restablecer tu contraseña. Revisa tu bandeja de entrada y SPAM.');
      }
      setLoading(false);
    } catch {
      setError('Error inesperado');
      setLoading(false);
    }
  };

  const renderTitle = () => {
    switch (view) {
      case 'sign_in': return 'Bienvenido de vuelta';
      case 'sign_up': return 'Crear cuenta';
      case 'forgot_password': return 'Recuperar contraseña';
      case 'verify_otp': return 'Verificar código';
    }
  };

  const renderSubtitle = () => {
    switch (view) {
      case 'sign_in': return 'Acceso exclusivo para miembros';
      case 'sign_up': return `Únete a ${BRAND.name}`;
      case 'forgot_password': return 'Te enviaremos un link a tu email';
      case 'verify_otp': return `Ingresa el código enviado a ${email}`;
    }
  };

  return (
    <div className="sf-auth-shell flex flex-col items-center justify-center px-4 py-8">
      <div className="sf-atmosphere" />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-flex flex-col items-center gap-3">
            <Image
              src="/logo.png"
              alt={BRAND.name}
              width={96}
              height={96}
              priority
              className="relative sf-brand-glow rounded-2xl"
            />
            <p className="text-xl font-bold text-foreground">{BRAND.name}</p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="sf-auth-card p-6 md:p-8">
          <h1 className="text-2xl font-sans font-black text-foreground text-center mb-2">
            {renderTitle()}
          </h1>
          <p className="text-muted text-center mb-6">
            {renderSubtitle()}
          </p>

          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
              <p className="text-emerald-400 text-sm text-center">{message}</p>
            </div>
          )}

          {/* Sign In View */}
          {view === 'sign_in' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="btn-secondary w-full p-4 font-semibold disabled:opacity-50 mb-6"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.44h5.92c-.26 1.44-1.08 2.65-2.29 3.44v2.88h3.68c2.14-1.96 3.38-4.83 3.38-8.07z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.68-2.88c-.98.66-2.23 1.05-3.6 1.05-2.8 0-5.17-1.89-6.02-4.44H2.24v2.97C4.01 20.93 7.72 23 12 23z" fill="#34A853"/>
                    <path d="M5.98 14.04c-.2-.6-.31-1.24-.31-1.9s.11-1.31.31-1.9V7.27H2.24C1.48 8.79.96 10.68.96 12.63s.52 3.84 1.28 5.37l3.74-2.96z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.27-3.27C17.45 1.96 14.97 1 12 1 7.72 1 4.01 3.07 2.24 6.14l3.74 2.97c.85-2.55 3.22-4.44 6.02-4.44z" fill="#EA4335"/>
                  </svg>
                )}
                Continuar con Google
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-subtle"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="sf-divider-label px-4">o continúa con email</span>
                </div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="input-field px-4 py-3"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  minLength={6}
                  className="input-field px-4 py-3"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Ingresando...' : 'Iniciar sesión'}
                </button>
              </form>

              <div className="flex justify-between text-sm mt-4">
                <button
                  onClick={() => { setView('sign_up'); resetState(); }}
                  className="text-primary hover:underline"
                >
                  Crear cuenta
                </button>
                <button
                  onClick={() => { setView('forgot_password'); resetState(); }}
                  className="text-muted hover:text-foreground"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </>
          )}

          {/* Sign Up View */}
          {view === 'sign_up' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="btn-secondary w-full p-4 font-semibold disabled:opacity-50 mb-6"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.44h5.92c-.26 1.44-1.08 2.65-2.29 3.44v2.88h3.68c2.14-1.96 3.38-4.83 3.38-8.07z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.68-2.88c-.98.66-2.23 1.05-3.6 1.05-2.8 0-5.17-1.89-6.02-4.44H2.24v2.97C4.01 20.93 7.72 23 12 23z" fill="#34A853"/>
                    <path d="M5.98 14.04c-.2-.6-.31-1.24-.31-1.9s.11-1.31.31-1.9V7.27H2.24C1.48 8.79.96 10.68.96 12.63s.52 3.84 1.28 5.37l3.74-2.96z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.27-3.27C17.45 1.96 14.97 1 12 1 7.72 1 4.01 3.07 2.24 6.14l3.74 2.97c.85-2.55 3.22-4.44 6.02-4.44z" fill="#EA4335"/>
                  </svg>
                )}
                Continuar con Google
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-subtle"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="sf-divider-label px-4">o regístrate con email</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Nombre"
                    required
                    minLength={2}
                    className="input-field px-4 py-3"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Apellido"
                    required
                    minLength={2}
                    className="input-field px-4 py-3"
                  />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="input-field px-4 py-3"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña (mín. 6 caracteres)"
                  required
                  minLength={6}
                  className="input-field px-4 py-3"
                />
                <button
                  type="submit"
                  disabled={loading || firstName.trim().length < 2 || lastName.trim().length < 2}
                  className="btn-primary w-full"
                >
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </form>

              <p className="text-center text-sm text-muted mt-4">
                ¿Ya tienes cuenta?{' '}
                <button
                  onClick={() => { setView('sign_in'); resetState(); }}
                  className="text-primary hover:underline"
                >
                  Iniciar sesión
                </button>
              </p>
            </>
          )}

          {/* Verify OTP View */}
          {view === 'verify_otp' && (
            <>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Código de 6 dígitos"
                  required
                  maxLength={6}
                  className="input-field px-4 py-4 text-center text-2xl tracking-[0.5em] placeholder:text-base placeholder:tracking-normal"
                />
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn-primary w-full"
                >
                  {loading ? 'Verificando...' : 'Verificar código'}
                </button>
              </form>

              <p className="text-center text-sm text-muted mt-4">
                ¿No recibiste el código?{' '}
                <button
                  onClick={() => { setView('sign_up'); resetState(); setOtp(''); }}
                  className="text-primary hover:underline"
                >
                  Reintentar
                </button>
              </p>
            </>
          )}

          {/* Forgot Password View */}
          {view === 'forgot_password' && (
            <>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="input-field px-4 py-3"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperación'}
                </button>
              </form>

              <p className="text-center text-sm text-muted mt-4">
                <button
                  onClick={() => { setView('sign_in'); resetState(); }}
                  className="text-primary hover:underline"
                >
                  ← Volver al inicio de sesión
                </button>
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LoginFallback() {
  return (
    <div className="min-h-dvh sf-auth-shell flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
