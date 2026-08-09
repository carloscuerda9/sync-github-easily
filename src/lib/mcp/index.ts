import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyAppointments from "./tools/list-my-appointments";
import listClubPlayers from "./tools/list-club-players";
import getPlayerStatus from "./tools/get-player-status";
import sendMessage from "./tools/send-message";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "we-fix-you",
  title: "WE FIX YOU",
  version: "0.1.0",
  instructions:
    "Servidor MCP para WE FIX YOU. Herramientas para consultar citas, listar jugadores de un club, consultar el estado/color de un jugador y enviar mensajes dentro del mismo club. El usuario debe estar autenticado con OAuth.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyAppointments, listClubPlayers, getPlayerStatus, sendMessage],
});
