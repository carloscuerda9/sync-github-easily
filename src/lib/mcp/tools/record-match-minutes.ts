import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import {
  NOT_AUTHENTICATED,
  PLAYER_NOT_FOUND,
  STAFF_ROLES,
  fail,
  findPlayerInClub,
  loadMe,
  ok,
  resolveClub,
} from "../club";

export default defineTool({
  name: "record_match_minutes",
  title: "Registrar minutos jugados",
  description:
    "Registra o actualiza los minutos jugados por un jugador en un partido. Clave de idempotencia: (player_id, match_date, opponent), respaldada por el índice UNIQUE match_minutes_unique_entry. Devuelve action='created'|'updated'. Solo fisios, entrenadores y owner/superadmin del mismo club.",
  inputSchema: {
    player_id: z.string().uuid().describe("ID del jugador"),
    match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha del partido (YYYY-MM-DD)"),
    minutes_played: z.number().int().min(0).max(200).describe("Minutos jugados"),
    opponent: z.string().max(120).optional().describe("Rival (forma parte de la clave de idempotencia)"),
    competition: z.string().max(120).optional().describe("Competición (liga, copa, amistoso…)"),
    started: z.boolean().optional().describe("¿Fue titular?"),
    notes: z.string().max(1000).optional().describe("Notas u observaciones"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club de contexto. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");
    if (!STAFF_ROLES.includes(me.role as (typeof STAFF_ROLES)[number])) {
      return fail("forbidden_role", "No tienes permiso para registrar minutos.");
    }

    const club = await resolveClub(supabase, me, input.club_id);
    if (!club.ok) return club.result;

    const player = await findPlayerInClub(supabase, input.player_id, club.club_id);
    if (!player) return PLAYER_NOT_FOUND();

    const opponent = input.opponent ?? "";

    const { data: existing } = await supabase
      .from("match_minutes")
      .select("id")
      .eq("player_id", input.player_id)
      .eq("match_date", input.match_date)
      .eq("opponent", opponent)
      .maybeSingle();

    const { data, error } = await supabase
      .from("match_minutes")
      .upsert(
        {
          player_id: input.player_id,
          club_id: club.club_id,
          recorded_by: me.id,
          match_date: input.match_date,
          minutes_played: input.minutes_played,
          opponent,
          competition: input.competition ?? null,
          started: input.started ?? false,
          notes: input.notes ?? null,
        },
        { onConflict: "player_id,match_date,opponent" },
      )
      .select(
        "id, player_id, club_id, recorded_by, match_date, opponent, competition, minutes_played, started, notes, created_at, updated_at",
      )
      .maybeSingle();

    if (error) return fail("write_failed", `Error al registrar: ${error.message}`);

    const row = data
      ? {
          ...data,
          player_name: player.full_name ?? player.email,
          created_at: new Date(data.created_at).toISOString(),
          updated_at: new Date(data.updated_at).toISOString(),
        }
      : null;

    return ok({
      count: row ? 1 : 0,
      club_id: club.club_id,
      data: row ? [row] : [],
      message: `Registrado: ${player.full_name ?? player.email} jugó ${input.minutes_played} min el ${input.match_date}${opponent ? ` vs ${opponent}` : ""}.`,
      extra: {
        action: existing ? "updated" : "created",
        conflict_key: ["player_id", "match_date", "opponent"],
      },
    });
  },
});
