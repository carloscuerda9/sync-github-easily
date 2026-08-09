import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = "carloscuerdarenedo@gmail.com";

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") {
      throw new Error("userId requerido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the caller is a superadmin
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("No autorizado");

    if (data.userId === userId) {
      throw new Error("No puedes eliminar tu propia cuenta");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The owner account can never be deleted by anyone else
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if ((target?.user?.email ?? "").toLowerCase() === OWNER_EMAIL) {
      throw new Error("No autorizado");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { success: true };
  });
