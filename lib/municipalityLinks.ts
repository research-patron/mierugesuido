export function municipalityDetailHref(
  municipalityCode: string | null | undefined,
  businessKey?: string | null,
  view: "fees" | "finance" | "prefecture" = "fees"
) {
  if (!municipalityCode) return "/municipalities";
  const query = new URLSearchParams({ view });
  if (businessKey) query.set("business", businessKey);
  return `/municipalities/${municipalityCode}?${query.toString()}`;
}
