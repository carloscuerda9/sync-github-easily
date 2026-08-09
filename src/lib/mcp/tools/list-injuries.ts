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
  name: "list_injuries",
  title: "Consultar lesiones",
  description:
    "Consulta las lesiones del histórico clínico del club efectivo, con filtros opcionales por jugador y rango de fechas. JSON estructurado {ok,count,club_id,data,message}.",
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

    let playerFilter: string[] | null = null;
    if (player_id) {
      const player = await findPlayerInClub(supabase, player_id, club.club_id);
      if (!player) return PLAYER_NOT_FOUND();
      playerFilter = [player_id];
    } else {
      // injuries no tiene columna club_id: acotamos por los jugadores del club.
      playerFilter = await clubPlayerIds(supabase, club.club_id);
      if (playerFilter.length === 0) {
        return ok({
          count: 0,
          club_id: club.club_id,
          data: [],
          message: "No hay lesiones registradas con esos filtros.",
        });
      }
    }

    let query = supabase
      .from("injuries")
      .select(
        "id, player_id, physio_id, injury_date, body_part, injury_type, severity, treatment, recovery_days, notes, created_at",
      )
      .in("player_id", playerFilter)
      .order("injury_date", { ascending: false })
      .limit(limit);

    if (from_date) query = query.gte("injury_date", from_date);
    if (to_date) query = query.lte("injury_date", to_date);

    const { data, error } = await query;
    if (error) return fail("query_failed", `Error: ${error.message}`);

    const raw = data ?? [];
    const names = await playerNames(supabase, [...new Set(raw.map((r) => r.player_id))]);

    const rows = raw.map((r) => ({
      ...r,
      club_id: club.club_id,
      player_name: names.get(r.player_id) ?? null,
      created_at: new Date(r.created_at).toISOString(),
    }));

    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message: rows.length === 0 ? "No hay lesiones registradas con esos filtros." : `Lesiones: ${rows.length}.`,
    });
  },
});
