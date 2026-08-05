import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { RelatedPost } from "@/lib/related";

type RelatedPostsProps = {
  posts: RelatedPost[];
};

/**
 * Closes the internal-linking loop for topical clusters. Rendered as a real `nav`
 * landmark with an accessible name so it is skippable by screen-reader users rather
 * than read as another block of body content.
 */
export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <nav aria-labelledby="related-posts-heading" className="mt-16 space-y-6">
      <h2
        id="related-posts-heading"
        className="text-foreground text-2xl font-bold tracking-tight md:text-3xl"
      >
        Related reading
      </h2>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.url}>
            <Link
              href={post.url}
              className="group border-border/60 bg-card/40 hover:border-border hover:bg-card/70 focus-visible:ring-foreground/40 flex h-full flex-col gap-2 rounded-2xl border p-5 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-muted-foreground font-mono text-[10px] font-bold tracking-widest uppercase">
                {post.category}
              </span>

              <span className="text-foreground text-base leading-snug font-bold">{post.title}</span>

              <span className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                {post.description}
              </span>

              <span className="text-foreground mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-bold tracking-widest uppercase">
                Read
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
