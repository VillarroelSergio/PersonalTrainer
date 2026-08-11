import { auth } from "@/lib/auth";

export async function currentUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user ? { id: session.user.id } : null;
}
