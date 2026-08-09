import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, STAFF_ROLES, fail, loadMe, ok, resolveClub } from "../club";

const MATCH_COLUMNS =
  "id, club_id, fecha, rival, competicion, jornada, local_visitante, resultado_favor, resultado_contra, acta_ref, duracion_min, created_by, created_at, updated_at";

export default defineTool({
  name: "upsert_match",
  title: "Crear o recuperar partido",
  description:
    "Crea un partido o recupera el existente si ya hay uno con el mismo acta_ref en el club. Devuelve match_id y si fue creado o recuperado. Idempotente.",
  inputSchema: {
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha del partido (YYYY-MM-DD)"),
    rival: z.string().min(1).max(120).describe("Equipo rival"),
    acta_ref: z.string().max(120).optional().describe("Referencia única del acta oficial. Clave de idempotencia."),
    competicion: z.string().max(120).optional().describe("Competición"),
    jornada: z.string().max(40).optional().describe("Jornada"),
    local_visitante: z.enum(["local", "visitante"]).optional().describe("Condición del equipo"),
    resultado_favor: z.number().int().min(0).optional().describe("Goles a favor"),
    resultado_contra: z.number().int().min(0).optional().describe("Goles en contra"),
    duracion_min: z.number().int().min(1).max(200).optional().describe("Duración del partido en minutos (por defecto 80)"),
    update_if_exists: z
      .boolean()
      .optional()
      .describe("Si ya existe un partido con ese acta_ref, actualizarlo en vez de devolverlo tal cual (por defecto false)"),
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
      return fail("forbidden_role", "No tienes permiso para registrar partidos.");
    }

    const club = await resolveClub(supabase, me, input.club_id);
    if (!club.ok) return club.result;

    const duracion = input.duracion_min ?? 80;
    const updateIfExists = input.update_if_exists ?? false;

    const fields = {
      fecha: input.fecha,
      rival: input.rival,
      competicion: input.competicion ?? null,
      jornada: input.jornada ?? null,
      local_visitante: input.local_visitante ?? null,
      resultado_favor: input.resultado_favor ?? null,
      resultado_contra: input.resultado_contra ?? null,
      duracion_min: duracion,
      ...(input.acta_ref ? { acta_ref: input.acta_ref } : {}),
    };

    if (input.acta_ref) {
      const { data: existing, error: findError } = await supabase
        .from("matches")
        .select(MATCH_COLUMNS)
        .eq("club_id", club.club_id)
        .eq("acta_ref", input.acta_ref)
        .maybeSingle();
      if (findError) return fail("query_failed", `Error al buscar el partido: ${findError.message}`);

      if (existing) {
        if (!updateIfExists) {
          return ok({
            count: 1,
            club_id: club.club_id,
            data: [existing],
            message: `El acta ${input.acta_ref} ya está registrada (${existing.fecha} vs ${existing.rival}).`,
            extra: { action: "existing", match_id: existing.id },
          });
        }

        const { data: updated, error: updateError } = await supabase
          .from("matches")
          .update(fields)
          .eq("id", existing.id)
          .select(MATCH_COLUMNS)
          .maybeSingle();
        if (updateError) return fail("write_failed", `Error al actualizar el partido: ${updateError.message}`);

        return ok({
          count: updated ? 1 : 0,
          club_id: club.club_id,
          data: updated ? [updated] : [],
          message: `Partido actualizado (${input.fecha} vs ${input.rival}).`,
          extra: { action: "updated", match_id: existing.id },
        });
      }
    }

    const { data: created, error: insertError } = await supabase
      .from("matches")
      .insert({ ...fields, club_id: club.club_id, created_by: me.id })
      .select(MATCH_COLUMNS)
      .maybeSingle();
    if (insertError) return fail("write_failed", `Error al crear el partido: ${insertError.message}`);

    return ok({
      count: created ? 1 : 0,
      club_id: club.club_id,
      data: created ? [created] : [],
      message: `Partido creado (${input.fecha} vs ${input.rival}).`,
      extra: { action: "created", match_id: created?.id ?? null },
    });
  },
});
