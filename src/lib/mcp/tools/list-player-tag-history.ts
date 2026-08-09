import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import {
  NOT_AUTHENTICATED,
  PLAYER_NOT_FOUND,
  fail,
  findPlayerInClub,
  loadMe,
  ok,
  playerNames,
  resolveClub,
} from "../club";

type PeriodRow = {
  id: string;
  player_id: string;
  club_id: string | null;
  color: string;
  previous_color: string | null;
  set_by: string | null;
  reason: string | null;
  valid_from: string;
  valid_to: string;
  dias_en_color: number | null;
  periodo_abierto: boolean | null;
};

export default defineTool({
  name: "list_player_tag_history",
  title: "Histórico de estados de color",
  description:
    "Devuelve el histórico de cambios de color de estado de los jugadores del club, con el color anterior, quién lo cambió y cuándo. Filtros por jugador y rango de fechas.",
  inputSchema: {
    player_id: z.string().uuid().optional().describe("Filtrar por jugador"),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Desde (YYYY-MM-DD)"),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hasta (YYYY-MM-DD)"),
    color: z.enum(["green", "yellow", "orange", "red"]).optional().describe("Filtrar por color"),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (por defecto 50)"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, from_date, to_date, color, limit = 50, club_id }, ctx) => {
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

    // La vista no está en los tipos generados; RLS (security_invoker) sigue aplicando.
    const view = (supabase as unknown as {
      from: (t: string) => any;
    }).from("v_player_tag_periods");

    let query = view
      .select(
        "id, player_id, club_id, color, previous_color, set_by, reason, valid_from, valid_to, dias_en_color, periodo_abierto",
      )
      .eq("club_id", club.club_id)
      .order("valid_from", { ascending: false })
      .limit(limit);

    if (player_id) query = query.eq("player_id", player_id);
    if (color) query = query.eq("color", color);
    if (from_date) query = query.gte("valid_from", `${from_date}T00:00:00Z`);
    if (to_date) query = query.lte("valid_from", `${to_date}T23:59:59Z`);

    const { data, error } = (await query) as { data: PeriodRow[] | null; error: { message: string } | null };
    if (error) return fail("query_failed", `Error: ${error.message}`);

    const raw = data ?? [];
    const names = await playerNames(supabase, [...new Set(raw.map((r) => r.player_id))]);

    const rows = raw.map((r) => ({ ...r, player_name: names.get(r.player_id) ?? null }));

    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message: `Histórico de estados: ${rows.length} registros.`,
    });
  },
});
