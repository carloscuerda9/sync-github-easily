import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, fail, loadMe, ok, resolveClubOptional } from "../club";

export default defineTool({
  name: "list_my_appointments",
  title: "Listar mis citas",
  description:
    "Lista las citas próximas del usuario autenticado en WE FIX YOU. Devuelve JSON estructurado {ok,count,club_id,data,message}.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de citas a devolver (por defecto 10)"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club de contexto. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 10, club_id }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");

    const effectiveClub = await resolveClubOptional(supabase, me, club_id);
    const userId = me.id;

    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, player_id, physio_id, scheduled_at, duration_minutes, type, status, notes, created_at, updated_at",
      )
      .or(`player_id.eq.${userId},physio_id.eq.${userId}`)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (error) return fail("query_failed", `Error al consultar citas: ${error.message}`);

    const rows = (data ?? []).map((a) => ({
      ...a,
      club_id: effectiveClub,
      scheduled_at: new Date(a.scheduled_at).toISOString(),
      created_at: new Date(a.created_at).toISOString(),
      updated_at: new Date(a.updated_at).toISOString(),
    }));

    return ok({
      count: rows.length,
      club_id: effectiveClub,
      data: rows,
      message: rows.length === 0 ? "No tienes citas próximas." : `Tienes ${rows.length} cita(s) próxima(s).`,
    });
  },
});
