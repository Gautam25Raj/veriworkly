import type { Metadata } from "next";

/**
 * Internal authoring tool for the static OG cards in `public/og` — not a product surface.
 *
 * The `.dev.tsx` extension is what keeps it out of production; see `pageExtensions` in
 * next.config.ts for why the two earlier attempts (a `.gitignore` entry, then a
 * `notFound()` gate) were both wrong. Outside `next dev` this file is not compiled as a
 * route at all, so there is no runtime check here to drift out of sync.
 *
 * `noindex` still matters for the dev/preview case, where the route does exist.
 */
export const metadata: Metadata = {
  title: "OG Image Generator",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OgGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
