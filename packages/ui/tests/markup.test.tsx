import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  Checkbox,
  GithubIcon,
  Input,
  MarketingDesktopNav,
  MarketingFooter,
  MarketingMobileNav,
  MarketingNavbar,
  Select,
  Switch,
  TextArea,
  Tooltip,
} from "../src";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const Icon = ({ className }: { className?: string }) => <svg className={className} />;

describe("Button", () => {
  it("merges className from Button and the asChild child", () => {
    const out = html(
      <Button asChild className="w-full">
        <a href="/x" className="font-bold">
          Go
        </a>
      </Button>,
    );

    expect(out).toContain("w-full");
    expect(out).toContain("font-bold");
    expect(out).toMatch(/^<a /);
  });

  it("takes a disabled asChild link out of the tab order", () => {
    const out = html(
      <Button asChild disabled>
        <a href="/x">Go</a>
      </Button>,
    );

    expect(out).toContain('aria-disabled="true"');
    expect(out).toContain('tabindex="-1"');
  });

  // Regression: a handler here crashed Server Components using Button asChild.
  it("adds no click handler to an asChild child that had none", () => {
    const element = Button({
      asChild: true,
      disabled: true,
      children: <a href="/x">Go</a>,
    }) as React.ReactElement<{ onClick?: unknown }>;

    expect(element.props.onClick).toBeUndefined();
  });

  it("marks a loading button busy and hides the spinner from assistive tech", () => {
    const out = html(<Button loading>Save</Button>);

    expect(out).toContain('aria-busy="true"');
    expect(out).toContain("disabled");
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(out).not.toContain("Save");
  });
});

describe("text fields", () => {
  it.each([
    ["Input", <Input key="i" error />],
    ["TextArea", <TextArea key="t" error />],
    ["Select", <Select key="s" error />],
  ])("%s exposes `error` as aria-invalid", (_, node) => {
    expect(html(node)).toContain('aria-invalid="true"');
  });

  it("leaves aria-invalid off a valid field", () => {
    expect(html(<Input />)).not.toContain("aria-invalid=");
  });

  it("respects an explicit aria-invalid over `error`", () => {
    expect(html(<Input error aria-invalid={false} />)).toContain('aria-invalid="false"');
  });
});

describe("Checkbox", () => {
  it("honours defaultChecked when uncontrolled", () => {
    expect(html(<Checkbox defaultChecked label="Remember me" />)).toMatch(/<input[^>]*checked/);
  });

  it("associates the label and uses only phrasing content inside it", () => {
    const out = html(<Checkbox id="terms" label="Accept terms" />);

    expect(out).toContain('for="terms"');
    expect(out).toContain('id="terms"');
    expect(out).not.toMatch(/<label[^>]*>.*<div/);
  });
});

describe("Switch", () => {
  it("is exposed as a switch", () => {
    const out = html(<Switch checked onCheckedChange={() => {}} aria-label="Auto-sync" />);

    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-label="Auto-sync"');
  });
});

describe("Badge and Card", () => {
  it("applies the tinted-fill triplet for status variants", () => {
    const out = html(<Badge variant="success">Synced</Badge>);

    expect(out).toContain("bg-success/10");
    expect(out).toContain("border-success/25");
    expect(out).toContain("text-success");
  });

  it("renders a Card as the element it is given, with a themed border", () => {
    const out = html(<Card as="article">Body</Card>);

    expect(out).toMatch(/^<article /);
    expect(out).toContain("border-border/50");
  });
});

describe("Tooltip", () => {
  it("renders a manual popover with the tooltip role", () => {
    const out = html(
      <Tooltip content="Rename document">
        <button type="button">Rename</button>
      </Tooltip>,
    );

    expect(out).toContain('role="tooltip"');
    expect(out).toContain('popover="manual"');
    expect(out).toContain("Rename document");
  });
});

describe("Accordion", () => {
  const accordion = (
    <Accordion defaultValue="a">
      <AccordionItem value="a">
        <AccordionTrigger>Open one</AccordionTrigger>
        <AccordionContent>Answer A</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger headingLevel="h2">Closed one</AccordionTrigger>
        <AccordionContent>Answer B</AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  it("wires each trigger to its region", () => {
    const out = html(accordion);
    const controls = [...out.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);

    expect(controls).toHaveLength(2);
    for (const id of controls) expect(out).toContain(`id="${id}"`);
    expect(out).toContain('aria-expanded="true"');
    expect(out).toContain('aria-expanded="false"');
  });

  it("keeps collapsed answers in the markup for crawlers and find-in-page", () => {
    expect(html(accordion)).toContain("Answer B");
  });

  it("honours headingLevel", () => {
    expect(html(accordion)).toMatch(/<h2><button[^>]*>.*Closed one/);
  });
});

const navItems = [
  { name: "Templates", href: "/templates", icon: Icon },
  { name: "GitHub", href: "https://github.com/x", external: true, icon: Icon },
];

describe("marketing navbar", () => {
  it("renders a header landmark with a wired menu toggle", () => {
    const out = html(
      <MarketingNavbar
        logo={null}
        desktopNav={<MarketingDesktopNav items={navItems} />}
        actions={null}
        mobileNav={() => null}
      />,
    );

    expect(out).toMatch(/^<header /);
    expect(out).toContain('<nav aria-label="Main"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-controls="marketing-mobile-nav"');
    expect(out).toContain('aria-label="Open menu"');
  });

  it("announces external links as opening a new tab", () => {
    const out = html(<MarketingDesktopNav items={navItems} />);

    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain("(opens in a new tab)");
  });

  it("makes the closed mobile panel inert and names its GitHub link", () => {
    const out = html(
      <MarketingMobileNav
        isOpen={false}
        onClose={() => {}}
        items={navItems}
        resourceLinks={[]}
        legalLinks={[]}
        githubHref="https://github.com/x"
        appHref="/app"
      />,
    );

    expect(out).toMatch(
      /id="marketing-mobile-nav"[^>]*inert=""|inert=""[^>]*id="marketing-mobile-nav"/,
    );
    expect(out).toContain('aria-label="VeriWorkly on GitHub (opens in a new tab)"');
  });
});

describe("MarketingFooter", () => {
  const out = html(
    <MarketingFooter
      homeHref="/"
      logoSrc="/logo.png"
      shortName="VeriWorkly"
      brandName="VeriWorkly"
      description="One profile. Every document."
      email="hello@veriworkly.com"
      location="India"
      socialLinks={[{ name: "GitHub", href: "https://github.com/x", icon: GithubIcon }]}
      footerColumns={[{ title: "Product", links: [{ name: "Pricing", href: "/pricing" }] }]}
      legalLinks={[{ name: "Privacy", href: "/privacy" }]}
      tagline="All rights reserved."
      statusText="All templates free"
    />,
  );

  it("names icon-only social links", () => {
    expect(out).toContain('aria-label="GitHub (opens in a new tab)"');
  });

  it("uses h2 column headings, never a skipped level", () => {
    expect(out).toContain(">Product</h2>");
    expect(out).not.toContain("<h4");
  });

  it("links the email address", () => {
    expect(out).toContain('href="mailto:hello@veriworkly.com"');
  });

  it("does not announce the brand twice", () => {
    expect(out).not.toMatch(/alt="[^"]+"/);
  });
});

describe("SocialIcons", () => {
  it("is decorative unless labelled", () => {
    expect(html(<GithubIcon />)).toContain('aria-hidden="true"');
    expect(html(<GithubIcon aria-label="GitHub" />)).toContain('role="img"');
  });
});
