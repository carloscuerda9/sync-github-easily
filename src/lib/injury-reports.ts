export const CONTEXT_OPTIONS = [
  { value: "partido", label: "Partido" },
  { value: "entrenamiento", label: "Entrenamiento" },
] as const;

export const LOCATION_OPTIONS = [
  { value: "casa", label: "En casa" },
  { value: "fuera", label: "Fuera" },
] as const;

export const MOMENT_OPTIONS = [
  { value: "calentamiento", label: "Calentamiento" },
  { value: "primera_parte", label: "Primera parte" },
  { value: "segunda_parte", label: "Segunda parte" },
  { value: "entrenamiento", label: "Entrenamiento" },
  { value: "gimnasio", label: "Gimnasio" },
] as const;

export const ACTION_OPTIONS = [
  { value: "sprint", label: "Sprint / carrera" },
  { value: "cambio_direccion", label: "Cambio de dirección" },
  { value: "salto_caida", label: "Salto o caída" },
  { value: "golpeo", label: "Golpeo de balón" },
  { value: "contacto", label: "Contacto / choque" },
  { value: "sin_contacto", label: "Sin contacto" },
  { value: "otro", label: "Otro" },
] as const;

export const BODY_PART_OPTIONS = [
  "Cabeza / cara", "Cuello", "Hombro", "Brazo / codo", "Muñeca / mano",
  "Pecho", "Espalda", "Abdomen", "Cadera / ingle", "Isquiotibiales",
  "Cuádriceps", "Aductores", "Rodilla", "Gemelo / sóleo", "Tobillo", "Pie",
] as const;

const map = (opts: readonly { value: string; label: string }[]) =>
  Object.fromEntries(opts.map((o) => [o.value, o.label])) as Record<string, string>;

export const CONTEXT_LABEL = map(CONTEXT_OPTIONS);
export const LOCATION_LABEL = map(LOCATION_OPTIONS);
export const MOMENT_LABEL = map(MOMENT_OPTIONS);
export const ACTION_LABEL = map(ACTION_OPTIONS);

export interface InjuryReport {
  id: string;
  player_id: string;
  context: string;
  match_location: string | null;
  moment: string;
  action_type: string;
  body_part: string;
  previous_same_injury: boolean;
  can_continue: boolean;
  was_attended: boolean;
  attended_by: string | null;
  observations: string | null;
  file_url: string | null;
  file_type: string | null;
  reviewed: boolean;
  created_at: string;
}

export function formatReportDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
