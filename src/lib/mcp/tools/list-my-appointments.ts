import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_appointments",
  title: "Listar mis citas",
  description: "Lista las citas próximas del usuario autenticado en WE FIX YOU.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de citas a devolver (por defecto 10)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 10 }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data, error } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, type, duration_minutes, player_id, physio_id")
      .or(`player_id.eq.${userId},physio_id.eq.${userId}`)
      .order("scheduled_at", { ascending: true })
      .gte("scheduled_at", new Date().toISOString())
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: `Error al consultar citas: ${error.message}` }], isError: true };
    }
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "No tienes citas próximas." }] };
    }

    const lines = data.map((a) => {
      const date = new Date(a.scheduled_at).toLocaleString("es-ES");
      const typeLabel: Record<string, string> = {
        in_person: "Descarga",
        home_visit: "Prevención",
        sports_event: "Lesión",
      };
      const statusLabel: Record<string, string> = {
        requested: "Pendiente",
        confirmed: "Confirmada",
        cancelled: "Cancelada",
        completed: "Completada",
        rejected: "Rechazada",
      };
      return `- ${date} | ${typeLabel[a.type] ?? a.type} | ${statusLabel[a.status] ?? a.status} | ${a.duration_minutes} min`;
    });

    return { content: [{ type: "text", text: `Citas próximas:\n${lines.join("\n")}` }] };
  },
});
