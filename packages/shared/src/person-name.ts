export function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
}

export function getPersonInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [firstName?.trim(), lastName?.trim()]
    .filter((part): part is string => Boolean(part))
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}
