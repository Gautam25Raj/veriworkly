import type { Metadata } from "next";

import { notFound, redirect } from "next/navigation";

import type { ApiKeyDetailRecord } from "@/features/api-keys/components/ApiKeyTypes";

import { hasSessionCookie, serverFetchData } from "@/lib/server-fetch";

import ApiKeyDetailView from "@/features/api-keys/components/details/ApiKeyDetailView";

export const metadata: Metadata = {
  title: "API Key Details",
  robots: { index: false, follow: false },
};

export default async function ApiKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/api-keys/${encodeURIComponent(id)}`;

  // Keys belong to an account: a guest signs in and comes back here.
  if (!(await hasSessionCookie())) redirect(`/login?callbackURL=${encodeURIComponent(path)}`);

  // Only a real 404 is "not found"; any other failure reaches the error boundary.
  const keyDetails = await serverFetchData<ApiKeyDetailRecord>(path, { notFoundAsNull: true });

  if (!keyDetails) {
    notFound();
  }

  return <ApiKeyDetailView initialData={keyDetails} />;
}
