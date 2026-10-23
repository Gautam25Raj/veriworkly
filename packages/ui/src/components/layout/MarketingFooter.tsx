import Link from "next/link";
import Image from "next/image";
import { Heart, Mail, MapPin, ArrowUpRight } from "lucide-react";

import { Container } from "./Container";

interface FooterLink {
  name: string;
  href: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface FooterSocialLink {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MarketingFooterProps {
  homeHref: string;
  logoSrc: string;
  logoAlt?: string;
  shortName: string;
  brandName: string;
  description: string;
  email: string;
  location: string;
  socialLinks: FooterSocialLink[];
  footerColumns: FooterColumn[];
  legalLinks: FooterLink[];
  tagline: string;
  statusText: string;
}

const glow =
  "pointer-events-none absolute size-125 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]";

const focusRing =
  "focus-visible:ring-accent rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden";

export const MarketingFooter = ({
  homeHref,
  logoSrc,
  shortName,
  brandName,
  description,
  email,
  location,
  socialLinks,
  footerColumns,
  legalLinks,
  tagline,
  statusText,
}: MarketingFooterProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border/40 bg-card/50 relative overflow-hidden border-t pt-20 pb-10">
      <div
        aria-hidden="true"
        className={`${glow} -bottom-48 -left-48 [--glow:color-mix(in_srgb,var(--accent)_10%,transparent)]`}
      />
      <div
        aria-hidden="true"
        className={`${glow} -top-48 -right-48 [--glow:color-mix(in_srgb,var(--accent)_5%,transparent)]`}
      />

      <Container className="relative">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-8 lg:col-span-4">
            <div className="space-y-6">
              <Link href={homeHref} className={`group flex w-fit items-center gap-3 ${focusRing}`}>
                <span className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform duration-200 ease-out group-hover:scale-105">
                  <Image fill sizes="40px" alt="" src={logoSrc} className="object-contain" />
                </span>

                <span className="font-mono text-2xl font-semibold tracking-tight">{shortName}</span>
              </Link>

              <p className="text-muted max-w-sm text-base leading-relaxed text-pretty">
                {description}
              </p>
            </div>

            <address className="space-y-4 text-sm not-italic">
              <a
                href={`mailto:${email}`}
                className={`text-muted hover:text-foreground flex w-fit items-center gap-3 transition-colors ${focusRing}`}
              >
                <span className="bg-accent/10 flex size-8 items-center justify-center rounded-lg">
                  <Mail aria-hidden="true" className="text-accent size-4" />
                </span>
                {email}
              </a>

              <p className="text-muted flex items-center gap-3">
                <span className="bg-accent/10 flex size-8 items-center justify-center rounded-lg">
                  <MapPin aria-hidden="true" className="text-accent size-4" />
                </span>
                {location}
              </p>
            </address>

            <ul className="flex gap-3">
              {socialLinks.map((social) => (
                <li key={social.name}>
                  <Link
                    target="_blank"
                    href={social.href}
                    rel="noopener noreferrer"
                    aria-label={`${social.name} (opens in a new tab)`}
                    className="bg-accent/5 hover:bg-accent text-muted hover:text-accent-foreground border-border/40 focus-visible:ring-accent focus-visible:ring-offset-background flex size-11 items-center justify-center rounded-xl border transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.97]"
                  >
                    <social.icon className="size-5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8">
            {footerColumns.map((column) => (
              <section key={column.title} className="space-y-6">
                <h2 className="text-foreground text-xs font-semibold tracking-[0.24em] uppercase">
                  {column.title}
                </h2>

                <ul className="space-y-4">
                  {column.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className={`text-muted hover:text-accent group flex w-fit items-center gap-1.5 text-sm font-medium transition-colors ${focusRing}`}
                      >
                        {link.name}
                        {link.external ? (
                          <>
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-3 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-60"
                            />
                            <span className="sr-only">(opens in a new tab)</span>
                          </>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </div>

        <div className="border-border/40 mt-20 flex flex-col items-center justify-between gap-8 border-t pt-10 lg:flex-row">
          <div className="flex flex-col items-center gap-4 lg:items-start">
            <p className="text-muted text-sm font-medium">
              &copy; {currentYear} {brandName}. {tagline}
            </p>

            <p className="border-border/40 bg-background/50 text-muted flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold">
              <span aria-hidden="true" className="bg-success size-2 rounded-full" />
              {statusText}
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 lg:items-end">
            <p className="text-muted flex items-center gap-1.5 text-xs font-semibold">
              Proudly crafted with
              <Heart aria-hidden="true" className="size-4 fill-red-500 text-red-500" />
              <span className="sr-only">love</span> in Public
            </p>

            <nav aria-label="Legal">
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] font-semibold">
                {legalLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className={`text-muted hover:text-accent transition-colors ${focusRing}`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </Container>
    </footer>
  );
};
