import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import {
  NOT_AUTHENTICATED,
  PLAYER_NOT_FOUND,
  clubPlayerIds,
  fail,
  findPlayerInClub,
  loadMe,
  ok,
  playerNames,
  resolveClub,
} from "../club";

export default defineTool({
  name: "list_match_minutes",
  title: "Consultar minutos jugados",
  description:
    "Consulta los minutos jugados registrados en el club efectivo, con filtros opcionales por jugador y rango de fechas. JSON estructurado {ok,count,club_id,data,message,total_minutes}.",
  inputSchema: {
    player_id: z.string().uuid().optional().describe("Filtrar por jugador"),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Desde (YYYY-MM-DD)"),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hasta (YYYY-MM-DD)"),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (por defecto 50)"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, from_date, to_date, limit = 50, club_id }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");

    const club = await resolveClub(supabase, me, club_id);
    if (!club.ok) return club.result;

    if (player_id) {
      const player = await findPlayerInClub(supabase, player_id, club.club_id);
      if (!player) return PLAYER_NOT_FOUND();
    }

    let query = supabase
      .from("match_minutes")
      .select(
        "id, player_id, club_id, recorded_by, match_date, opponent, competition, minutes_played, started, notes, created_at, updated_at",
      )
      .eq("club_id", club.club_id)
      .order("match_date", { ascending: false })
      .limit(limit);

    if (player_id) query = query.eq("player_id", player_id);
    if (from_date) query = query.gte("match_date", from_date);
    if (to_date) query = query.lte("match_date", to_date);

    const { data, error } = await query;
    if (error) return fail("query_failed", `Error: ${error.message}`);

    const raw = data ?? [];
    const names = await playerNames(supabase, [...new Set(raw.map((r) => r.player_id))]);
    // clubPlayerIds queda disponible para futuras consultas sin columna club_id.
    void clubPlayerIds;

    const rows = raw.map((r) => ({
      ...r,
      player_name: names.get(r.player_id) ?? null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));

    const total = rows.reduce((sum, r) => sum + (r.minutes_played ?? 0), 0);

    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message:
        rows.length === 0
          ? "No hay minutos registrados con esos filtros."
          : `Registros: ${rows.length}, total ${total} min.`,
      extra: { total_minutes: total },
    });
  },
});
