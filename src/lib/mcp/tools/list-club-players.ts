import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, STAFF_ROLES, fail, loadMe, ok, resolveClub } from "../club";

export default defineTool({
  name: "list_club_players",
  title: "Listar jugadores del club",
  description:
    "Lista los jugadores aprobados del club efectivo. Disponible para fisios, entrenadores y owner/superadmin. Devuelve JSON estructurado {ok,count,club_id,data,message}.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de jugadores a devolver (por defecto 50)"),
    include_contact: z
      .boolean()
      .optional()
      .describe("Incluir email y teléfono. Por defecto false por minimización de datos."),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 50, club_id, include_contact = false }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");
    if (!STAFF_ROLES.includes(me.role as (typeof STAFF_ROLES)[number])) {
      return fail("forbidden_role", "No tienes permiso para ver jugadores del club.");
    }

    const club = await resolveClub(supabase, me, club_id);
    if (!club.ok) return club.result;

    const columns = include_contact
      ? "id, club_id, email, full_name, phone, role, status, created_at, updated_at"
      : "id, club_id, full_name, role, status, created_at, updated_at";

    const { data, error } = await supabase
      .from("profiles")
      .select(columns)
      .eq("club_id", club.club_id)
      .eq("role", "player")
      .eq("status", "approved")
      .order("full_name", { ascending: true })
      .limit(limit);

    if (error) return fail("query_failed", `Error: ${error.message}`);

    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((p) => ({
      ...p,
      created_at: new Date(p.created_at as string).toISOString(),
      updated_at: new Date(p.updated_at as string).toISOString(),
    }));


    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message:
        rows.length === 0
          ? "No hay jugadores aprobados en este club."
          : `Jugadores del club: ${rows.length}.`,
    });
  },
});
