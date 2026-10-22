import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface ReleaseActionLinksProps {
  compareUrl: string | null;
  olderVersion?: string;
  githubUrl: string | null;
}

const base =
  "group focus-visible:ring-accent/40 inline-flex h-11 items-center gap-2 rounded-full px-5 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]";

const Arrow = () => (
  <ArrowUpRight
    aria-hidden="true"
    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
  />
);

export const ReleaseActionLinks = ({
  compareUrl,
  olderVersion,
  githubUrl,
}: ReleaseActionLinksProps) => {
  if (!compareUrl && !githubUrl) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
      {githubUrl && (
        <Link
          target="_blank"
          href={githubUrl}
          rel="noopener noreferrer"
          className={`${base} bg-foreground text-background hover:bg-accent hover:text-accent-foreground`}
        >
          Release on GitHub
          <Arrow />
        </Link>
      )}

      {compareUrl && (
        <Link
          target="_blank"
          href={compareUrl}
          rel="noopener noreferrer"
          className="group text-foreground hover:text-accent focus-visible:ring-accent/40 inline-flex h-11 items-center gap-2 rounded-full text-base font-semibold underline decoration-current/30 underline-offset-4 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
        >
          Changes since v{olderVersion}
          <Arrow />
        </Link>
      )}
    </div>
  );
};

export default ReleaseActionLinks;
