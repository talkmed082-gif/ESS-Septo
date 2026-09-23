export function isEmailAllowed(email: string, allowed: string | undefined): boolean {
  const list = (allowed ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
