import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@veriworkly/ui";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AmbassadorReviewActions from "@/app/admin/ambassadors/AmbassadorReviewActions";

import { fetchAdminAmbassadorApplication } from "@/features/admin/services/admin-server";
import { formatDateTime, humanizeKey } from "@/features/admin/utils/admin-format";

export const metadata: Metadata = {
  title: "Admin · Ambassador application",
  robots: { index: false, follow: false },
};

/** The application questions, in the order the applicant answered them. */
const ANSWER_FIELDS: Array<{
  key: "whyJoin" | "superpower" | "funFact" | "vibeCheck";
  label: string;
}> = [
  { key: "whyJoin", label: "Why they want to join" },
  { key: "superpower", label: "Their superpower" },
  { key: "funFact", label: "Fun fact" },
  { key: "vibeCheck", label: "Vibe check" },
];

export default async function AdminAmbassadorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await fetchAdminAmbassadorApplication(id).catch(() => null);
  if (!data) notFound();

  const { application, reviewer, auditEntries } = data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Ambassador application"
        title={application.user.name || application.user.email}
        description={`${application.collegeName} · Class of ${application.graduationYear} · submitted ${formatDateTime(application.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge status={application.status} />
            <AmbassadorReviewActions
              applicationId={application.id}
              status={application.status}
              applicantEmail={application.user.email}
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="space-y-5 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Application</h3>

            {ANSWER_FIELDS.map((field) => {
              const answer = application[field.key];
              if (!answer) return null;

              return (
                <div key={field.key} className="space-y-1">
                  <p className="text-muted text-xs font-medium tracking-wide uppercase">
                    {field.label}
                  </p>
                  <p className="text-foreground text-sm leading-6 whitespace-pre-wrap">{answer}</p>
                </div>
              );
            })}

            {application.socialHandle ? (
              <div className="space-y-1">
                <p className="text-muted text-xs font-medium tracking-wide uppercase">Social</p>
                <p className="text-foreground text-sm">{application.socialHandle}</p>
              </div>
            ) : null}
          </Card>

          {application.status !== "PENDING" ? (
            <Card className="space-y-2 rounded-3xl p-6">
              <h3 className="text-foreground font-semibold tracking-tight">Review</h3>

              <p className="text-muted text-sm">
                {application.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
                {reviewer?.email ?? "an admin"} on {formatDateTime(application.reviewedAt)}.
              </p>

              {application.reviewNote ? (
                <p className="text-foreground text-sm leading-6">{application.reviewNote}</p>
              ) : null}
            </Card>
          ) : null}

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Audit history</h3>

            {auditEntries.length === 0 ? (
              <p className="text-muted text-sm">No admin actions on this application yet.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="space-y-0.5 py-2.5 text-sm">
                    <p className="text-foreground font-medium">{humanizeKey(entry.action)}</p>
                    <p className="text-muted text-xs">
                      {entry.actor?.email ?? "system"} · {formatDateTime(entry.createdAt)}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit space-y-3 rounded-3xl p-6">
          <h3 className="text-foreground font-semibold tracking-tight">Applicant</h3>

          <Link
            href={`/admin/users/${application.user.id}`}
            className="text-accent text-sm font-medium hover:underline"
          >
            Open full account →
          </Link>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="text-foreground truncate">{application.user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Current role</dt>
              <dd>
                <AdminStatusBadge status={application.user.role} />
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
