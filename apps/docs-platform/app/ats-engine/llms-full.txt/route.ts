import { siteConfig } from "@/config/site";
import { getEnginePagesInOrder } from "@/lib/source";

export const revalidate = false;

/** Every ATS Engine docs page as Markdown, in sidebar order, for language models to read whole. */
export async function GET() {
  const sections = await Promise.all(
    getEnginePagesInOrder().map(async (page) => {
      const data = page.data as {
        title?: string;
        description?: string;
        getText: (type: "raw" | "processed") => Promise<string>;
      };
      const text = await data.getText("processed");

      return `# ${data.title ?? page.url}\n\nSource: ${siteConfig.url}${page.url}\n\n${data.description ? `${data.description}\n\n` : ""}${text}`;
    }),
  );

  return new Response(sections.join("\n\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
