/** Coerce Supabase/Postgres booleans (incl. string "false") to real boolean. */
export function toBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "t" || s === "1") return true;
    if (s === "false" || s === "f" || s === "0" || s === "") return false;
  }
  return Boolean(value);
}
