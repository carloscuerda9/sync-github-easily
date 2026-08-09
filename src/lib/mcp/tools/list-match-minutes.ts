import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_match_minutes",
  title: "Consultar minutos jugados",
  description:
    "Consulta los minutos jugados registrados, con filtros opcionales por jugador y rango de fechas. Devuelve también el total acumulado.",
  inputSchema: {
    player_id: z.string().uuid().optional().describe("Filtrar por jugador"),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Desde (YYYY-MM-DD)"),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hasta (YYYY-MM-DD)"),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (por defecto 50)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, from_date, to_date, limit = 50 }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("match_minutes")
      .select("id, player_id, match_date, opponent, competition, minutes_played, started, notes")
      .order("match_date", { ascending: false })
      .limit(limit);

    if (player_id) query = query.eq("player_id", player_id);
    if (from_date) query = query.gte("match_date", from_date);
    if (to_date) query = query.lte("match_date", to_date);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "No hay minutos registrados con esos filtros." }] };
    }

    const ids = [...new Set(data.map((r) => r.player_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));

    const total = data.reduce((sum, r) => sum + (r.minutes_played ?? 0), 0);
    const lines = data.map(
      (r) =>
        `- ${r.match_date} · ${names.get(r.player_id) ?? r.player_id} · ${r.minutes_played} min` +
        `${r.opponent ? ` vs ${r.opponent}` : ""}${r.competition ? ` (${r.competition})` : ""}` +
        `${r.started ? " · titular" : ""}${r.notes ? ` — ${r.notes}` : ""}`,
    );

    return {
      content: [{ type: "text", text: `Registros (${data.length}), total ${total} min:\n${lines.join("\n")}` }],
      structuredContent: { count: data.length, total_minutes: total },
    };
  },
});
