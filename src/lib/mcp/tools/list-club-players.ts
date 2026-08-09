import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_club_players",
  title: "Listar jugadores del club",
  description: "Lista los jugadores aprobados del club del usuario autenticado. Solo disponible para fisios, entrenadores y administradores.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de jugadores a devolver (por defecto 50)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 50 }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role, club_id")
      .eq("id", userId)
      .maybeSingle();
    if (meError || !me) {
      return { content: [{ type: "text", text: "No se pudo cargar tu perfil" }], isError: true };
    }
    if (!me.club_id) {
      return { content: [{ type: "text", text: "No perteneces a ningún club" }], isError: true };
    }
    if (!["physio", "coach", "superadmin"].includes(me.role)) {
      return { content: [{ type: "text", text: "No tienes permiso para ver jugadores del club" }], isError: true };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status")
      .eq("club_id", me.club_id)
      .eq("role", "player")
      .eq("status", "approved")
      .order("full_name", { ascending: true })
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "No hay jugadores aprobados en tu club." }] };
    }

    const lines = data.map((p) => `- ${p.full_name ?? p.email} (${p.email}) [ID: ${p.id}]`);
    return { content: [{ type: "text", text: `Jugadores del club (${data.length}):\n${lines.join("\n")}` }] };
  },
});
