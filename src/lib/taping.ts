export const TAPING_ZONES = [
  { value: "tobillo_izq", label: "Tobillo izquierdo" },
  { value: "tobillo_dcho", label: "Tobillo derecho" },
  { value: "rodilla_izq", label: "Rodilla izquierda" },
  { value: "rodilla_dcha", label: "Rodilla derecha" },
  { value: "muslo", label: "Muslo" },
  { value: "gemelo", label: "Gemelo" },
  { value: "hombro", label: "Hombro" },
  { value: "codo", label: "Codo" },
  { value: "muneca", label: "Muñeca" },
  { value: "mano_dedos", label: "Mano / dedos" },
  { value: "otro", label: "Otro" },
] as const;

export const ZONE_LABEL: Record<string, string> = Object.fromEntries(
  TAPING_ZONES.map((z) => [z.value, z.label]),
);

export interface TapingRequest {
  id: string;
  player_id: string;
  club_id: string | null;
  week_start: string;
  zones: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Lunes (00:00 local) de la semana a la que pertenece la fecha dada. */
export function weekStart(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  return d;
}

export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function currentWeekStart(): string {
  return toISODate(weekStart());
}

export function formatWeekRange(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const start = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}
