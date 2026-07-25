import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { fetchServerApiData } from "@/lib/server-api";
import type { AmbassadorStatus } from "@/features/ambassador/types";
import AmbassadorApplyNav from "@/features/ambassador/AmbassadorApplyNav";
import AmbassadorApplyExperience from "@/features/ambassador/AmbassadorApplyExperience";
import {
  AmbassadorAlreadyAcceptedCard,
  AmbassadorPendingCard,
} from "@/features/ambassador/AmbassadorStatusCard";
import "../ambassador.css";

const pageUrl = `${siteConfig.url}/ambassador/apply`;

export const metadata: Metadata = {
  title: "Apply — Campus Ambassador Program | VeriWorkly",
  description:
    "Seven quick, fun questions and you're in the running to become a VeriWorkly Campus Ambassador.",
  alternates: { canonical: pageUrl },
  robots: { index: false, follow: true },
};

export default async function AmbassadorApplyPage() {
  const status = await fetchServerApiData<AmbassadorStatus>("/ambassador/me");

  if (!status) {
    const callbackURL = encodeURIComponent(pageUrl);
    redirect(`${siteConfig.links.app}/login?callbackURL=${callbackURL}`);
  }

  const isAmbassador = status.role === "AMBASSADOR";
  const isPending = status.ambassadorStatus === "PENDING";

  return (
    <div className="ambassador-bg-noise relative min-h-screen pb-24">
      <AmbassadorApplyNav />
      <main className="px-6 pt-16 sm:pt-20">
        {isAmbassador ? (
          <AmbassadorAlreadyAcceptedCard />
        ) : isPending ? (
          <AmbassadorPendingCard />
        ) : (
          <AmbassadorApplyExperience />
        )}
      </main>
    </div>
  );
}
