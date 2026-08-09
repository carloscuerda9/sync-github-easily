import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_player_status",
  title: "Estado de un jugador",
  description: "Devuelve el color de estado asignado por los fisios a un jugador (verde, amarillo, naranja o rojo).",
  inputSchema: {
    player_id: z.string().uuid().describe("ID del jugador"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("player_tags")
      .select("color, created_at")
      .eq("player_id", player_id)
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Este jugador no tiene estado de color asignado." }] };
    }

    const colorNames: Record<string, string> = {
      green: "Verde",
      yellow: "Amarillo",
      orange: "Naranja",
      red: "Rojo",
    };

    return { content: [{ type: "text", text: `Estado del jugador: ${colorNames[data.color] ?? data.color}` }] };
  },
});
