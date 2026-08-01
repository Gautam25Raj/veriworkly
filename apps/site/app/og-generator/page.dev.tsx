"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@veriworkly/ui";
import { Input } from "@veriworkly/ui";
import { TextArea } from "@veriworkly/ui";
import { Card } from "@veriworkly/ui";
import {
  Download,
  Copy,
  Image as ImageIcon,
  RefreshCw,
  Type,
  AlignLeft,
  FileText,
} from "lucide-react";

export default function OGGeneratorPage() {
  const [title, setTitle] = useState("Transform Your Career with VeriWorkly");
  const [description, setDescription] = useState(
    "The most powerful open-source resume builder for modern professionals. Build, sync, and share your resume with ease.",
  );
  const [filename, setFilename] = useState("veriworkly-og");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDownloading, setIsDownloading] = useState(false);

  const params = new URLSearchParams({
    title,
    description,
    showDesc: "true",
    theme,
  });
  const previewUrl = `/api/og?${params.toString()}`;

  const downloadImage = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename || "og-image"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const copyUrl = () => {
    const fullUrl = `${window.location.origin}${previewUrl}`;
    navigator.clipboard.writeText(fullUrl);
  };

  return (
    <div className="text-foreground bg-background selection:bg-accent/30 min-h-screen overflow-x-hidden font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-accent/5 absolute top-[-10%] left-[-10%] h-[40%] w-[40%] animate-pulse rounded-full blur-[120px]" />
        <div
          className="bg-accent/5 absolute top-[20%] right-[-5%] h-[30%] w-[30%] animate-pulse rounded-full blur-[100px]"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-28 pb-20 lg:pt-36 lg:pb-32">
        <header className="border-border mb-10 flex flex-col gap-6 border-b pb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/veriworkly-logo.png"
              width={36}
              height={36}
              alt="VeriWorkly Logo"
              priority
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-['Outfit','Avenir_Next',sans-serif] text-2xl font-black tracking-[-.04em]">
                  VeriWorkly
                </span>
                <span className="bg-accent/10 border-accent/25 text-accent rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  OG Generator
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Create stunning, professional social preview images for your website. Customize the
                content and download your high-quality assets instantly.
              </p>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
          {/* Left Column: Interactive Live Preview & Actions (Sticky) */}
          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="group border-border bg-card relative aspect-1200/630 w-full overflow-hidden rounded-2xl border shadow-2xl transition-transform duration-500 hover:scale-[1.005]">
              <Image
                src={previewUrl}
                alt="OG Preview"
                width={1200}
                height={630}
                unoptimized
                className="h-full w-full object-cover transition-opacity duration-300"
              />

              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                <Button
                  variant="secondary"
                  onClick={() => window.open(previewUrl, "_blank")}
                  className="bg-background text-foreground rounded-xl font-bold shadow-lg"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>

              <div className="border-border bg-card/85 text-muted-foreground absolute right-4 bottom-4 rounded-md border px-3 py-1 font-mono text-[10px] tracking-widest uppercase backdrop-blur-md">
                1200 × 630
              </div>
            </div>

            <div className="border-border bg-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-accent/10 border-accent/20 rounded-xl border p-3">
                  <ImageIcon className="text-accent h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-foreground font-semibold">Asset Preview</h3>
                  <p className="text-muted-foreground text-sm">Real-time dynamic rendering</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="rounded-xl text-sm font-bold"
                  onClick={copyUrl}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Image Link
                </Button>

                <Button
                  onClick={downloadImage}
                  loading={isDownloading}
                  variant="primary"
                  className="rounded-xl px-6 font-bold"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Control Sidebar Panel */}
          <aside className="space-y-6">
            <Card className="border-border bg-card space-y-6 p-6 shadow-xl">
              <div className="space-y-4">
                <label className="text-muted-foreground text-sm font-medium">Theme</label>

                <div className="border-border bg-muted/20 grid grid-cols-2 gap-2 rounded-xl border p-1">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 transition-all ${
                      theme === "light"
                        ? "bg-background text-foreground border-border/50 border shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Light
                  </button>

                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 transition-all ${
                      theme === "dark"
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div>
                <label className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <Type className="h-4 w-4" />
                  Title
                </label>

                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter page title..."
                />
              </div>

              <div>
                <label className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlignLeft className="h-4 w-4" />
                  Description
                </label>

                <TextArea
                  value={description}
                  placeholder="Enter page description..."
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="border-border border-t pt-4">
                <label className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Download Filename
                </label>

                <div className="flex items-center gap-2">
                  <Input
                    value={filename}
                    placeholder="filename"
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1"
                  />

                  <span className="text-muted-foreground font-mono text-sm">.png</span>
                </div>
              </div>
            </Card>

            <div className="bg-accent/5 border-accent/10 rounded-2xl border p-5">
              <p className="text-accent/70 text-xs leading-relaxed italic">
                Tip: Keep your titles under 60 characters and descriptions under 160 characters for
                the best appearance on social platforms like Twitter and LinkedIn.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
