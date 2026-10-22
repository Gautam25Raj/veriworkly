import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface ReleaseActionLinksProps {
  compareUrl: string | null;
  olderVersion?: string;
  githubUrl: string | null;
}

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
    <div className="border-border mt-6 space-y-3 border-t pt-6">
      {githubUrl && (
        <Link
          target="_blank"
          href={githubUrl}
          rel="noopener noreferrer"
          className="group bg-foreground text-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent/40 flex h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
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
          className="group text-foreground hover:text-accent focus-visible:ring-accent/40 flex h-11 items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
        >
          Code changes since v{olderVersion}
          <Arrow />
        </Link>
      )}
    </div>
  );
};

export default ReleaseActionLinks;
