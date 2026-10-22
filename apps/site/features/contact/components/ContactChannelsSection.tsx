import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { siteConfig } from "@/config/site";

import { PageSection } from "@/components/marketing/PageLayout";

const contactChannels = [
  {
    label: "Email",
    value: siteConfig.email,
    href: `mailto:${siteConfig.email}`,
    detail: "Billing, AI credits and help with a document. Straight to the founder's inbox.",
  },
  {
    label: "GitHub Discussions",
    value: "Public forum",
    href: `${siteConfig.links.github}/discussions`,
    detail: "Feature requests, ideas and open-source questions, answered in the open.",
  },
  {
    label: "Security reports",
    value: "Private disclosure",
    href: "/security#disclosure",
    detail: "Found a vulnerability? Report it privately before anything goes public.",
  },
];

export const ContactChannelsSection = () => (
  <PageSection
    title="Other ways in."
    lede="Prefer email, or want the conversation in public? Pick the channel that fits."
  >
    <ul className="grid gap-6 md:grid-cols-3">
      {contactChannels.map((channel) => {
        const external = channel.href.startsWith("http");

        return (
          <li key={channel.label} className="reveal">
            <Link
              href={channel.href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group bg-card focus-visible:ring-accent/40 flex h-full flex-col rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99] sm:p-8"
            >
              <span className="text-muted text-base">{channel.label}</span>
              <span className="group-hover:text-accent mt-2 flex items-start justify-between gap-3 text-2xl font-bold tracking-tight wrap-anywhere transition-colors duration-200">
                {channel.value}
                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-1 size-6 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
              <span className="text-muted mt-6 text-base leading-7">{channel.detail}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  </PageSection>
);

export default ContactChannelsSection;
