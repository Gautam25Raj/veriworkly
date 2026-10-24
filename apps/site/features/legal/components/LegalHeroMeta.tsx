import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface LegalHeroMetaProps {
  effectiveDate: string;
  links: { label: string; href: string }[];
}

export function LegalHeroMeta({ effectiveDate, links }: LegalHeroMetaProps) {
  return (
    <div className="space-y-6">
      <p className="text-base">
        <span className="text-muted">Effective</span>{" "}
        <span className="font-semibold">{effectiveDate}</span>
      </p>

      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group text-accent focus-visible:ring-accent/40 inline-flex items-center gap-2 rounded-full text-base font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {link.label}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
