/**
 * When an upcoming game starts, as people say it: "Today 8:15 PM",
 * "Tomorrow 12:00 PM", "Sat 12:00 PM", "Sep 28 1:00 PM".
 *
 * ONE LABEL, EVERY SURFACE. The home cards said "8:15 PM" with no day, and
 * the Games tab spans today and tomorrow, so "8:15 PM" could be either night.
 * The room header had the day but lost the time off the end of the line. A
 * start time without its day, or a day without its time, is not a start time.
 */
export function kickoffLabel(startTime: string | Date, now: Date = new Date()): string {
  const date = typeof startTime === "string" ? new Date(startTime) : startTime;
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gameDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((gameDay.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  // The weekday inside a week; the date once it is further out.
  const day =
    diffDays > 1 && diffDays < 7
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} ${time}`;
}
