import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockSendMail, mockGetRedis, counters } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockGetRedis: vi.fn(),
  counters: new Map<string, number>(),
}));

vi.mock("../../src/services/mail/transporter.js", () => ({
  sendMail: mockSendMail,
}));

vi.mock("#lib/redis", () => ({ getRedis: mockGetRedis }));

// Mock config values
const mockConfig = vi.hoisted(() => ({
  admin: {
    email: "admin-recipient@example.com",
  },
}));

vi.mock("#config", () => ({
  config: mockConfig,
  isDevelopment: true,
}));

import { sendContactEmail } from "../../src/services/mail/generalMail.js";

/** A Redis whose `MULTI` INCR counts per key, as the receipt throttle uses it. */
function counterRedis() {
  return {
    multi() {
      let key = "";
      const chain = {
        incr: (k: string) => ((key = k), chain),
        expire: () => chain,
        ttl: () => chain,
        exec: async () => {
          const next = (counters.get(key) ?? 0) + 1;
          counters.set(key, next);
          return [next, 1, 86400];
        },
      };
      return chain;
    },
  };
}

const attack = {
  name: "<script>alert('XSS')</script> John",
  email: 'attacker@example.com" onclick="alert(1)',
  subject: "Important <b>Notification</b>",
  message: "Hello\nWorld <iframe src='malicious.com'></iframe>",
};

describe("generalMail service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counters.clear();
    mockGetRedis.mockReturnValue(counterRedis());
  });

  it("sends the team the escaped content and the submitter a receipt without it", async () => {
    await sendContactEmail(attack);

    expect(mockSendMail).toHaveBeenCalledTimes(2);

    // 1. First call: Admin notification with replyTo
    expect(mockSendMail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "admin-recipient@example.com",
        replyTo: 'attacker@example.com" onclick="alert(1)',
        subject:
          "[VeriWorkly Contact] Important <b>Notification</b> from <script>alert('XSS')</script> John",
        text: expect.stringContaining("<script>alert('XSS')</script> John"),
        html: expect.stringContaining("&lt;script&gt;alert(&#039;XSS&#039;)&lt;/script&gt; John"),
      }),
    );

    const adminHtml = mockSendMail.mock.calls[0][0].html;
    expect(adminHtml).toContain("attacker@example.com&quot; onclick=&quot;alert(1)");
    expect(adminHtml).toContain("Important &lt;b&gt;Notification&lt;/b&gt;");
    expect(adminHtml).toContain(
      "World &lt;iframe src=&#039;malicious.com&#039;&gt;&lt;/iframe&gt;",
    );

    // 2. Second call: a fixed receipt (V-088). Nothing the submitter typed except a first name
    //    reduced to letters, so the form cannot relay text, links or markup to any address.
    const receipt = mockSendMail.mock.calls[1][0];
    expect(receipt.to).toBe('attacker@example.com" onclick="alert(1)');
    expect(receipt.subject).toBe("We've received your message – VeriWorkly");
    for (const field of [receipt.subject, receipt.text, receipt.html]) {
      expect(field).not.toContain("Notification");
      expect(field).not.toContain("malicious");
      expect(field).not.toContain("iframe");
      expect(field).not.toContain("<script");
      expect(field).not.toContain("John");
    }
    expect(receipt.text).toMatch(/^Hi scriptalert'XSS'script,/);
  });

  it("keeps only a letters-only first name of at most 40 characters", async () => {
    await sendContactEmail({ ...attack, name: `evil.example/${"a".repeat(60)} Smith` });

    const receipt = mockSendMail.mock.calls[1][0];
    expect(receipt.text).toMatch(new RegExp(`^Hi evilexample${"a".repeat(29)},`));
    expect(receipt.html).not.toContain("evil.example");
  });

  it("caps receipts at 3 per recipient per day; the team still gets every submission", async () => {
    for (let i = 0; i < 4; i += 1) await sendContactEmail(attack);

    const recipients = mockSendMail.mock.calls.map(([mail]) => mail.to);
    expect(recipients.filter((to) => to === "admin-recipient@example.com")).toHaveLength(4);
    expect(recipients.filter((to) => to === attack.email)).toHaveLength(3);
  });

  it("skips the receipt when Redis is unavailable", async () => {
    mockGetRedis.mockImplementation(() => {
      throw new Error("Redis client not ready");
    });

    await sendContactEmail(attack);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe("admin-recipient@example.com");
  });
});

describe("generalMail receipt cap keying", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counters.clear();
    mockGetRedis.mockReturnValue(counterRedis());
  });

  it("shares one 3-per-day budget across case and whitespace variants of an address", async () => {
    const spellings = [
      "Victim@Example.com",
      " victim@example.COM ",
      "victim@example.com",
      "VICTIM@EXAMPLE.COM",
    ];
    for (const email of spellings) await sendContactEmail({ ...attack, email });

    const receipts = mockSendMail.mock.calls.filter(
      ([mail]) => mail.to !== "admin-recipient@example.com",
    );
    expect(receipts).toHaveLength(3);
    expect(counters.size).toBe(1);
  });
});
