import { useAuth } from "@/lib/auth-context";

/** Cuenta propietaria con permisos máximos sobre toda la plataforma. */
export const OWNER_EMAIL = "carloscuerdarenedo@gmail.com";

export function isOwnerEmail(email: string | null | undefined) {
  return (email ?? "").toLowerCase() === OWNER_EMAIL;
}

export function useIsOwner() {
  const { profile } = useAuth();
  return isOwnerEmail(profile?.email);
}
