"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";

/** Moved from AppShell's global header (prototype never puts sign-out there; it lives in Perfil → Cuenta, see prototype/js/views/profile.js). Same mechanism as before: authClient.signOut() then redirect to /login. */
export function SignOutButton() {
  const router = useRouter();
  const { clear } = useOfflineData();

  async function signOut() {
    // Clear the local snapshot before signing out so a different account on
    // this device never hydrates this account's cached data.
    await clear();
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
