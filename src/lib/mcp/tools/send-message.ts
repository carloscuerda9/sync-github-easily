import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, PLAYER_NOT_FOUND, fail, loadMe, ok, resolveClub } from "../club";

export default defineTool({
  name: "send_message",
  title: "Enviar mensaje",
  description:
    "Envía un mensaje a otro usuario del mismo club efectivo. JSON estructurado {ok,count,club_id,data,message}.",
  inputSchema: {
    receiver_id: z.string().uuid().describe("ID del destinatario"),
    content: z.string().min(1).max(1000).describe("Contenido del mensaje"),
    club_id: z
      .string()
      .uuid()
      .optional()
      .describe("Solo para owner/superadmin sin club propio: club de contexto. Se ignora para el resto de roles."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ receiver_id, content, club_id }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED();
    const supabase = supabaseForUser(ctx);
    const me = await loadMe(supabase, ctx);
    if (!me) return fail("profile_unavailable", "No se pudo cargar tu perfil.");

    const club = await resolveClub(supabase, me, club_id);
    if (!club.ok) return club.result;

    const { data: receiver } = await supabase
      .from("profiles")
      .select("id, club_id")
      .eq("id", receiver_id)
      .eq("club_id", club.club_id)
      .maybeSingle();

    // Inexistente y "de otro club" comparten respuesta.
    if (!receiver) return PLAYER_NOT_FOUND();

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: me.id,
        receiver_id,
        content,
        read: false,
        attachments: [],
      })
      .select("id, sender_id, receiver_id, content, attachments, read, created_at")
      .maybeSingle();

    if (error) return fail("write_failed", `Error al enviar: ${error.message}`);

    const row = data
      ? { ...data, club_id: club.club_id, created_at: new Date(data.created_at).toISOString() }
      : null;

    return ok({
      count: row ? 1 : 0,
      club_id: club.club_id,
      data: row ? [row] : [],
      message: "Mensaje enviado correctamente.",
      extra: { action: "created" },
    });
  },
});
