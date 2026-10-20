import type { MDXComponents } from "mdx/types";

import defaultMdxComponents from "fumadocs-ui/mdx";

import {
  Pre,
  CodeBlock,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";

import { EngineSize, EngineVersion } from "@/components/engine-size";

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
    TypeTable,
    EngineSize,
    EngineVersion,
    CodeBlockTab,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img: (props: any) => <ImageZoom {...props} />,
    pre: (props) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    // `OpenAPIPage` is injected per-request by the API-reference route, which is where the
    // preloaded schema is resolved. It is deliberately not registered globally.
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
