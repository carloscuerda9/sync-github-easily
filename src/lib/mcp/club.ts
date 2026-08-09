import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Capa compartida de resolución de club efectivo y respuestas JSON para el MCP.
 * Todo se ejecuta con el JWT del usuario (RLS activa). No se usa service_role.
 */

export type SupabaseUserClient = ReturnType<typeof import("./supabase").supabaseForUser>;

export type Me = {
  id: string;
  role: string;
  club_id: string | null;
  full_name: string | null;
  email: string;
  status: string;
};

/** Roles con alcance de administración global (owner / superadmin). */
export const ADMIN_ROLES = ["superadmin"] as const;
/** Roles de staff que pueden leer datos de todo su club. */
export const STAFF_ROLES = ["physio", "coach", "superadmin"] as const;

export function isAdminRole(role: string | undefined | null): boolean {
  return ADMIN_ROLES.includes((role ?? "") as (typeof ADMIN_ROLES)[number]);
}

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function ok(payload: {
  count: number;
  club_id: string | null;
  data: unknown[];
  message: string;
  extra?: Record<string, unknown>;
}): ToolResult {
  const body = {
    ok: true as const,
    count: payload.count,
    club_id: payload.club_id,
    data: payload.data,
    message: payload.message,
    ...(payload.extra ?? {}),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
    structuredContent: body,
  };
}

export function fail(error_code: string, message: string, extra?: Record<string, unknown>): ToolResult {
  const body = { ok: false as const, error_code, message, ...(extra ?? {}) };
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
    structuredContent: body,
    isError: true,
  };
}

export const NOT_AUTHENTICATED = () => fail("not_authenticated", "No autenticado.");

/** Respuesta idéntica para jugador inexistente y jugador de otro club (anti-enumeración). */
export const PLAYER_NOT_FOUND = () =>
  fail("player_not_found", "No se ha encontrado ningún jugador con ese identificador en tu club.");

export async function loadMe(supabase: SupabaseUserClient, ctx: ToolContext): Promise<Me | null> {
  const userId = ctx.getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, club_id, full_name, email, status")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Me;
}

export type ClubResolution =
  | { ok: true; club_id: string }
  | { ok: false; result: ToolResult };

/**
 * Resuelve el club efectivo para la llamada.
 *
 * - Usuario con club_id -> ese club SIEMPRE (un club_id recibido se ignora).
 * - Owner/superadmin sin club_id -> el club_id solicitado, si pertenece a los clubes
 *   que administra; si no lo pasa y solo administra uno, ese; si administra varios,
 *   error con la lista de clubes.
 */
export async function resolveClub(
  supabase: SupabaseUserClient,
  me: Me,
  requestedClubId?: string,
): Promise<ClubResolution> {
  // Cualquier rol con club propio queda anclado a su club: club_id de entrada se ignora.
  if (me.club_id) return { ok: true, club_id: me.club_id };

  if (!isAdminRole(me.role)) {
    return { ok: false, result: fail("no_club", "No perteneces a ningún club.") };
  }

  // Owner/superadmin sin club propio: clubes visibles bajo sus RLS.
  const { data: clubs, error } = await supabase.from("clubs").select("id, name").order("name");
  if (error) {
    return { ok: false, result: fail("clubs_unavailable", `No se pudieron cargar los clubes: ${error.message}`) };
  }
  const available = clubs ?? [];

  if (requestedClubId) {
    const match = available.find((c) => c.id === requestedClubId);
    if (!match) {
      return {
        ok: false,
        result: fail("club_not_allowed", "El club indicado no está entre los clubes que administras.", {
          clubs: available,
        }),
      };
    }
    return { ok: true, club_id: match.id };
  }

  if (available.length === 0) {
    return { ok: false, result: fail("no_club", "No administras ningún club.") };
  }
  if (available.length === 1) return { ok: true, club_id: available[0]!.id };

  return {
    ok: false,
    result: fail(
      "club_required",
      "Administras varios clubes. Repite la llamada indicando el parámetro club_id con uno de los clubes disponibles.",
      { clubs: available },
    ),
  };
}

/** Igual que resolveClub pero devuelve null en vez de error cuando no hay club determinable. */
export async function resolveClubOptional(
  supabase: SupabaseUserClient,
  me: Me,
  requestedClubId?: string,
): Promise<string | null> {
  const res = await resolveClub(supabase, me, requestedClubId);
  return res.ok ? res.club_id : null;
}

export type PlayerRef = {
  id: string;
  club_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  status: string;
};

/**
 * Comprueba que el jugador existe Y pertenece al club efectivo.
 * Devuelve null cuando no existe o es de otro club (misma respuesta para ambos casos).
 */
export async function findPlayerInClub(
  supabase: SupabaseUserClient,
  playerId: string,
  clubId: string,
): Promise<PlayerRef | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, club_id, full_name, email, role, status")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlayerRef;
}

/** Mapa id -> nombre legible para los jugadores del club. */
export async function playerNames(
  supabase: SupabaseUserClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
}

/** Ids de los jugadores del club efectivo (para acotar consultas sin club_id propio). */
export async function clubPlayerIds(supabase: SupabaseUserClient, clubId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("id").eq("club_id", clubId).eq("role", "player");
  return (data ?? []).map((p) => p.id);
}
