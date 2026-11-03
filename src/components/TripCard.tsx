import Link from "next/link";
import { formatDate } from "@/lib/format";
import { Tag, type TagTone } from "@/components/ui";

export function TripCard({
  href,
  title,
  destination,
  startDate,
  endDate,
  status,
}: {
  href: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status?: { label: string; tone: TagTone };
}) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-brand-600"
    >
      <div className="flex h-20 items-center justify-center bg-brand-50 text-2xl" aria-hidden>
        🗺️
      </div>
      <div className="p-3">
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-slate-600">{destination}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatDate(startDate)} → {formatDate(endDate)}
        </p>
        {status && (
          <div className="mt-2">
            <Tag tone={status.tone}>{status.label}</Tag>
          </div>
        )}
      </div>
    </Link>
  );
}
