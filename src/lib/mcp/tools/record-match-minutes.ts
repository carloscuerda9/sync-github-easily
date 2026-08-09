import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "record_match_minutes",
  title: "Registrar minutos jugados",
  description:
    "Registra (o actualiza) los minutos jugados por un jugador en un partido. Solo fisios, entrenadores y administradores del mismo club.",
  inputSchema: {
    player_id: z.string().uuid().describe("ID del jugador"),
    match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha del partido (YYYY-MM-DD)"),
    minutes_played: z.number().int().min(0).max(200).describe("Minutos jugados"),
    opponent: z.string().max(120).optional().describe("Rival"),
    competition: z.string().max(120).optional().describe("Competición (liga, copa, amistoso…)"),
    started: z.boolean().optional().describe("¿Fue titular?"),
    notes: z.string().max(1000).optional().describe("Notas u observaciones"),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, club_id, full_name, email")
      .in("id", [userId, input.player_id]);

    if (profileError || !profiles) {
      return { content: [{ type: "text", text: "No se pudieron cargar los perfiles" }], isError: true };
    }
    const me = profiles.find((p) => p.id === userId);
    const player = profiles.find((p) => p.id === input.player_id);

    if (!me || !["physio", "coach", "superadmin"].includes(me.role)) {
      return { content: [{ type: "text", text: "No tienes permiso para registrar minutos" }], isError: true };
    }
    if (!player) {
      return { content: [{ type: "text", text: "Jugador no encontrado" }], isError: true };
    }
    if (!me.club_id || me.club_id !== player.club_id) {
      return { content: [{ type: "text", text: "El jugador no pertenece a tu club" }], isError: true };
    }

    const { data, error } = await supabase
      .from("match_minutes")
      .upsert(
        {
          player_id: input.player_id,
          club_id: player.club_id,
          recorded_by: userId,
          match_date: input.match_date,
          minutes_played: input.minutes_played,
          opponent: input.opponent ?? "",
          competition: input.competition ?? null,
          started: input.started ?? false,
          notes: input.notes ?? null,
        },
        { onConflict: "player_id,match_date,opponent" },
      )
      .select("id")
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: `Error al registrar: ${error.message}` }], isError: true };
    }

    const name = player.full_name ?? player.email;
    return {
      content: [
        {
          type: "text",
          text: `Registrado: ${name} jugó ${input.minutes_played} min el ${input.match_date}${input.opponent ? ` vs ${input.opponent}` : ""}.`,
        },
      ],
      structuredContent: { id: data?.id ?? null },
    };
  },
});
