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

const COLORS = ["green", "yellow", "orange", "red"] as const;
type Color = (typeof COLORS)[number];

type PeriodRow = {
  player_id: string;
  color: string;
  dias_en_color: number | null;
  valid_from: string;
  periodo_abierto: boolean | null;
};

const round = (n: number, d: number) => Number(n.toFixed(d));

export default defineTool({
  name: "get_tag_stats",
  title: "Estadísticas de estados de color",
  description:
    "Estadísticas agregadas de estados de color: cuántas veces y cuántos días acumulados ha estado cada jugador en cada color. Sin player_id, devuelve todo el club.",
  inputSchema: {
    player_id: z.string().uuid().optional().describe("Filtrar por jugador"),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Desde (YYYY-MM-DD)"),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hasta (YYYY-MM-DD)"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, from_date, to_date, club_id }, ctx) => {
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

    const view = (supabase as unknown as { from: (t: string) => any }).from("v_player_tag_periods");
    let query = view
      .select("player_id, color, dias_en_color, valid_from, periodo_abierto")
      .eq("club_id", club.club_id);

    if (player_id) query = query.eq("player_id", player_id);
    if (from_date) query = query.gte("valid_from", `${from_date}T00:00:00Z`);
    if (to_date) query = query.lte("valid_from", `${to_date}T23:59:59Z`);

    const { data, error } = (await query) as { data: PeriodRow[] | null; error: { message: string } | null };
    if (error) return fail("query_failed", `Error: ${error.message}`);

    const raw = data ?? [];
    const byPlayer = new Map<
      string,
      {
        por_color: Record<Color, { veces: number; dias: number }>;
        total_cambios: number;
        color_actual: string | null;
        dias_totales: number;
      }
    >();

    for (const r of raw) {
      let entry = byPlayer.get(r.player_id);
      if (!entry) {
        entry = {
          por_color: {
            green: { veces: 0, dias: 0 },
            yellow: { veces: 0, dias: 0 },
            orange: { veces: 0, dias: 0 },
            red: { veces: 0, dias: 0 },
          },
          total_cambios: 0,
          color_actual: null,
          dias_totales: 0,
        };
        byPlayer.set(r.player_id, entry);
      }
      const dias = Number(r.dias_en_color ?? 0);
      const c = r.color as Color;
      if (entry.por_color[c]) {
        entry.por_color[c].veces += 1;
        entry.por_color[c].dias += dias;
      }
      entry.total_cambios += 1;
      entry.dias_totales += dias;
      if (r.periodo_abierto) entry.color_actual = r.color;
    }

    const names = await playerNames(supabase, [...byPlayer.keys()]);

    const rows = [...byPlayer.entries()].map(([pid, e]) => {
      const riesgo = e.por_color.orange.dias + e.por_color.red.dias;
      return {
        player_id: pid,
        player_name: names.get(pid) ?? null,
        por_color: Object.fromEntries(
          COLORS.map((c) => [c, { veces: e.por_color[c].veces, dias: round(e.por_color[c].dias, 2) }]),
        ),
        total_cambios: e.total_cambios,
        color_actual: e.color_actual,
        dias_totales: round(e.dias_totales, 2),
        pct_tiempo_en_riesgo: e.dias_totales > 0 ? round((riesgo / e.dias_totales) * 100, 1) : 0,
      };
    });

    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message: `Estadísticas de estado para ${rows.length} jugador(es).`,
    });
  },
});
