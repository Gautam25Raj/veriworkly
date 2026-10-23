import Link from "next/link";
import Image from "next/image";

interface MarketingNavLogoProps {
  logoSrc: string;
  homeHref: string;
  shortName: string;
}

export const MarketingNavLogo = ({ homeHref, shortName, logoSrc }: MarketingNavLogoProps) => {
  return (
    <Link
      href={homeHref}
      className="group focus-visible:ring-accent focus-visible:ring-offset-background flex items-center gap-3 rounded-xl transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-hidden active:scale-[0.97]"
    >
      <span className="relative size-10 shrink-0">
        <Image
          preload
          width={40}
          height={40}
          src={logoSrc}
          alt=""
          className="size-full object-contain"
        />
      </span>

      <span className="font-mono text-2xl font-semibold tracking-tight">{shortName}</span>
    </Link>
  );
};
