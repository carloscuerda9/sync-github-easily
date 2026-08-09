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

const round = (n: number, d: number) => Number(n.toFixed(d));

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default defineTool({
  name: "get_workload_metrics",
  title: "Métricas de carga",
  description:
    "Métricas de carga por jugador: minutos en 7 y 28 días, ratio agudo:crónico y alertas. Ratio >1.5 indica pico de carga; <0.8, subcarga.",
  inputSchema: {
    player_id: z.string().uuid().optional().describe("Filtrar por jugador"),
    reference_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Fecha de referencia (YYYY-MM-DD). Por defecto, hoy."),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, reference_date, club_id }, ctx) => {
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

    const hasta = reference_date ?? new Date().toISOString().slice(0, 10);
    const desde = shiftDays(hasta, -28);
    const desde7 = shiftDays(hasta, -7);

    let query = supabase
      .from("match_minutes")
      .select("player_id, match_date, minutes_played, minutos_amarilla")
      .eq("club_id", club.club_id)
      .gte("match_date", desde)
      .lte("match_date", hasta);

    if (player_id) query = query.eq("player_id", player_id);

    const { data, error } = await query;
    if (error) return fail("query_failed", `Error: ${error.message}`);

    const raw = data ?? [];
    const agg = new Map<string, { min_7d: number; min_28d: number; partidos_28d: number; amarilla: number }>();
    for (const r of raw) {
      const e = agg.get(r.player_id) ?? { min_7d: 0, min_28d: 0, partidos_28d: 0, amarilla: 0 };
      const mins = r.minutes_played ?? 0;
      e.min_28d += mins;
      e.partidos_28d += 1;
      e.amarilla += r.minutos_amarilla ?? 0;
      if (r.match_date >= desde7) e.min_7d += mins;
      agg.set(r.player_id, e);
    }

    const ids = [...agg.keys()];
    const names = await playerNames(supabase, ids);

    const colors = new Map<string, string>();
    if (ids.length > 0) {
      const { data: tags } = await supabase.from("player_tags").select("player_id, color").in("player_id", ids);
      for (const t of tags ?? []) colors.set(t.player_id, t.color);
    }

    let alertas_totales = 0;
    const rows = ids.map((pid) => {
      const e = agg.get(pid)!;
      const carga_cronica_semanal = round(e.min_28d / 4, 1);
      const ratio = carga_cronica_semanal > 0 ? round(e.min_7d / carga_cronica_semanal, 2) : null;
      const color = colors.get(pid) ?? null;

      const alertas: string[] = [];
      if (ratio !== null && ratio > 1.5) alertas.push("pico_carga");
      if (ratio !== null && ratio < 0.8 && e.min_28d > 0) alertas.push("subcarga");
      if ((color === "orange" || color === "red") && e.min_7d > 0) alertas.push("juega_en_riesgo");
      if (alertas.length > 0) alertas_totales += 1;

      return {
        player_id: pid,
        player_name: names.get(pid) ?? null,
        color_actual: color,
        min_7d: e.min_7d,
        min_28d: e.min_28d,
        partidos_28d: e.partidos_28d,
        minutos_amarilla_28d: e.amarilla,
        carga_cronica_semanal,
        ratio_agudo_cronico: ratio,
        alertas,
        ventana: { desde, hasta },
      };
    });

    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message: `Métricas de carga de ${rows.length} jugador(es).`,
      extra: { alertas_totales, ventana: { desde, hasta } },
    });
  },
});
