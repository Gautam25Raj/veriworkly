import { PageSection } from "@/components/marketing/PageLayout";
import { LandingButton } from "@/components/marketing/LandingButton";

import type { LegalContactBannerProps } from "../types";

export function LegalContactBanner({
  title,
  description,
  primaryActionText,
  primaryActionEmail,
  secondaryActionText,
  secondaryActionHref,
}: LegalContactBannerProps) {
  return (
    <PageSection tone="card" className="border-t" title={title} lede={description}>
      <div className="flex flex-wrap gap-3">
        <LandingButton size="lg" variant="solid" href={`mailto:${primaryActionEmail}`}>
          {primaryActionText}
        </LandingButton>
        <LandingButton showArrow size="lg" variant="outline" href={secondaryActionHref}>
          {secondaryActionText}
        </LandingButton>
      </div>
    </PageSection>
  );
}
