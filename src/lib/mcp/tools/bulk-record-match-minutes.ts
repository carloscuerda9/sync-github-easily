import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, STAFF_ROLES, fail, loadMe, ok, playerNames, resolveClub } from "../club";

const playerEntry = z.object({
  player_id: z.string().uuid().describe("ID del jugador"),
  minutes_played: z.number().int().min(0).max(200).describe("Minutos jugados"),
  started: z.boolean().optional().describe("¿Fue titular? (por defecto false)"),
  dorsal: z.number().int().min(1).max(99).optional().describe("Dorsal"),
  entro_min: z.number().int().min(0).max(200).optional().describe("Minuto de entrada"),
  salio_min: z.number().int().min(0).max(200).optional().describe("Minuto de salida"),
  minutos_amarilla: z.number().int().min(0).max(200).optional().describe("Minuto de la tarjeta amarilla (por defecto 0)"),
  motivo_salida: z
    .enum(["tactico", "lesion", "conmocion_hia", "tarjeta_roja", "tarjeta_amarilla", "fin_partido", "otro"])
    .optional()
    .describe("Motivo de la salida del campo"),
  tramos: z
    .array(z.object({ in: z.number().int(), out: z.number().int() }))
    .optional()
    .describe("Tramos jugados [{in,out}]"),
  notes: z.string().max(1000).optional().describe("Notas u observaciones"),
});

export default defineTool({
  name: "bulk_record_match_minutes",
  title: "Registrar minutos en bloque",
  description:
    "Registra los minutos de varios jugadores de un partido en una sola llamada. Idempotente por (match_id, player_id).",
  inputSchema: {
    match_id: z.string().uuid().describe("ID del partido"),
    players: z.array(playerEntry).min(1).max(40).describe("Jugadores y sus minutos"),
    dry_run: z.boolean().optional().describe("Valida sin escribir. Devuelve lo que haría."),
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

    // 2. Partido
    const { data: match } = await supabase
      .from("matches")
      .select("id, club_id, fecha, rival, competicion, duracion_min")
      .eq("id", input.match_id)
      .maybeSingle();
    if (!match || match.club_id !== club.club_id) {
      return fail("match_not_found", "No se ha encontrado ningún partido con ese identificador en tu club.");
    }

    // 3. Duplicados
    const ids = input.players.map((p) => p.player_id);
    const duplicated = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (duplicated.length > 0) {
      return fail("duplicate_players", "Hay jugadores repetidos en la lista.", { players: duplicated });
    }

    // 4. Validación de pertenencia al club (una sola consulta)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", ids)
      .eq("club_id", club.club_id)
      .eq("role", "player");
    if (profilesError) return fail("query_failed", `Error al validar jugadores: ${profilesError.message}`);
    const found = new Set((profiles ?? []).map((p) => p.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      return fail("players_not_in_club", "Algunos jugadores no existen o no pertenecen a tu club.", {
        players: missing,
      });
    }

    // 5. Avisos no bloqueantes
    const warnings: { player_id: string; code: string; message: string }[] = [];
    for (const p of input.players) {
      if (p.minutes_played > match.duracion_min) {
        warnings.push({
          player_id: p.player_id,
          code: "minutes_over_duration",
          message: `minutes_played (${p.minutes_played}) supera la duración del partido (${match.duracion_min}).`,
        });
      }
      if (p.tramos && p.tramos.length > 0) {
        const suma = p.tramos.reduce((acc, t) => acc + (t.out - t.in), 0);
        if (suma !== p.minutes_played) {
          warnings.push({
            player_id: p.player_id,
            code: "tramos_mismatch",
            message: `La suma de tramos (${suma}) no coincide con minutes_played (${p.minutes_played}).`,
          });
        }
      }
    }

    // 6. Filas
    const rows = input.players.map((p) => ({
      match_id: match.id,
      player_id: p.player_id,
      club_id: club.club_id,
      recorded_by: me.id,
      match_date: match.fecha,
      opponent: match.rival,
      competition: match.competicion ?? null,
      minutes_played: p.minutes_played,
      started: p.started ?? false,
      dorsal: p.dorsal ?? null,
      entro_min: p.entro_min ?? null,
      salio_min: p.salio_min ?? null,
      minutos_amarilla: p.minutos_amarilla ?? 0,
      motivo_salida: p.motivo_salida ?? null,
      tramos: p.tramos ?? null,
      notes: p.notes ?? null,
    }));

    const totalMinutos = rows.reduce((acc, r) => acc + r.minutes_played, 0);
    const names = await playerNames(supabase, ids);

    // 7. dry_run
    if (input.dry_run === true) {
      return ok({
        count: rows.length,
        club_id: club.club_id,
        data: rows.map((r) => ({ ...r, player_name: names.get(r.player_id) ?? null })),
        message: `Simulación: se registrarían ${rows.length} jugadores (${totalMinutos} min) en ${match.fecha} vs ${match.rival}. No se ha escrito nada.`,
        extra: { dry_run: true, warnings, total_minutos: totalMinutos, match_id: match.id },
      });
    }

    // 8. Upsert único
    const { data, error } = await supabase
      .from("match_minutes")
      .upsert(rows, { onConflict: "match_id,player_id" })
      .select(
        "id, match_id, player_id, club_id, recorded_by, match_date, opponent, competition, minutes_played, started, dorsal, entro_min, salio_min, minutos_amarilla, motivo_salida, tramos, notes, created_at, updated_at",
      );

    if (error) return fail("write_failed", `Error al registrar los minutos: ${error.message}`);

    const written = (data ?? []).map((r) => ({
      ...r,
      player_name: names.get(r.player_id) ?? null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));

    return ok({
      count: written.length,
      club_id: club.club_id,
      data: written,
      message: `Registrados ${written.length} jugadores (${totalMinutos} min) en ${match.fecha} vs ${match.rival}.`,
      extra: {
        dry_run: false,
        warnings,
        total_minutos: totalMinutos,
        match_id: match.id,
        conflict_key: ["match_id", "player_id"],
      },
    });
  },
});
