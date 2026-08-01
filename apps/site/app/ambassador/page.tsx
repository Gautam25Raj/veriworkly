import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { siteConfig } from "@/config/site";
import { jsonLdScriptProps } from "@/utils/json-ld";
import AmbassadorNav from "@/features/ambassador/AmbassadorNav";
import AmbassadorHero from "@/features/ambassador/AmbassadorHero";
import AmbassadorPerks from "@/features/ambassador/AmbassadorPerks";
import AmbassadorLeaderboard from "@/features/ambassador/AmbassadorLeaderboard";
import AmbassadorFAQ from "@/features/ambassador/AmbassadorFAQ";
import AmbassadorFooter from "@/features/ambassador/AmbassadorFooter";
import "./ambassador.css";

const AmbassadorPlaybook = dynamic(() => import("@/features/ambassador/AmbassadorPlaybook"));
const AmbassadorCalculator = dynamic(() => import("@/features/ambassador/AmbassadorCalculator"));

const pageUrl = `${siteConfig.url}/ambassador`;
const pageOgImage = `${siteConfig.url}/api/og?title=${encodeURIComponent(
  "Student Ambassador Program",
)}&description=${encodeURIComponent(
  "Represent VeriWorkly on campus and unlock free Creator Pro access.",
)}`;

export const metadata: Metadata = {
  title: "Student Ambassador Program | VeriWorkly",
  description:
    "Gated campus program for college students. Share local-first career editors, earn points for social shares or peer referrals, and unlock free Creator Pro access.",
  alternates: {
    canonical: pageUrl,
    languages: {
      "en-US": pageUrl,
    },
  },
  openGraph: {
    title: "Student Ambassador Program | VeriWorkly",
    description:
      "Help your peers build professional resumes and portfolios. Earn point multipliers and redeem them for free Creator Pro upgrades.",
    url: pageUrl,
    siteName: siteConfig.shortName,
    type: "website",
    images: [
      {
        url: pageOgImage,
        width: 1200,
        height: 630,
        alt: "VeriWorkly Student Ambassador Program",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Student Ambassador Program | VeriWorkly",
    description:
      "Earn campus points and redeem them for free Creator Pro access as a student ambassador.",
    images: [pageOgImage],
  },
};

const AmbassadorPage = () => {
  const ambassadorSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "VeriWorkly Student Ambassador Program",
    url: pageUrl,
    description:
      "Represent VeriWorkly on campus, earn points by sharing with peers, and get free Pro access.",
  };

  return (
    <>
      {/* Uses the shared helper rather than a hand-rolled copy of the same escaping. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(ambassadorSchema)}
      />

      <div className="bg-background relative min-h-screen">
        <AmbassadorNav />

        <main>
          <AmbassadorHero />
          <AmbassadorPerks />
          <AmbassadorPlaybook />
          <AmbassadorCalculator />
          <AmbassadorLeaderboard />
          <AmbassadorFAQ />
        </main>

        <AmbassadorFooter />
      </div>
    </>
  );
};

export default AmbassadorPage;
