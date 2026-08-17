import { createServerFn } from "@tanstack/react-start";

/**
 * Public club-code lookup used during registration (caller is signed out).
 * Returns only the club name for an exact 6-char code; never lists clubs.
 */
export const lookupClubByCode = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => {
    const code = String(data?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("INVALID_FORMAT");
    return { code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("find_club_by_code", { _code: data.code });
    if (error) throw new Error("LOOKUP_FAILED");
    const club = Array.isArray(rows) ? rows[0] : rows;
    return { name: club ? (club as { name: string }).name : null };
  });
