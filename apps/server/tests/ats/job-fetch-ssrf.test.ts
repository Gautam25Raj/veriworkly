import { describe, expect, it, vi } from "vitest";

vi.mock("#lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { AtsJobFetchService } = await import("#services/ats/jobFetch");

/**
 * The job-URL fetcher takes a user-supplied URL, so it is the server's one deliberate SSRF
 * surface. Literal IPs short-circuit DNS resolution in validateUrl, so these cases assert the
 * blocklist itself without any network access.
 */
describe("AtsJobFetchService SSRF guards", () => {
  const blockedHosts: Array<[string, string]> = [
    ["169.254.169.254", "cloud instance metadata"],
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "RFC1918 class A"],
    ["192.168.1.1", "RFC1918 class C"],
    ["172.16.0.1", "RFC1918 class B"],
    ["100.64.0.1", "CGNAT 100.64/10"],
    ["198.18.0.1", "benchmarking 198.18/15"],
    ["192.0.0.1", "IETF protocol assignments"],
    ["0.0.0.0", "unspecified"],
    ["255.255.255.255", "broadcast"],
    ["224.0.0.1", "multicast"],
    ["[::1]", "IPv6 loopback"],
    ["[fd00::1]", "IPv6 unique local"],
    ["[fe80::1]", "IPv6 link local"],
  ];

  it.each(blockedHosts)("blocks %s (%s)", async (host) => {
    await expect(AtsJobFetchService.fetch(`https://${host}/job`)).rejects.toThrow(
      /blocked network/i,
    );
  });

  it("rejects non-HTTPS schemes", async () => {
    await expect(AtsJobFetchService.fetch("http://example.com/job")).rejects.toThrow(/HTTPS/i);
    await expect(AtsJobFetchService.fetch("file:///etc/passwd")).rejects.toThrow(/HTTPS/i);
  });

  it("rejects non-standard ports", async () => {
    await expect(AtsJobFetchService.fetch("https://example.com:8080/job")).rejects.toThrow(
      /standard port/i,
    );
  });

  it("rejects credentials embedded in the URL", async () => {
    await expect(AtsJobFetchService.fetch("https://user:pass@example.com/job")).rejects.toThrow(
      /not allowed/i,
    );
  });

  it("rejects localhost and .local hostnames without resolving them", async () => {
    await expect(AtsJobFetchService.fetch("https://localhost/job")).rejects.toThrow(/not allowed/i);
    await expect(AtsJobFetchService.fetch("https://printer.local/job")).rejects.toThrow(
      /not allowed/i,
    );
  });
});
