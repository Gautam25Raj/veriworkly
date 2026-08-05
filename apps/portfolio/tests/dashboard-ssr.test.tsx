import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://test-backend.local";

import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { PortfolioAnalyticsWorkspace } from "@/components/dashboard/analytics/PortfolioAnalyticsWorkspace";
import { PortfolioDashboardWorkspace } from "@/components/dashboard/overview/PortfolioDashboardWorkspace";
import { createDefaultPortfolio, type PortfolioContent } from "@/lib/portfolio";
import { usePortfolioStore } from "@/store/portfolio-store";

/**
 * `renderToStaticMarkup` runs no effects, so it reproduces exactly what the server
 * emits — which is the whole point of these tests. The dashboard used to derive its
 * context solely from the Zustand store, and the store is only populated from an
 * effect, so the server shipped an empty shell that the client then overwrote.
 */

const completeContent: PortfolioContent = {
  ...createDefaultPortfolio(),
  identity: {
    name: "Gautam Raj",
    headline: "Staff engineer building developer tools",
    bio: "Bio",
    email: "gautam@veriworkly.com",
    location: "Bengaluru",
    availability: "",
    avatar: null,
  },
  seo: { title: "Gautam Raj", description: "Portfolio of Gautam Raj", socialImage: null },
  sections: [
    {
      id: "a",
      type: "projects",
      title: "Projects",
      subtitle: "",
      visible: true,
      items: [{ id: "1" }, { id: "2" }, { id: "3" }],
    },
    { id: "b", type: "experience", title: "Experience", subtitle: "", visible: true, items: [] },
  ],
};

function bootstrap({
  locked = false,
  canPublish = true,
  totalViews = 1234,
}: { locked?: boolean; canPublish?: boolean; totalViews?: number } = {}) {
  return {
    user: { name: "Gautam Raj", email: "gautam@veriworkly.com" },
    workspace: {
      draft: {
        id: "doc_1",
        slug: "gautam",
        templateId: "signal",
        content: completeContent,
        revision: 4,
        updatedAt: new Date("2026-08-01T00:00:00.000Z").toISOString(),
      },
      publication: { subdomain: "gautam", status: "LIVE" as const },
      billing: { canPublish, status: canPublish ? "ACTIVE" : "INACTIVE" },
    },
    analytics: {
      locked,
      totalViews: locked ? 0 : totalViews,
      daily: locked ? [] : [{ date: "2026-08-01T00:00:00.000Z", count: 12 }],
      referrers: locked ? [] : [{ host: "news.ycombinator.com", count: 9 }],
    },
    isAdmin: false,
  };
}

beforeEach(() => {
  // The store is a module-level singleton shared across tests; reset the hydration
  // flag so each render starts from the pre-hydration state a server pass sees.
  usePortfolioStore.setState({ ready: false });
});

describe("dashboard server rendering", () => {
  it("emits the real portfolio data in the initial HTML", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceProvider initialData={bootstrap()}>
        <PortfolioDashboardWorkspace />
      </WorkspaceProvider>,
    );

    // Each of these was the empty-state value before the provider fell back to
    // `initialData`: no name, "0" views, "0%" readiness, "Create your first draft".
    expect(markup).toContain("Gautam");
    expect(markup).toContain("1234");
    expect(markup).toContain("100");
    expect(markup).toContain("gautam.veriworkly.com");
    expect(markup).toContain("Staff engineer building developer tools");
    expect(markup).not.toContain("Create your first draft");
  });

  it("does not read the clock during the server pass", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceProvider initialData={bootstrap()}>
        <PortfolioDashboardWorkspace />
      </WorkspaceProvider>,
    );

    // A server-timezone greeting would hydrate into a different one for the visitor.
    expect(markup).toContain("Welcome back");
    expect(markup).not.toContain("Good morning");
    expect(markup).not.toContain("Good afternoon");
    expect(markup).not.toContain("Good evening");
  });

  it("shows the free-tier address rather than a subdomain the account lacks", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceProvider initialData={bootstrap({ canPublish: false, locked: true })}>
        <PortfolioDashboardWorkspace />
      </WorkspaceProvider>,
    );

    expect(markup).toContain("portfolio.veriworkly.com/portfolio/gautam");
    expect(markup).not.toContain(">gautam.veriworkly.com<");
  });

  it("withholds view counts from a locked account instead of showing a false zero", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceProvider initialData={bootstrap({ canPublish: false, locked: true })}>
        <PortfolioDashboardWorkspace />
      </WorkspaceProvider>,
    );

    expect(markup).toContain("Available on Creator Pro");
  });
});

describe("analytics server rendering", () => {
  it("renders the figures for an entitled account", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceProvider initialData={bootstrap()}>
        <PortfolioAnalyticsWorkspace />
      </WorkspaceProvider>,
    );

    expect(markup).toContain("1234");
    expect(markup).toContain("news.ycombinator.com");
    expect(markup).not.toContain("Upgrade to Pro");
  });

  it("ships no figures at all when the server locked the payload", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceProvider initialData={bootstrap({ canPublish: false, locked: true })}>
        <PortfolioAnalyticsWorkspace />
      </WorkspaceProvider>,
    );

    // The lock is enforced server-side, so the numbers are absent from the payload
    // entirely rather than merely blurred by CSS.
    expect(markup).toContain("Upgrade to Pro");
    expect(markup).not.toContain("1234");
    expect(markup).not.toContain("news.ycombinator.com");
    // And the hidden region is out of the accessibility tree.
    expect(markup).toContain("inert");
  });
});
