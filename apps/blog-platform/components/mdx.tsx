import type { MDXComponents } from "mdx/types";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { Pre, CodeBlock } from "fumadocs-ui/components/codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout,
    Tab,
    Tabs,
    Accordion,
    Accordions,
    Card,
    Cards,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img: (props: any) => <ImageZoom {...props} />,
    // Comparison tables are wide by nature. Scroll them in place so the page
    // body never scrolls horizontally on small screens.
    table: (props: React.ComponentProps<"table">) => (
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table {...props} />
      </div>
    ),
    pre: (props) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...components,
  } satisfies MDXComponents;
}
