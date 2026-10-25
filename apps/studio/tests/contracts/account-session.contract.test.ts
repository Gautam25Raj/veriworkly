import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConvertedResume } from "@/features/ats/types";

import type { BillingSummary } from "@/features/billing/types";
import type { BaseDocument } from "@/features/documents/core/types";
import type { ResumeData } from "@/types/resume";

import { buildWorkspaceBackup, signOutCurrentUser } from "@/features/auth/services/current-user";
import {
  purchaseFingerprint,
  recordPurchaseBaseline,
  rememberPurchaseBaseline,
  takePurchaseBaseline,
} from "@/features/billing/purchase-baseline";
import { importJsonFile } from "@/features/documents/services/import-service";
import { buildResumeFromConversion, toHttpUrl, toMonthDate } from "@/features/ats/converted-resume";
import {
  createDocument,
  listDocuments,
  loadDocumentById,
  saveDocument,
  clearWorkspaceStorage,
} from "@/features/documents/services/document-workspace-service";
import {
  isHttpUrl,
  isMonthDate,
  isYearDate,
} from "@/features/resume/schemas/resume-validation-rules";

// lib/constants reads the backend URL when it is first imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL ||= "http://localhost:8080/api/v1";
});

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    get length() {
      return store.size;
    },
  };
}

function stubBrowser(hostname: string) {
  const localStorageMock = createLocalStorageMock();
  const cookieWrites: string[] = [];

  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    location: { hostname, protocol: "https:" },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    get cookie() {
      return "";
    },
    set cookie(value: string) {
      cookieWrites.push(value);
    },
  });

  return { localStorageMock, cookieWrites };
}

describe("sign-out clears this device only once the server agrees", () => {
  let cookieWrites: string[];

  beforeEach(() => {
    ({ cookieWrites } = stubBrowser("app.veriworkly.com"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("S-011: a confirmed sign-out removes every document and expires the guest cookie on both domains", async () => {
    createDocument("RESUME");
    createDocument("COVER_LETTER");
    expect(listDocuments()).toHaveLength(2);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );

    await signOutCurrentUser();

    expect(listDocuments()).toHaveLength(0);
    expect(localStorage.length).toBe(0);
    expect(cookieWrites).toContainEqual(
      expect.stringMatching(/^veriworkly-guest-mode=;.*max-age=0(?!.*domain=)/),
    );
    expect(cookieWrites).toContainEqual(
      expect.stringMatching(/^veriworkly-guest-mode=;.*max-age=0.*domain=\.veriworkly\.com/),
    );
  });

  it("S-131: a failed sign-out throws and keeps the local documents", async () => {
    createDocument("RESUME");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );

    await expect(signOutCurrentUser()).rejects.toThrow(/still signed in/);
    expect(listDocuments()).toHaveLength(1);
    expect(cookieWrites).toHaveLength(0);
  });

  it("S-131: an already-expired session (401) still clears the device", async () => {
    createDocument("RESUME");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );

    await signOutCurrentUser();

    expect(listDocuments()).toHaveLength(0);
  });
});

function aiConversion(): ConvertedResume {
  return {
    basics: {
      fullName: "Jordan Lee",
      role: "Data Analyst",
      headline: "",
      email: "jordan@example.com",
      phone: "555 0100",
      location: "Austin, TX",
    },
    links: [{ label: "LinkedIn", url: "linkedin.com/in/jordanlee" }],
    summary: "Analyst.",
    experience: [
      {
        company: "Acme",
        role: "Analyst",
        location: "",
        startDate: "Jan 2020",
        endDate: "Present",
        current: false,
        summary: "",
        highlights: ["Built reports"],
      },
      {
        company: "Globex",
        role: "Intern",
        location: "",
        startDate: "June 2018",
        endDate: "12/2019",
        current: false,
        summary: "",
        highlights: [],
      },
    ],
    education: [
      {
        school: "State University",
        degree: "BSc",
        field: "Statistics",
        startDate: "Sept 2014",
        endDate: "May 2018",
        current: false,
        summary: "",
      },
    ],
    projects: [
      {
        name: "Dashboard",
        role: "",
        link: "github.com/jordan/dashboard",
        summary: "",
        highlights: [],
        skills: [],
      },
    ],
    skills: [{ name: "Tools", keywords: ["SQL"] }],
  };
}

describe("one backup file before local data is cleared", () => {
  beforeEach(() => {
    stubBrowser("app.veriworkly.com");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function seedWorkspace() {
    const resume = createDocument("RESUME");
    const letter = createDocument("COVER_LETTER");
    const content = resume.content as ResumeData;

    saveDocument(
      {
        ...resume,
        title: "Backend roles",
        content: { ...content, basics: { ...content.basics, fullName: "Priya Raman" } },
      },
      { flush: true },
    );
    saveDocument({ ...letter, title: "Globex application" }, { flush: true });
  }

  function backupFile(json: string) {
    return new File([json], "veriworkly-backup-2026-10-26.json", { type: "application/json" });
  }

  it("S-217: the backup is one dated file of full documents, detached from the cloud", () => {
    seedWorkspace();

    const backup = buildWorkspaceBackup(listDocuments(), new Date("2026-10-26T12:00:00Z"));
    const parsed = JSON.parse(backup.json);

    expect(backup.fileName).toBe("veriworkly-backup-2026-10-26.json");
    expect(parsed).toMatchObject({ format: "veriworkly-backup", version: 1 });
    expect(parsed.documents.map((item: { type: string }) => item.type).sort()).toEqual([
      "COVER_LETTER",
      "RESUME",
    ]);
    expect(
      parsed.documents.every(
        (item: { sync: { cloudDocumentId: unknown } }) => item.sync.cloudDocumentId === null,
      ),
    ).toBe(true);
  });

  it("S-217: importing the backup restores the same titles, types and content", async () => {
    seedWorkspace();
    const before = listDocuments().map((meta) => loadDocumentById(meta.type, meta.id)!);
    const backup = buildWorkspaceBackup(listDocuments());

    clearWorkspaceStorage();
    const outcome = await importJsonFile("COVER_LETTER", backupFile(backup.json), async () => null);

    expect(outcome).toMatchObject({ kind: "backup", skipped: 0, saved: { ok: true } });

    const after = listDocuments().map((meta) => loadDocumentById(meta.type, meta.id)!);
    const shape = (documents: BaseDocument[]) =>
      documents
        .map((item) => ({ type: item.type, title: item.title, templateId: item.templateId }))
        .sort((a, b) => a.type.localeCompare(b.type));

    expect(shape(after)).toEqual(shape(before));
    const restoredResume = after.find((item) => item.type === "RESUME")!.content as ResumeData;
    expect(restoredResume.basics.fullName).toBe("Priya Raman");
    // Same content apart from the identity the restored copy was given: nothing added,
    // including sample data, and nothing lost.
    const content = (documents: BaseDocument[], type: string) => {
      const { id, sync, updatedAt, ...rest } = documents.find((item) => item.type === type)!
        .content as Record<string, unknown>;
      void [id, sync, updatedAt];
      return rest;
    };
    expect(content(after, "RESUME")).toEqual(content(before, "RESUME"));
    expect(content(after, "COVER_LETTER")).toEqual(content(before, "COVER_LETTER"));
  });

  it("S-217: a free workspace restores what fits and reports the rest as skipped", async () => {
    seedWorkspace();
    const backup = buildWorkspaceBackup(listDocuments());

    const outcome = await importJsonFile("RESUME", backupFile(backup.json), async () => 1);

    expect(outcome).toMatchObject({ kind: "backup", skipped: 2 });
    expect(listDocuments()).toHaveLength(2);
  });

  it("S-217: an unreadable document fails the backup instead of being skipped", () => {
    createDocument("RESUME");
    const documents = [...listDocuments(), { ...listDocuments()[0], id: "resume-missing-body" }];

    expect(() => buildWorkspaceBackup(documents)).toThrow(/could not be read/);
  });
});

describe("purchase baseline survives the payment redirect", () => {
  beforeEach(() => {
    const store = new Map<string, string>();

    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const free = {
    plan: "FREE",
    activeProductKeys: [],
    entitlements: [],
    credits: { balance: 0 },
  } as unknown as BillingSummary;

  it("S-155: the baseline is the pre-checkout state and is read once", () => {
    rememberPurchaseBaseline("bundle", free);

    expect(takePurchaseBaseline()).toBe(purchaseFingerprint(free));
    expect(takePurchaseBaseline()).toBeNull();
  });

  it("S-155: a plan that changed before the redirect differs from the baseline", () => {
    rememberPurchaseBaseline("bundle", free);
    const paid = { ...free, plan: "BUNDLE", entitlements: ["ai_credits"] } as BillingSummary;

    expect(purchaseFingerprint(paid)).not.toBe(takePurchaseBaseline());
  });

  it("S-155: the baseline is read fresh from the server, not from the rendered page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ success: true, data: free }), { status: 200 }),
      ),
    );

    await recordPurchaseBaseline("credit_pack_250");

    expect(takePurchaseBaseline()).toBe(purchaseFingerprint(free));
  });

  it("S-155: a failed read stores no baseline, dropping any stale one", async () => {
    rememberPurchaseBaseline("bundle", free);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );

    await recordPurchaseBaseline("credit_pack_250");

    expect(takePurchaseBaseline()).toBeNull();
  });
});

describe("ATS draft: AI output becomes a resume the strict path accepts", () => {
  it("S-119: coerces links and month-name dates instead of discarding them", () => {
    expect(toHttpUrl("linkedin.com/in/x")).toBe("https://linkedin.com/in/x");
    expect(toHttpUrl("http://x.dev")).toBe("http://x.dev");
    expect(toMonthDate("Jan 2020")).toBe("2020-01");
    expect(toMonthDate("September 2021")).toBe("2021-09");
    expect(toMonthDate("3/2019")).toBe("2019-03");
    expect(toMonthDate("2020-1")).toBe("2020-01");
    expect(toMonthDate("2020")).toBe("");

    const resume = buildResumeFromConversion(aiConversion(), "resume-ats");

    expect(resume.links.items[0].url).toBe("https://linkedin.com/in/jordanlee");
    expect(resume.experience[0]).toMatchObject({
      startDate: "2020-01",
      endDate: "",
      current: true,
    });
    expect(resume.experience[1]).toMatchObject({ startDate: "2018-06", endDate: "2019-12" });
    expect(resume.education[0]).toMatchObject({ startDate: "2014", endDate: "2018" });
    expect(resume.projects[0].link).toBe("https://github.com/jordan/dashboard");
    expect(resume.basics.phone).toBe("555 0100");
  });

  it("S-119: normalises over the empty resume, not sample content", () => {
    const resume = buildResumeFromConversion(aiConversion(), "resume-ats");
    const serialized = JSON.stringify(resume).toLowerCase();

    expect(serialized).not.toMatch(/veriworkly user|alex morgan|example\.com\/alex/);
    expect(resume.id).toBe("resume-ats");
    expect(resume.languages).toEqual([]);
  });

  it("S-119: every link and date the draft carries passes the strict field rules", () => {
    const resume = buildResumeFromConversion(aiConversion(), "resume-ats");
    const urls = [
      ...resume.links.items.map((item) => item.url),
      ...resume.projects.map((item) => item.link),
    ];

    expect(urls.every((url) => url && isHttpUrl(url))).toBe(true);
    expect(
      resume.experience.every((item) => isMonthDate(item.startDate) && isMonthDate(item.endDate)),
    ).toBe(true);
    expect(
      resume.education.every((item) => isYearDate(item.startDate) && isYearDate(item.endDate)),
    ).toBe(true);
  });

  it("S-175: projects carry no hard-coded link label", () => {
    const resume = buildResumeFromConversion(aiConversion(), "resume-ats");

    expect(resume.projects[0].linkLabel).not.toBe("Link");
  });
});
