"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";

import type { ApiKeyRecord, GeneratedApiKeyRecord } from "../components/ApiKeyTypes";

import { useUserStore } from "@/store/useUserStore";
import { fetchApiData, type OffsetPaginationPayload } from "@/utils/fetchApiData";

import { apiKeyErrorMessage } from "../api-key-service";
import { useApiKeyActions } from "./useApiKeyActions";

type UseApiKeysOptions = {
  initialKeys: ApiKeyRecord[];
  initialKeysLoaded: boolean;
  initialPagination: OffsetPaginationPayload<ApiKeyRecord> | null;
};

export function useApiKeys({
  initialKeys,
  initialPagination,
  initialKeysLoaded,
}: UseApiKeysOptions) {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [pageSize] = useState(initialPagination?.pageSize ?? 20);
  const [totalPages, setTotalPages] = useState(initialPagination?.totalPages ?? 1);

  const [loading, setLoading] = useState(!initialKeysLoaded && isLoggedIn);
  const [hasMore, setHasMore] = useState(initialPagination?.hasMore ?? false);

  const [keys, setKeys] = useState<ApiKeyRecord[]>(initialKeys);
  const [generatedKey, setGeneratedKey] = useState<GeneratedApiKeyRecord | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const applyPage = useCallback((data: OffsetPaginationPayload<ApiKeyRecord>) => {
    setPage(data.page);
    setKeys(data.items);
    setHasMore(data.hasMore);
    setTotalPages(data.totalPages);
  }, []);

  const fetchKeys = useCallback(
    async (targetPage = 1) => {
      try {
        setLoading(true);

        const data = await fetchApiData<OffsetPaginationPayload<ApiKeyRecord>>(
          `/api-keys?page=${targetPage}&pageSize=${pageSize}`,
          { method: "GET" },
        );

        applyPage(data);
      } catch (error) {
        toast.error(apiKeyErrorMessage(error, "Failed to fetch API keys."));
      } finally {
        setLoading(false);
      }
    },
    [applyPage, pageSize],
  );

  useEffect(() => {
    if (!isLoggedIn) {
      queueMicrotask(() => {
        setLoading(false);
      });
      return;
    }

    if (initialKeysLoaded && initialPagination) {
      queueMicrotask(() => {
        applyPage(initialPagination);
        setLoading(false);
      });

      return;
    }

    queueMicrotask(() => {
      void fetchKeys(1);
    });
  }, [applyPage, fetchKeys, initialKeysLoaded, initialPagination, isLoggedIn]);

  const actions = useApiKeyActions({
    onRotated: (rotated) => {
      setGeneratedKey(rotated);
      // Rotating doesn't change which page the key lives on, so the list stays on it.
      void fetchKeys(page);
    },
    // Revoking keeps the row on this page.
    onRevoked: () => void fetchKeys(page),
    // The last row of a page steps back a page instead of fetching an empty one.
    onDeleted: () => void fetchKeys(keys.length <= 1 && page > 1 ? page - 1 : page),
  });

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedId(id);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy API key.");
    }
  };

  return {
    ...actions,
    generatedKey,
    copiedId,
    keys,
    page,
    totalPages,
    hasMore,
    loading,
    copyToClipboard,
    setGeneratedKey,
    goToPreviousPage: () => {
      if (page > 1 && !loading) void fetchKeys(page - 1);
    },
    goToNextPage: () => {
      if (hasMore && !loading) void fetchKeys(page + 1);
    },
  };
}
