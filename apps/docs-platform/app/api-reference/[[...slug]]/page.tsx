import type { Metadata } from "next";

import {
  DocsBody,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  DocsDescription,
} from "fumadocs-ui/layouts/notebook/page";
import { notFound } from "next/navigation";

import { apiSource, getApiPageImage } from "@/lib/source";
import { openapi } from "@/lib/openapi";

import { getMDXComponents } from "@/components/mdx";
import { OpenAPIPage } from "@/components/api-page";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = apiSource.getPage(params.slug);

  if (!page) notFound();

  const pageData = page.data as unknown as {
    title: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toc: any[];
    full?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
  };

  const MDX = pageData.body;

  // Generated pages declare the schemas they need in `_openapi.preload`; resolve them here so the
  // client renderer receives the bundled document instead of fetching it.
  const { preloaded } = await openapi.preloadOpenAPIPage(page);

  const components = getMDXComponents({
    OpenAPIPage: (props: Record<string, unknown>) => (
      <OpenAPIPage {...(props as never)} preloaded={preloaded} />
    ),
  });

  return (
    <DocsPage
      tableOfContent={{
        style: "clerk",
        footer: (
          <EditOnGitHub
            href={`https://github.com/VeriWorkly/veriworkly/edit/master/apps/docs-platform/content/api-reference/${page.slugs.join("/") + ".mdx"}`}
          />
        ),
      }}
      toc={pageData.toc}
      full={pageData.full}
    >
      <DocsTitle>{pageData.title}</DocsTitle>
      <DocsDescription>{pageData.description}</DocsDescription>
      <DocsBody>
        <MDX components={components} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return apiSource.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = apiSource.getPage(params.slug);

  if (!page) notFound();

  const pageData = page.data as unknown as {
    title: string;
    description: string;
  };

  return {
    title: pageData.title,
    description: pageData.description,
    openGraph: {
      images: getApiPageImage(page).url,
    },
  };
}
