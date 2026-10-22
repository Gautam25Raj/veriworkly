import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { OAUTH_SCOPES } from "../../data";

export const OAuthSecuritySection = () => (
  <PageSection
    id="permissions"
    title="What we ask for when you connect."
    lede="Least privilege, stated plainly. No write access to your repositories, no organisation admin, and no LinkedIn password, ever."
  >
    <ul className="grid gap-6 lg:grid-cols-3">
      {OAUTH_SCOPES.map((item) => (
        <li key={item.provider} className="reveal bg-card flex flex-col rounded-3xl p-6 sm:p-8">
          <h3 className={TYPE.title}>{item.provider}</h3>
          <p className="text-muted mt-1 text-base">{item.accessType}</p>

          <dl className="mt-8 space-y-6 text-base leading-7">
            <div>
              <dt className="text-muted text-sm font-semibold">Requests</dt>
              <dd className="mt-1 font-semibold">{item.scope}</dd>
            </div>
            <div>
              <dt className="text-muted text-sm font-semibold">Used for</dt>
              <dd className="mt-1">{item.purpose}</dd>
            </div>
            <div className="bg-background rounded-2xl p-4">
              <dt className="text-muted text-sm font-semibold">Limits</dt>
              <dd className="mt-1">{item.restrictions}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  </PageSection>
);

export default OAuthSecuritySection;
