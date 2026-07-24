import type { Metadata, Viewport } from "next";

import "./globals.css";

import { siteConfig } from "@/config/site";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { globalFontVariables } from "@veriworkly/ui";

import { ThemeProvider } from "@/providers/theme-provider";
import { MotionProvider } from "@/providers/motion-provider";

export const viewport: Viewport = {
  // Must match `--background` in @veriworkly/ui/styles/themes.css and the manifest's
  // theme_color, otherwise the browser chrome / PWA status bar renders a colour the app
  // never actually paints.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  colorScheme: "light dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),

  title: "VeriWorkly | Privacy-First AI Resume Builder & Portfolio Platform",
  description: siteConfig.description,

  keywords: [...siteConfig.keywords],

  authors: [{ name: "VeriWorkly Team" }],
  creator: "Gautam Raj",
  publisher: "Gautam Raj",

  category: "technology",

  openGraph: {
    type: "website",
    url: siteConfig.url,
    title: "Free AI Resumes, Cover Letters & Web Portfolios | VeriWorkly",
    description:
      "Build and tailor professional resumes, cover letters, and web portfolios instantly using privacy-first AI tools (Claude & GPT-4o). Free, open-core, and no signup required.",
    siteName: "VeriWorkly",
    images: [
      {
        url: "/og/landing-page-og.png",
        width: 1200,
        height: 630,
        alt: "VeriWorkly Platform Preview",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Free AI Resumes, Cover Letters & Web Portfolios | VeriWorkly",
    description:
      "Build career documents and portfolios instantly with private AI assistance. Free, open-core, and privacy-first.",
    images: ["/og/landing-page-og.png"],
    creator: siteConfig.twitter.handle,
    site: siteConfig.twitter.site,
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },

  appleWebApp: {
    title: "VeriWorkly",
    statusBarStyle: "default",
    capable: true,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
    },
  },
};

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": ["WebApplication", "SoftwareApplication"],

  name: "VeriWorkly",
  url: siteConfig.url,
  description:
    "Free privacy-first career workspace with AI resume builder, cover letter writer, and portfolio builder. No signup required. Create, tailor, and export professional resumes, cover letters, and web portfolios privately.",

  applicationCategory: "BusinessApplication",
  operatingSystem: "All",
  browserRequirements: "Requires JavaScript",

  creator: {
    "@type": "Person",
    name: "Gautam Raj",
  },

  publisher: {
    "@type": "Organization",
    name: "VeriWorkly",
  },

  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },

  featureList: [
    "No login required & local-first",
    "Privacy-first AI resume builder & tailoring",
    "AI cover letter generator",
    "AI portfolio publishing with subdomain hosting",
    "GitHub & LinkedIn profile imports",
    "Master Profile dynamic data sync",
    "ATS-friendly visual customizers",
  ],
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "VeriWorkly",
  url: siteConfig.url,
  logo: `${siteConfig.url}/veriworkly-logo.png`,
  founder: {
    "@type": "Person",
    name: siteConfig.creator,
  },
  sameAs: [siteConfig.links.github, siteConfig.links.twitter, siteConfig.links.linkedin],
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps(webApplicationSchema)}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps(organizationSchema)}
        />
      </head>

      <body
        className={`${globalFontVariables} bg-background text-foreground font-sans antialiased`}
      >
        <ThemeProvider
          enableSystem
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          storageKey="veriworkly-theme"
        >
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
