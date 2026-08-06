"use client";

import AdminErrorState from "@/components/admin/AdminErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminErrorState error={error} reset={reset} surface="the API keys list" />;
}
