import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { engineSource } from "@/lib/source";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string[] }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);

    const { slug } = await params;
    const page = engineSource.getPage(slug.slice(0, -1));

    if (!page) notFound();

    const title = page.data.title ?? "VeriWorkly ATS Engine";
    const description = page.data.description;
    const showDescription = searchParams.get("showDesc") !== "false";
    const theme = searchParams.get("theme") ?? "light";

    const isDark = theme === "dark";

    const baseUrl = process.env.SITE_URL ?? "https://docs.veriworkly.com";
    const logoUrl = `${baseUrl}/veriworkly-logo.png`;

    const displayDescription =
      description || "Open-source ATS resume parser and scorer for TypeScript and JavaScript.";

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          position: "relative",
          flexDirection: "column",
          fontFamily: "sans-serif",
          justifyContent: "center",
          color: isDark ? "#ffffff" : "#171717",
          backgroundColor: isDark ? "#0a0a0a" : "#f5f4ef",
        }}
      >
        <div
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            position: "absolute",
            backgroundImage: isDark
              ? "radial-gradient(circle at top left, rgba(37, 99, 235, 0.2), transparent 40%)"
              : "radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 28%)",
          }}
        />

        <div
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            position: "absolute",
            backgroundImage: isDark
              ? "radial-gradient(circle at top right, rgba(96, 165, 250, 0.15), transparent 30%)"
              : "radial-gradient(circle at top right, rgba(96, 165, 250, 0.08), transparent 22%)",
          }}
        />

        <svg
          style={{
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            position: "absolute",
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke={isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(23, 23, 23, 0.035)"}
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div
          style={{
            display: "flex",
            padding: "80px",
            textAlign: "center",
            alignItems: "center",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              display: "flex",
              marginBottom: 48,
              padding: "6px 12px",
              alignItems: "center",
              borderRadius: "100px",
              backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.07)",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                marginRight: 10,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundImage: `url(${logoUrl})`,
              }}
            />

            <span style={{ fontWeight: 700 }}>VeriWorkly ATS Engine</span>
          </div>

          <div
            style={{
              fontSize: title.length > 40 ? 60 : 84,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.05em",
              marginBottom: showDescription ? 32 : 0,
              maxWidth: "1100px",
              display: "flex",
              backgroundImage: isDark
                ? "linear-gradient(to bottom, #ffffff, #a3a3a3)"
                : "linear-gradient(to bottom, #000000, #4b5563)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {title}
          </div>

          {showDescription && (
            <div
              style={{
                fontSize: 32,
                lineHeight: 1.4,
                fontWeight: 500,
                display: "flex",
                maxWidth: "850px",
                color: isDark ? "#a3a3a3" : "#4b5563",
              }}
            >
              {displayDescription}
            </div>
          )}
        </div>

        <div
          style={{
            bottom: 40,
            opacity: 0.5,
            fontSize: 18,
            width: "100%",
            fontWeight: 700,
            display: "flex",
            position: "absolute",
            letterSpacing: "0.2em",
            justifyContent: "center",
            textTransform: "uppercase",
          }}
        >
          docs.veriworkly.com/ats-engine
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new Response(`Error generating image`, { status: 500 });
  }
}

export function generateStaticParams() {
  return engineSource.getPages().map((page) => ({
    slug: [...page.slugs, "image.png"],
  }));
}
