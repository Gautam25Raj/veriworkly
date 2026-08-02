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
import { cn } from "@/lib/utils";

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
          <main className="space-y-10 lg:col-span-3">
            <header className="space-y-6">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors"
              >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />{" "}
                Back to Blog
              </Link>

              <div className="space-y-4">
                <div className="border-border/60 bg-muted/50 text-foreground w-fit rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase shadow-2xs">
                  {category}
                </div>

                <h1 className="text-foreground text-3xl font-extrabold leading-[1.14] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                  {title}
                </h1>

                <p className="text-muted-foreground max-w-3xl text-lg font-normal leading-relaxed md:text-xl">
                  {description}
                </p>
              </div>
            </header>

            <div className="bg-border/50 h-px" />

            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <DocsBody
                className={cn(
                  "max-w-none font-normal leading-relaxed text-foreground/90",
                  // Headings - bold, crisp, properly spaced, with subtle top border on h2
                  "[&_h1]:mt-12 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h1]:md:text-4xl",
                  "[&_h2]:mt-14 [&_h2]:mb-5 [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-border/40 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:md:text-3xl [&_h2]:leading-snug",
                  "[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:tracking-tight [&_h3]:text-foreground [&_h3]:md:text-2xl [&_h3]:leading-snug",
                  "[&_h4]:mt-8 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:text-foreground",
                  // Heading Anchors - prevent heading text or icon links from turning blue or underlined
                  "[&_h1_a]:text-foreground [&_h1_a]:no-underline [&_h1_a]:font-bold",
                  "[&_h2_a]:text-foreground [&_h2_a]:no-underline [&_h2_a]:font-bold hover:[&_h2_a]:text-foreground",
                  "[&_h3_a]:text-foreground [&_h3_a]:no-underline [&_h3_a]:font-bold hover:[&_h3_a]:text-foreground",
                  "[&_h4_a]:text-foreground [&_h4_a]:no-underline [&_h4_a]:font-bold hover:[&_h4_a]:text-foreground",
                  "[&_a.subheading-anchor]:text-muted-foreground/30 [&_a.subheading-anchor]:no-underline hover:[&_a.subheading-anchor]:text-foreground [&_a.subheading-anchor]:font-normal",
                  // Body Links - sleek, professional underline, high contrast in light & dark mode, zero electric blue!
                  "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-[4px] [&_a]:decoration-foreground/30 hover:[&_a]:decoration-foreground hover:[&_a]:text-foreground [&_a]:transition-colors",
                  // Paragraphs & Text Formatting
                  "[&_p]:my-6 [&_p]:text-base [&_p]:leading-relaxed md:[&_p]:text-lg md:[&_p]:leading-8 [&_p]:text-foreground/90",
                  "[&_strong]:font-semibold [&_strong]:text-foreground",
                  // Lists
                  "[&_ul]:my-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-6 [&_ol]:list-decimal [&_ol]:pl-6",
                  "[&_li]:my-2 [&_li]:leading-relaxed [&_li]:text-foreground/90",
                  // Blockquotes - subtle accent bar & elegant editorial styling
                  "[&_blockquote]:my-8 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/30 [&_blockquote]:bg-muted/20 [&_blockquote]:px-6 [&_blockquote]:py-3 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:text-foreground/85 [&_blockquote]:font-normal",
                  // Code & Pre
                  "[&_code]:rounded-md [&_code]:bg-muted/50 [&_code]:border [&_code]:border-border/40 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:text-foreground",
                  // Tables
                  "[&_table]:my-8 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-border/40",
                  "[&_td]:border-t [&_td]:border-border/30 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-foreground/90",
                  "[&_th]:border-b [&_th]:border-border/50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_thead]:bg-muted/40",
                )}
              >
                <MDX components={getMDXComponents()} />
              </DocsBody>
            </div>

            <PostFaq items={faq} />
          </main>

          {/* Sticky Metadata & Project Callout Sidebar */}
          <aside className="border-border/40 h-fit space-y-8 border-t pt-8 lg:sticky lg:top-24 lg:col-span-1 lg:border-t-0 lg:pt-0">
            {/* Publisher Block */}
            <div className="space-y-4">
              <div className="text-muted-foreground font-mono text-[10px] font-bold tracking-widest uppercase">
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
                  <p className="text-foreground text-sm font-bold leading-none">{author}</p>
                  <p className="text-muted-foreground mt-1 text-xs">Career &amp; hiring research</p>
                </div>
              </div>
            </div>

            <div className="bg-border/40 h-px" />

            <div className="space-y-4">
              <div className="text-muted-foreground font-mono text-[10px] font-bold tracking-widest uppercase">
                Details
              </div>

              <div className="text-muted-foreground space-y-3 text-sm font-medium">
                <div className="flex items-center gap-2.5">
                  <Calendar className="size-4 opacity-70" />
                  <span>Published {formatDate(date)}</span>
                </div>

                {updated && (
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="size-4 opacity-70" />
                    <span>Updated {formatDate(updated)}</span>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <Clock className="size-4 opacity-70" />
                  <span>{getReadingTime(page.data.info.path)}</span>
                </div>
              </div>
            </div>

            <div className="bg-border/40 h-px" />

            <div className="space-y-4">
              <div className="text-muted-foreground font-mono text-[10px] font-bold tracking-widest uppercase">
                Actions
              </div>

              <PostActions title={page.data.title} url={postUrl} path={page.data.info.path} />
            </div>

            <div className="bg-border/40 h-px" />

            <div className="border-border/60 bg-card/60 space-y-4 rounded-2xl border p-5 shadow-xs">
              <h4 className="text-foreground text-sm font-bold">VeriWorkly Platform</h4>

              <p className="text-muted-foreground text-xs leading-relaxed">
                Build a professional, ATS-friendly resume for free. 100% open-source and
                privacy-first.
              </p>

              <Link
                href={siteConfig.links.app}
                className="text-foreground hover:text-muted-foreground group inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-colors"
              >
                Launch Builder{" "}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
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
