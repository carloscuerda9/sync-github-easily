import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "send_message",
  title: "Enviar mensaje",
  description: "Envía un mensaje a otro usuario del mismo club. Solo permite mensajes entre usuarios del mismo club.",
  inputSchema: {
    receiver_id: z.string().uuid().describe("ID del destinatario"),
    content: z.string().min(1).max(1000).describe("Contenido del mensaje"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ receiver_id, content }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const senderId = ctx.getUserId();

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, club_id")
      .in("id", [senderId, receiver_id]);

    if (profileError || !profiles || profiles.length < 2) {
      return { content: [{ type: "text", text: "Destinatario no encontrado" }], isError: true };
    }

    const sender = profiles.find((p) => p.id === senderId);
    const receiver = profiles.find((p) => p.id === receiver_id);

    if (!sender?.club_id || sender.club_id !== receiver?.club_id) {
      return { content: [{ type: "text", text: "No puedes enviar mensajes a usuarios de otro club" }], isError: true };
    }

    const { error } = await supabase.from("messages").insert({
      sender_id: senderId,
      receiver_id: receiver_id,
      content,
      read: false,
      attachments: [],
    });

    if (error) {
      return { content: [{ type: "text", text: `Error al enviar: ${error.message}` }], isError: true };
    }
    return { content: [{ type: "text", text: "Mensaje enviado correctamente." }] };
  },
});
