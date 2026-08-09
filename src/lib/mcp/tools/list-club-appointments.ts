import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, fail, loadMe, ok, playerNames, resolveClub } from "../club";

export default defineTool({
  name: "list_club_appointments",
  title: "Agenda del club",
  description:
    "Agenda de fisioterapia de todo el club, no solo la del usuario. Permite ver asistencia y adherencia al tratamiento.",
  inputSchema: {
    player_id: z.string().uuid().optional().describe("Filtrar por jugador"),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Desde (YYYY-MM-DD)"),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hasta (YYYY-MM-DD)"),
    status: z
      .enum(["requested", "confirmed", "cancelled", "completed", "rejected"])
      .optional()
      .describe("Filtrar por estado de la cita"),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (por defecto 50)"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club a consultar. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ player_id, from_date, to_date, status, limit = 50, club_id }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");

    const club = await resolveClub(supabase, me, club_id);
    if (!club.ok) return club.result;

    // Sin filtro por rol: las políticas RLS ya acotan lo que cada usuario puede ver.
    let query = supabase
      .from("appointments")
      .select("id, player_id, physio_id, scheduled_at, duration_minutes, type, status, notes")
      .order("scheduled_at", { ascending: false })
      .limit(limit);

    if (player_id) query = query.eq("player_id", player_id);
    if (status) query = query.eq("status", status);
    if (from_date) query = query.gte("scheduled_at", `${from_date}T00:00:00Z`);
    if (to_date) query = query.lte("scheduled_at", `${to_date}T23:59:59Z`);

    const { data, error } = await query;
    if (error) return fail("query_failed", `Error: ${error.message}`);

    const raw = data ?? [];
    const names = await playerNames(supabase, [
      ...new Set([...raw.map((r) => r.player_id), ...raw.map((r) => r.physio_id)]),
    ]);

    const rows = raw.map((r) => ({
      ...r,
      player_name: names.get(r.player_id) ?? null,
      physio_name: names.get(r.physio_id) ?? null,
      scheduled_at: new Date(r.scheduled_at).toISOString(),
    }));

    const por_estado: Record<string, number> = {};
    for (const r of rows) por_estado[r.status] = (por_estado[r.status] ?? 0) + 1;

    return ok({
      count: rows.length,
      club_id: club.club_id,
      data: rows,
      message: `Citas del club: ${rows.length}.`,
      extra: { por_estado },
    });
  },
});
