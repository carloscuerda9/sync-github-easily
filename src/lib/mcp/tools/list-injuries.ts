import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_injuries",
  title: "Consultar lesiones",
  description:
    "Consulta las lesiones registradas en el histórico clínico, con filtros opcionales por jugador y rango de fechas.",
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
      .from("injuries")
      .select("id, player_id, injury_date, body_part, injury_type, severity, treatment, recovery_days, notes")
      .order("injury_date", { ascending: false })
      .limit(limit);

    if (player_id) query = query.eq("player_id", player_id);
    if (from_date) query = query.gte("injury_date", from_date);
    if (to_date) query = query.lte("injury_date", to_date);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "No hay lesiones registradas con esos filtros." }] };
    }

    const ids = [...new Set(data.map((r) => r.player_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));

    const lines = data.map(
      (r) =>
        `- ${r.injury_date} · ${names.get(r.player_id) ?? r.player_id} · ${r.body_part} (${r.injury_type})` +
        `${r.severity ? ` · ${r.severity}` : ""}${r.recovery_days != null ? ` · ${r.recovery_days} días` : ""}` +
        `${r.treatment ? ` — ${r.treatment}` : ""}`,
    );

    return {
      content: [{ type: "text", text: `Lesiones (${data.length}):\n${lines.join("\n")}` }],
      structuredContent: { count: data.length },
    };
  },
});
