import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "record_injury",
  title: "Registrar lesión",
  description:
    "Registra una lesión de un jugador en el histórico clínico (zona del cuerpo, tipo, gravedad, tratamiento y días de recuperación). Solo fisios y administradores del mismo club.",
  inputSchema: {
    player_id: z.string().uuid().describe("ID del jugador"),
    injury_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha de la lesión (YYYY-MM-DD)"),
    body_part: z.string().min(1).max(120).describe("Zona del cuerpo afectada"),
    injury_type: z.string().min(1).max(120).describe("Tipo de lesión (muscular, ligamentosa, ósea…)"),
    severity: z.enum(["leve", "moderada", "grave"]).optional().describe("Gravedad"),
    treatment: z.string().max(1000).optional().describe("Tratamiento aplicado"),
    recovery_days: z.number().int().min(0).max(730).optional().describe("Días estimados de recuperación"),
    notes: z.string().max(1000).optional().describe("Observaciones"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
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

    if (!me || !["physio", "superadmin"].includes(me.role)) {
      return { content: [{ type: "text", text: "Solo fisios y administradores pueden registrar lesiones" }], isError: true };
    }
    if (!player) {
      return { content: [{ type: "text", text: "Jugador no encontrado" }], isError: true };
    }
    if (!me.club_id || me.club_id !== player.club_id) {
      return { content: [{ type: "text", text: "El jugador no pertenece a tu club" }], isError: true };
    }

    const { data, error } = await supabase
      .from("injuries")
      .insert({
        player_id: input.player_id,
        physio_id: userId,
        injury_date: input.injury_date,
        body_part: input.body_part,
        injury_type: input.injury_type,
        severity: input.severity ?? null,
        treatment: input.treatment ?? null,
        recovery_days: input.recovery_days ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: `Error al registrar la lesión: ${error.message}` }], isError: true };
    }

    return {
      content: [
        {
          type: "text",
          text: `Lesión registrada para ${player.full_name ?? player.email}: ${input.body_part} · ${input.injury_type} (${input.injury_date}).`,
        },
      ],
      structuredContent: { id: data?.id ?? null },
    };
  },
});
