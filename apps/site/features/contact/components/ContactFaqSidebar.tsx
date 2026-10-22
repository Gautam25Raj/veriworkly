import { TYPE } from "@/components/marketing/PageLayout";

const HELP_TOPICS = [
  {
    title: "AI credits and billing",
    body: "A credit pack purchase or a payment that went wrong. We sort it out first.",
  },
  {
    title: "Portfolios and subdomains",
    body: "Setting up your subdomain, or syncing projects from GitHub.",
  },
  {
    title: "Resumes, cover letters and ATS",
    body: "Formatting tips, or how the ATS keyword matcher reads your job description.",
  },
  {
    title: "Bugs and feature ideas",
    body: "Something broke, or you have an idea that would make VeriWorkly better.",
  },
];

export const ContactFaqSidebar = () => (
  <aside className="flex flex-col gap-10">
    <div>
      <p className="text-muted text-base">Average reply time</p>
      <p className={`mt-2 ${TYPE.figure}`}>24 to 48 hours</p>

      <div className="mt-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-foreground text-background flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        >
          GR
        </span>
        <p className="text-muted text-base leading-6 text-pretty">
          Messages go to Gautam Raj, the founder, and the engineering inbox. A person writes the
          reply.
        </p>
      </div>
    </div>

    <div>
      <h3 className={TYPE.title}>We can help with</h3>
      <dl className="mt-4">
        {HELP_TOPICS.map((topic) => (
          <div key={topic.title} className="border-border border-t py-4">
            <dt className="text-base font-semibold">{topic.title}</dt>
            <dd className="text-muted mt-1 text-base leading-7">{topic.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  </aside>
);

export default ContactFaqSidebar;
