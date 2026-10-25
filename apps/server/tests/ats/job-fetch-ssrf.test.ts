import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("#lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/** Hostname resolution under test control; the literal-IP cases below never reach it. */
const lookup = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
vi.mock("node:dns/promises", () => ({ lookup }));

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
    // URL parsing writes [::ffff:127.0.0.1] as [::ffff:7f00:1], which slipped past the checks.
    ["[::ffff:127.0.0.1]", "IPv4-mapped loopback"],
    ["[::ffff:a00:1]", "IPv4-mapped 10.0.0.1"],
    ["[::7f00:1]", "IPv4-compatible loopback"],
    ["[64:ff9b::a9fe:a9fe]", "NAT64 cloud metadata"],
    // The IPv6 ranges the old spelling-based list let through: `fe80` matched the literal
    // prefix only, so the rest of fe80::/10 passed, and these blocks were not listed at all.
    ["[fe90::1]", "IPv6 link local beyond the fe80 literal"],
    ["[febf::1]", "IPv6 link local, top of fe80::/10"],
    ["[FE80:0000:0000:0000:0000:0000:0000:0001]", "IPv6 link local written long and upper-case"],
    ["[fec0::1]", "IPv6 site local"],
    ["[2002:7f00:1::1]", "6to4 carrying a loopback IPv4"],
    ["[2002:0808:0808::1]", "6to4 (any destination: the IPv4 is chosen by the address)"],
    ["[64:ff9b:1::8.8.8.8]", "local-use NAT64"],
    ["[::ffff:8.8.8.8]", "IPv4-mapped, public target"],
    ["[::ffff:0:127.0.0.1]", "IPv4-translated (SIIT) loopback"],
    ["[::ffff:0:8.8.8.8]", "IPv4-translated (SIIT) public target"],
    ["[2001:db8::1]", "IPv6 documentation range"],
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

describe("the pinned DNS lookup", () => {
  // Node 20+ connects with `autoSelectFamily`, asking the lookup for every address; a single
  // address in reply failed every hostname URL with ERR_INVALID_IP_ADDRESS.
  it("answers with a list when asked for every address, and with one address otherwise", async () => {
    const { pinnedLookup } = await import("#services/ats/jobFetch");
    const lookup = pinnedLookup({ address: "93.184.215.14", family: 4 });
    const all = vi.fn();
    lookup("example.com", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.215.14", family: 4 }]);
    const one = vi.fn();
    lookup("example.com", {}, one);
    expect(one).toHaveBeenCalledWith(null, "93.184.215.14", 4);
  });

  it("connects through it: a real request resolves the host with the pinned address", async () => {
    const { request } = await import("node:http");
    const { createServer } = await import("node:http");
    const { pinnedLookup } = await import("#services/ats/jobFetch");
    const server = createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const req = request(
          {
            host: "pinned.invalid",
            port,
            path: "/",
            lookup: pinnedLookup({ address: "127.0.0.1", family: 4 }) as never,
          },
          (res) => {
            let text = "";
            res.on("data", (chunk) => (text += chunk));
            res.on("end", () => resolve(text));
          },
        );
        req.on("error", reject);
        req.end();
      });
      expect(body).toBe("ok");
    } finally {
      server.close();
    }
  });
});

/**
 * `getaddrinfo` has no timeout of its own and runs on the threadpool the server shares with
 * crypto: one slow resolver for an attacker's hostname held a thread as long as the OS allowed,
 * once per redirect hop. The request gives up on the name after 5 s instead.
 */
describe("hostname resolution", () => {
  afterEach(() => {
    vi.useRealTimers();
    lookup.mockReset();
  });

  it("gives up on a lookup that has not answered after 5 seconds", async () => {
    vi.useFakeTimers();
    lookup.mockImplementation(() => new Promise(() => undefined));

    const pending = AtsJobFetchService.fetch("https://slow.example/job");
    const outcome = expect(pending).rejects.toThrow(/could not be resolved in time/i);
    await vi.advanceTimersByTimeAsync(5_001);

    await outcome;
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("answers a name that does not resolve with a 400, not a raw error", async () => {
    lookup.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }),
    );

    await expect(AtsJobFetchService.fetch("https://nowhere.example/job")).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/could not be resolved/i),
    });
  });

  it("blocks a name that resolves into a blocked IPv6 range", async () => {
    lookup.mockResolvedValue([{ address: "fe90::1", family: 6 }]);

    await expect(AtsJobFetchService.fetch("https://linklocal.example/job")).rejects.toThrow(
      /blocked network/i,
    );
  });
});
