import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { User, Stethoscope, ArrowLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/registro")({
  component: RegisterPage,
});

type Role = "player" | "physio";

interface Question {
  id: string;
  field_key: string;
  question_text: string;
  field_type: string;
  options: string[];
  required: boolean;
  display_order: number;
}

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  // base fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [profileData, setProfileData] = useState<Record<string, string | string[]>>({});

  // Club fields
  const [clubMode, setClubMode] = useState<"create" | "join">("create");
  const [clubName, setClubName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [createdClubCode, setCreatedClubCode] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    supabase
      .from("registration_questions")
      .select("*")
      .eq("role", role)
      .eq("active", true)
      .order("display_order")
      .then(({ data, error }) => {
        if (error) { toast.error("Error cargando preguntas"); return; }
        setQuestions((data ?? []) as unknown as Question[]);
      });
  }, [role]);

  const handleRoleSelect = (r: Role) => { setRole(r); setStep(2); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!role) return;

    // Validate club fields
    const meta: Record<string, unknown> = {
      role,
      full_name: fullName,
      phone,
      profile_data: profileData,
    };

    if (role === "physio") {
      if (clubMode === "create") {
        if (!clubName.trim()) { toast.error("Introduce el nombre del club"); return; }
        meta.club_name = clubName.trim();
      } else {
        if (!clubCode.trim()) { toast.error("Introduce el código del club"); return; }
        meta.club_code = clubCode.trim().toUpperCase();
      }
    } else {
      if (!clubCode.trim()) { toast.error("Introduce el código del club que te dio tu fisio"); return; }
      meta.club_code = clubCode.trim().toUpperCase();
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: meta,
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message;
      if (msg.includes("already")) toast.error("Este email ya está registrado");
      else if (msg.includes("Código")) toast.error(msg);
      else if (msg.includes("club")) toast.error("Error con el código de club. Comprueba que es correcto.");
      else toast.error(msg);
      return;
    }

    // If physio created a club, attempt to fetch the generated code (best-effort)
    if (role === "physio" && clubMode === "create") {
      try {
        const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
        if (authData?.user) {
          const { data: prof } = await supabase.from("profiles").select("club_id").eq("id", authData.user.id).maybeSingle();
          if (prof?.club_id) {
            const { data: club } = await supabase.from("clubs").select("code").eq("id", prof.club_id).maybeSingle();
            if (club?.code) setCreatedClubCode(club.code);
          }
          await supabase.auth.signOut();
        }
      } catch { /* code will be visible on dashboard once approved */ }
    }

    setStep(3);
  };

  const updateField = (key: string, value: string | string[]) => {
    setProfileData((prev) => ({ ...prev, [key]: value }));
  };

  if (step === 3) {
    const isPhysio = role === "physio";
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold">¡Cuenta creada!</h1>
          {isPhysio ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Tu cuenta de fisioterapeuta está <strong>en revisión</strong>. Te avisaremos cuando
                el equipo de We Fix You apruebe tu acceso.
              </p>
              {createdClubCode && (
                <div className="mt-5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Código de tu club</div>
                  <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-primary">{createdClubCode}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Compártelo con tus jugadores para que se registren en tu club.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Ya puedes empezar a usar We Fix You. Inicia sesión para acceder a tu panel.
            </p>
          )}
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Ir a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          {step === 2 && (
            <Button variant="ghost" size="sm" onClick={() => { setStep(1); setRole(null); }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Cambiar rol
            </Button>
          )}
        </div>

        {step === 1 && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Crear cuenta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Elige cómo quieres usar We Fix You.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleRoleSelect("player")}
                className="group rounded-xl border-2 border-border bg-background p-6 text-left transition-all hover:border-primary hover:shadow-md"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <User className="h-6 w-6" />
                </div>
                <div className="font-semibold">Soy deportista</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reservar citas, ver mi historial y hablar con mi fisio.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect("physio")}
                className="group rounded-xl border-2 border-border bg-background p-6 text-left transition-all hover:border-primary hover:shadow-md"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground group-hover:bg-accent">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div className="font-semibold">Soy fisioterapeuta</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gestionar agenda, jugadores, formularios y facturación.
                </p>
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
            </p>
          </div>
        )}

        {step === 2 && role && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                role === "player" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent-foreground"
              )}>
                {role === "player" ? <User className="h-5 w-5" /> : <Stethoscope className="h-5 w-5" />}
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  Registro {role === "player" ? "deportista" : "fisioterapeuta"}
                </h1>
                <p className="text-sm text-muted-foreground">Rellena tus datos para crear tu cuenta.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fullName">Nombre completo *</Label>
                <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              {questions.map((q) => (
                <div
                  key={q.id}
                  className={cn(
                    "space-y-2",
                    (q.field_type === "textarea" || q.field_type === "multiselect") && "md:col-span-2"
                  )}
                >
                  <Label htmlFor={q.field_key}>
                    {q.question_text} {q.required && "*"}
                  </Label>
                  {q.field_type === "textarea" ? (
                    <Textarea
                      id={q.field_key}
                      required={q.required}
                      value={(profileData[q.field_key] as string) ?? ""}
                      onChange={(e) => updateField(q.field_key, e.target.value)}
                    />
                  ) : q.field_type === "select" ? (
                    <select
                      id={q.field_key}
                      required={q.required}
                      value={(profileData[q.field_key] as string) ?? ""}
                      onChange={(e) => updateField(q.field_key, e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">Selecciona…</option>
                      {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : q.field_type === "multiselect" ? (
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o) => {
                        const arr = (profileData[q.field_key] as string[]) ?? [];
                        const checked = arr.includes(o);
                        return (
                          <label
                            key={o}
                            className={cn(
                              "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:border-primary"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() => {
                                const next = checked ? arr.filter((x) => x !== o) : [...arr, o];
                                updateField(q.field_key, next);
                              }}
                            />
                            {o}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      id={q.field_key}
                      type={q.field_type === "number" ? "number" : q.field_type === "date" ? "date" : "text"}
                      required={q.required}
                      value={(profileData[q.field_key] as string) ?? ""}
                      onChange={(e) => updateField(q.field_key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Club section */}
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-3 text-sm font-semibold">
                {role === "physio" ? "Tu club / equipo" : "Club al que perteneces"}
              </div>

              {role === "physio" ? (
                <>
                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClubMode("create")}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        clubMode === "create" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                      )}
                    >
                      Crear club nuevo
                    </button>
                    <button
                      type="button"
                      onClick={() => setClubMode("join")}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        clubMode === "join" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                      )}
                    >
                      Unirme a uno existente
                    </button>
                  </div>
                  {clubMode === "create" ? (
                    <div className="space-y-2">
                      <Label htmlFor="clubName">Nombre del club *</Label>
                      <Input
                        id="clubName"
                        required
                        placeholder="Ej. Club Deportivo Madrid"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Generaremos un código único para que invites a tus jugadores.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="clubCodeJoin">Código del club *</Label>
                      <Input
                        id="clubCodeJoin"
                        required
                        placeholder="ABC123"
                        maxLength={6}
                        className="font-mono uppercase tracking-widest"
                        value={clubCode}
                        onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="clubCode">Código del club *</Label>
                  <Input
                    id="clubCode"
                    required
                    placeholder="ABC123"
                    maxLength={6}
                    className="font-mono uppercase tracking-widest"
                    value={clubCode}
                    onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pídele a tu fisio el código de invitación de su club.
                  </p>
                </div>
              )}
            </div>

            <Button type="submit" className="mt-6 w-full" disabled={loading}>
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
