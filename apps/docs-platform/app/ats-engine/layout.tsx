import { DocsLayout as FumadocsDocsLayout } from "fumadocs-ui/layouts/notebook";

import { engineSource } from "@/lib/source";

import { baseOptions, docsTabs } from "@/app/layout.config";

const EngineDocsLayout = ({ children }: { children: React.ReactNode }) => {
  const { nav, ...base } = baseOptions;

  return (
    <FumadocsDocsLayout
      tree={engineSource.getPageTree()}
      {...base}
      tabs={docsTabs}
      nav={{ ...nav }}
    >
      {children}
    </FumadocsDocsLayout>
  );
};

export default EngineDocsLayout;
