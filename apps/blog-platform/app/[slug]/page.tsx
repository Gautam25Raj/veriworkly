import type { Metadata } from "next";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DocsBody } from "fumadocs-ui/layouts/notebook/page";
import { ArrowLeft, Clock, Calendar, ArrowRight, RefreshCw } from "lucide-react";

import { blog } from "@/lib/source";
import { siteConfig } from "@/config/site";
import { getReadingTime } from "@/lib/read-time";

import PostActions from "@/components/blog/PostActions";
import PostFaq from "@/components/blog/PostFaq";

import { getMDXComponents } from "@/components/mdx";

import { Container } from "@/components/layout/Container";
import { buildPostSchema } from "@/lib/structured-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const ogImageFor = (title: string, description: string) => {
  const url = new URL(`${siteConfig.url}/api/og`);

  url.searchParams.set("title", title || siteConfig.name);
  url.searchParams.set("description", description || siteConfig.description);

  return url.toString();
};

export default async function BlogPostPage(props: PageProps) {
  const params = await props.params;
  const page = blog.getPage([params.slug]);

  if (!page) notFound();

  const MDX = page.data.body;
  const postUrl = `${siteConfig.url}/${params.slug}`;
  const { faq, tags, category, updated, date, title, description, author } = page.data;

  const schema = buildPostSchema({
    title,
    description,
    author,
    date,
    updated,
    tags,
    faq,
    url: postUrl,
    imageUrl: ogImageFor(title, description),
  });

  return (
    <div className="min-h-screen py-12 md:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Container>
        <div className="grid gap-12 lg:grid-cols-4 lg:gap-16">
          <main className="space-y-8 lg:col-span-3">
            <header className="space-y-6">
              <Link
                href="/"
                className="text-muted hover:text-foreground group inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-all duration-300"
              >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />{" "}
                Back to Blog
              </Link>

              <div className="space-y-4">
                <div className="bg-accent/10 text-accent w-fit rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase">
                  {category}
                </div>

                <h1 className="text-foreground text-3xl leading-[1.15] font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                  {title}
                </h1>

                <p className="text-muted max-w-3xl text-lg leading-relaxed font-medium md:text-xl">
                  {description}
                </p>
              </div>
            </header>

            <div className="bg-border/40 h-px" />

            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <DocsBody className="[&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground [&_p]:text-muted [&_li]:text-muted [&_blockquote]:text-muted [&_td]:text-muted [&_th]:text-foreground max-w-none [&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-500 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500/40 [&_blockquote]:pl-6 [&_blockquote]:italic [&_code]:rounded-md [&_code]:bg-zinc-500/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:md:text-3xl [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:tracking-tight [&_h3]:md:text-2xl [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-bold [&_li]:my-2 [&_li]:leading-7 [&_ol]:my-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-6 [&_p]:text-base [&_p]:leading-8 md:[&_p]:text-lg [&_table]:my-8 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border-t [&_td]:border-zinc-500/20 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:border-b [&_th]:border-zinc-500/30 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-bold [&_thead]:bg-zinc-500/5 [&_ul]:my-6 [&_ul]:list-disc [&_ul]:pl-6">
                <MDX components={getMDXComponents()} />
              </DocsBody>
            </div>

            <PostFaq items={faq} />
          </main>

          {/* Sticky Metadata & Project Callout Sidebar */}
          <aside className="border-border/40 h-fit space-y-8 border-t pt-8 lg:sticky lg:top-24 lg:col-span-1 lg:border-t-0 lg:pt-0">
            {/* Publisher Block */}
            <div className="space-y-4">
              <div className="text-muted font-mono text-[10px] font-bold tracking-widest uppercase">
                Author
              </div>
              <div className="flex items-center gap-3">
                <div className="border-border bg-card rounded-full border p-1">
                  <Image
                    width={32}
                    height={32}
                    alt="VeriWorkly Logo"
                    src="/veriworkly-logo.png"
                    className="rounded-full"
                  />
                </div>
                <div>
                  <p className="text-foreground text-sm leading-none font-bold">{author}</p>
                  <p className="text-muted mt-1 text-xs">Career &amp; hiring research</p>
                </div>
              </div>
            </div>

            <div className="bg-border/40 h-px" />

            <div className="space-y-4">
              <div className="text-muted font-mono text-[10px] font-bold tracking-widest uppercase">
                Details
              </div>

              <div className="space-y-3 text-sm font-medium text-zinc-500">
                <div className="flex items-center gap-2.5">
                  <Calendar className="size-4 text-zinc-400" />
                  <span>Published {formatDate(date)}</span>
                </div>

                {updated && (
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="size-4 text-zinc-400" />
                    <span>Updated {formatDate(updated)}</span>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <Clock className="size-4 text-zinc-400" />
                  <span>{getReadingTime(page.data.info.path)}</span>
                </div>
              </div>
            </div>

            <div className="bg-border/40 h-px" />

            <div className="space-y-4">
              <div className="text-muted font-mono text-[10px] font-bold tracking-widest uppercase">
                Actions
              </div>

              <PostActions title={page.data.title} url={postUrl} path={page.data.info.path} />
            </div>

            <div className="bg-border/40 h-px" />

            <div className="border-border/60 bg-card/50 space-y-4 rounded-2xl border p-5">
              <h4 className="text-foreground text-sm font-bold">VeriWorkly Platform</h4>

              <p className="text-muted text-xs leading-relaxed">
                Build a professional, ATS-friendly resume for free. 100% open-source and
                privacy-first.
              </p>

              <Link
                href={siteConfig.links.app}
                className="text-accent inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-all hover:gap-2"
              >
                Launch Builder <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}

export function generateStaticParams() {
  return blog.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = blog.getPage([params.slug]);

  if (!page) notFound();

  const { title, description, author, date, updated, tags } = page.data;

  const ogUrl = ogImageFor(title, description);
  const postUrl = `${siteConfig.url}/${params.slug}`;

  return {
    title,
    description,

    authors: [{ name: author }],
    creator: siteConfig.creator,
    publisher: siteConfig.shortName,

    ...(tags.length > 0 && { keywords: tags }),

    alternates: {
      canonical: postUrl,
    },

    openGraph: {
      title,
      description,
      type: "article",
      url: postUrl,
      publishedTime: new Date(date).toISOString(),
      modifiedTime: new Date(updated ?? date).toISOString(),
      authors: [author],
      tags: [...tags],
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: title || siteConfig.name,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}
