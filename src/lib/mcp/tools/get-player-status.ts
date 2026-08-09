import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, PLAYER_NOT_FOUND, fail, findPlayerInClub, loadMe, ok, resolveClub } from "../club";

export default defineTool({
  name: "get_player_status",
  title: "Estado de un jugador",
  description:
    "Devuelve el color de estado asignado por los fisios a un jugador del club efectivo. JSON estructurado {ok,count,club_id,data,message}.",
  inputSchema: {
    player_id: z.string().uuid().describe("ID del jugador"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, club_id }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");

    const club = await resolveClub(supabase, me, club_id);
    if (!club.ok) return club.result;

    // Inexistente y "de otro club" devuelven exactamente lo mismo.
    const player = await findPlayerInClub(supabase, player_id, club.club_id);
    if (!player) return PLAYER_NOT_FOUND();

    const { data, error } = await supabase
      .from("player_tags")
      .select("id, player_id, physio_id, color, created_at, updated_at")
      .eq("player_id", player_id)
      .maybeSingle();

    if (error) return fail("query_failed", `Error: ${error.message}`);

    if (!data) {
      return ok({
        count: 0,
        club_id: club.club_id,
        data: [],
        message: "Este jugador no tiene estado de color asignado.",
      });
    }

    const row = {
      ...data,
      club_id: club.club_id,
      created_at: new Date(data.created_at).toISOString(),
      updated_at: new Date(data.updated_at).toISOString(),
    };

    const colorNames: Record<string, string> = {
      green: "Verde",
      yellow: "Amarillo",
      orange: "Naranja",
      red: "Rojo",
    };

    return ok({
      count: 1,
      club_id: club.club_id,
      data: [row],
      message: `Estado del jugador: ${colorNames[data.color] ?? data.color}`,
    });
  },
});
