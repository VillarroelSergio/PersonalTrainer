"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const devSignup = process.env.NODE_ENV === "development";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    setError(null);
    let result: Awaited<ReturnType<typeof authClient.signIn.email>>;
    try {
      result = creating
        ? await authClient.signUp.email({ name: email.split("@")[0] || "Trainer", email, password })
        : await authClient.signIn.email({ email, password });
    } catch {
      setSubmitting(false);
      setError("No pudimos contactar con el servidor. Comprueba que la app sigue ejecutándose e inténtalo de nuevo.");
      return;
    }
    const signInError = result.error;
    setSubmitting(false);
    if (signInError) {
      const code = String(signInError.code ?? "");
      if (creating && /already|exist/i.test(code)) {
        setCreating(false);
        setError("Ese correo ya tiene una cuenta. Cambia a Iniciar sesión y usa tu contraseña.");
      } else if (creating && /disable|sign.?up|not.?allowed/i.test(code)) {
        setError("El registro está desactivado en este entorno. Reinicia el servidor en modo desarrollo.");
      } else if (!creating && /not.?found|invalid.?email|invalid.?password|invalid.?email.?or.?password|credential/i.test(code)) {
        setError("No existe una cuenta con esos datos o la contraseña no coincide. Si la borraste, pulsa Crear cuenta local.");
      } else {
        setError(`${creating ? "No pudimos crear la cuenta" : "No pudimos iniciar sesión"}. ${signInError.message ?? "Revisa los datos e inténtalo de nuevo."}`);
      }
      return;
    }
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main id="mainContent" className="access">
      <p className="kicker">Trainer</p>
      <h1 className="view-title">{creating ? "Crear cuenta" : "Iniciar sesión"}</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="login-email">Correo</label>
          <input id="login-email" type="email" name="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="login-password">Contraseña</label>
          <input id="login-password" type="password" name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting} aria-busy={submitting}>
          {submitting ? (creating ? "Creando…" : "Entrando…") : (creating ? "Crear cuenta" : "Entrar")}
        </button>
      </form>
      {devSignup ? (
        <button type="button" className="btn btn--quiet btn--block" onClick={() => { setCreating((value) => !value); setError(null); }}>
          {creating ? "Ya tengo una cuenta" : "Crear cuenta local"}
        </button>
      ) : null}
    </main>
  );
}
