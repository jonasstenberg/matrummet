export function calculateTotalTime(
  prepTime: number | null,
  cookTime: number | null
): string | null {
  const prep = prepTime ?? 0;
  const cook = cookTime ?? 0;
  const totalMinutes = prep + cook;

  if (totalMinutes === 0) return null;

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (remainingMinutes === 0) return `${hours} tim`;
  return `${hours} tim ${remainingMinutes} min`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
