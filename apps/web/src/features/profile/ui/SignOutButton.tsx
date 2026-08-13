"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Moved from AppShell's global header (prototype never puts sign-out there; it lives in Perfil → Cuenta, see prototype/js/views/profile.js). Same mechanism as before: authClient.signOut() then redirect to /login. */
export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn--ghost btn--block" onClick={signOut}>
      Cerrar sesión
    </button>
  );
}
