import { hasSessionCookie, serverFetchData } from "@/lib/server-fetch";
import { ApiRequestError } from "@/utils/fetchApiData";

export type AccountProfile = {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  emailVerified: boolean;
  autoSyncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    apiKeys?: number;
    resumes?: number;
    shareLinks?: number;
  };
};

/** `null` for a guest or a rejected session; an outage throws to the error boundary. */
export async function fetchAccountProfile(): Promise<AccountProfile | null> {
  if (!(await hasSessionCookie())) return null;

  try {
    return await serverFetchData<AccountProfile>("/users/me");
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}
