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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError("No pudimos iniciar sesión. Revisa tu correo y contraseña.");
      return;
    }
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main id="mainContent" className="access">
      <p className="kicker">Trainer</p>
      <h1 className="view-title">Iniciar sesión</h1>
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
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
