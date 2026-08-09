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
  resolveClub,
} from "../club";

const ALLOWED = ["physio", "superadmin"];

export default defineTool({
  name: "record_injury",
  title: "Registrar lesión",
  description:
    "Registra una lesión de un jugador en el histórico clínico (zona del cuerpo, tipo, gravedad, tratamiento y días de recuperación). Solo fisios y owner/superadmin del mismo club. JSON estructurado.",
  inputSchema: {
    player_id: z.string().uuid().describe("ID del jugador"),
    injury_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha de la lesión (YYYY-MM-DD)"),
    body_part: z.string().min(1).max(120).describe("Zona del cuerpo afectada"),
    injury_type: z.string().min(1).max(120).describe("Tipo de lesión (muscular, ligamentosa, ósea…)"),
    severity: z.enum(["leve", "moderada", "grave"]).optional().describe("Gravedad"),
    treatment: z.string().max(1000).optional().describe("Tratamiento aplicado"),
    recovery_days: z.number().int().min(0).max(730).optional().describe("Días estimados de recuperación"),
    notes: z.string().max(1000).optional().describe("Observaciones"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club de contexto. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");
    if (!ALLOWED.includes(me.role)) {
      return fail("forbidden_role", "Solo fisios y administradores pueden registrar lesiones.");
    }

    const club = await resolveClub(supabase, me, input.club_id);
    if (!club.ok) return club.result;

    const player = await findPlayerInClub(supabase, input.player_id, club.club_id);
    if (!player) return PLAYER_NOT_FOUND();

    const { data, error } = await supabase
      .from("injuries")
      .insert({
        player_id: input.player_id,
        physio_id: me.id,
        injury_date: input.injury_date,
        body_part: input.body_part,
        injury_type: input.injury_type,
        severity: input.severity ?? null,
        treatment: input.treatment ?? null,
        recovery_days: input.recovery_days ?? null,
        notes: input.notes ?? null,
      })
      .select(
        "id, player_id, physio_id, injury_date, body_part, injury_type, severity, treatment, recovery_days, notes, created_at",
      )
      .maybeSingle();

    if (error) return fail("write_failed", `Error al registrar la lesión: ${error.message}`);

    const row = data
      ? {
          ...data,
          club_id: club.club_id,
          player_name: player.full_name ?? player.email,
          created_at: new Date(data.created_at).toISOString(),
        }
      : null;

    return ok({
      count: row ? 1 : 0,
      club_id: club.club_id,
      data: row ? [row] : [],
      message: `Lesión registrada para ${player.full_name ?? player.email}: ${input.body_part} · ${input.injury_type} (${input.injury_date}).`,
      extra: { action: "created" },
    });
  },
});
