"use server";

import { revalidatePath } from "next/cache";

const REFRESHABLE_PATHS = new Set([
  "/roadmap",
  "/roadmap/todo",
  "/roadmap/in-progress",
  "/roadmap/done",
]);

/** A POST-only Server Action, not a GET `?refresh=`: crawlers cannot trigger it, and revalidatePath refills the shared cache once. */
export async function refreshRoadmapPath(formData: FormData) {
  const path = formData.get("path");

  if (typeof path !== "string" || !REFRESHABLE_PATHS.has(path)) return;

  revalidatePath(path);
}
