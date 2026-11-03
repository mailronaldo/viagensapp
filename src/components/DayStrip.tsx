import Link from "next/link";
import { eachDay, formatDate } from "@/lib/format";

const VISIBLE_DAYS = 7;

/** Tira com até 7 dias ao redor do dia aberto, que fica em destaque. */
export function DayStrip({
  basePath,
  startDate,
  endDate,
  current,
}: {
  basePath: string;
  startDate: string;
  endDate: string;
  current: string;
}) {
  const days = eachDay(startDate, endDate);
  const first = Math.max(0, Math.min(days.indexOf(current) - 3, days.length - VISIBLE_DAYS));

  return (
    <nav aria-label="Dias da viagem" className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
      {days.slice(first, first + VISIBLE_DAYS).map((day) => (
        <Link
          key={day}
          href={`${basePath}/${day}`}
          aria-current={day === current ? "date" : undefined}
          className={`shrink-0 rounded-lg border px-3 py-1 text-center text-xs ${
            day === current
              ? "border-brand-700 bg-brand-700 font-medium text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-brand-600"
          }`}
        >
          <span className="block">{formatDate(day, { weekday: "short" }).replace(".", "")}</span>
          <span className="block text-sm">{formatDate(day, { day: "2-digit" })}</span>
        </Link>
      ))}
    </nav>
  );
}
