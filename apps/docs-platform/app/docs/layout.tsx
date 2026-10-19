import { DocsLayout as FumadocsDocsLayout } from "fumadocs-ui/layouts/notebook";

import { source } from "@/lib/source";

import { baseOptions, docsTabs } from "@/app/layout.config";

const DocsLayout = ({ children }: { children: React.ReactNode }) => {
  const { nav, ...base } = baseOptions;

  return (
    <FumadocsDocsLayout tree={source.getPageTree()} {...base} nav={{ ...nav }} tabs={docsTabs}>
      {children}
    </FumadocsDocsLayout>
  );
};

export default DocsLayout;
