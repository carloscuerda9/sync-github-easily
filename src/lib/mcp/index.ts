import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyAppointments from "./tools/list-my-appointments";
import listClubPlayers from "./tools/list-club-players";
import getPlayerStatus from "./tools/get-player-status";
import sendMessage from "./tools/send-message";
import recordMatchMinutes from "./tools/record-match-minutes";
import listMatchMinutes from "./tools/list-match-minutes";
import recordInjury from "./tools/record-injury";
import listInjuries from "./tools/list-injuries";
import listPlayerTagHistory from "./tools/list-player-tag-history";
import getTagStats from "./tools/get-tag-stats";
import listClubAppointments from "./tools/list-club-appointments";
import getWorkloadMetrics from "./tools/get-workload-metrics";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "we-fix-you",
  title: "WE FIX YOU",
  version: "0.4.0",
  instructions:
    "Servidor MCP para WE FIX YOU. Todas las herramientas devuelven JSON estructurado: éxito {ok:true,count,club_id,data,message} y error {ok:false,error_code,message}. Fechas en ISO-8601 (YYYY-MM-DD para fechas, UTC para timestamps). El club se resuelve por sesión; owner/superadmin sin club propio puede indicar club_id opcional (para el resto de roles se ignora). El usuario debe estar autenticado con OAuth.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listMyAppointments,
    listClubPlayers,
    getPlayerStatus,
    sendMessage,
    recordMatchMinutes,
    listMatchMinutes,
    recordInjury,
    listInjuries,
    listPlayerTagHistory,
    getTagStats,
    listClubAppointments,
    getWorkloadMetrics,
  ],
});
