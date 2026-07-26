import type { ResumeData } from "@/types/resume";

import {
  safeText,
  escapeHtml,
  formatDateRange,
  isSectionVisible,
  getVisibleSectionMap,
  getResumeFileBaseName,
  joinTruthy,
} from "@/features/resume/services/resume-formatters";
import { normalizeLinkHref } from "@/features/documents/rendering/resume-rendering";

import { downloadBlob } from "./download";

function getComputedStyleText(style: CSSStyleDeclaration): string {
  const declarations: string[] = [];

  for (let index = 0; index < style.length; index += 1) {
    const propertyName = style.item(index);
    const propertyValue = style.getPropertyValue(propertyName);

    if (!propertyValue) {
      continue;
    }

    const priority = style.getPropertyPriority(propertyName);
    declarations.push(`${propertyName}: ${propertyValue}${priority ? ` !${priority}` : ""};`);
  }

  return declarations.join(" ");
}

function inlineComputedStyles(source: Element, clone: Element): void {
  const sourceStyle = window.getComputedStyle(source);
  const clonedElement = clone as HTMLElement;

  clonedElement.style.cssText = getComputedStyleText(sourceStyle);

  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);

  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index];
    const cloneChild = cloneChildren[index];

    if (!sourceChild || !cloneChild) {
      continue;
    }

    inlineComputedStyles(sourceChild, cloneChild);
  }
}

function buildHtml(resume: ResumeData): string {
  const visibleSections = getVisibleSectionMap(resume);

  const summary = escapeHtml(safeText(resume.summary));
  const role = escapeHtml(safeText(resume.basics.role));
  const name = escapeHtml(safeText(resume.basics.fullName) || "Your Name");

  const contact = [
    safeText(resume.basics.email),
    safeText(resume.basics.phone),
    safeText(resume.basics.location),
  ]
    .filter(Boolean)
    .map((value) => `<span>${escapeHtml(value)}</span>`)
    .join('<span class="dot">•</span>');

  const experience = isSectionVisible(visibleSections, "experience")
    ? resume.experience
        .map((item) => {
          const highlights = item.highlights
            .map((highlight) => safeText(highlight))
            .filter(Boolean)
            .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
            .join("");

          const heading = joinTruthy([item.role, item.company], " · ");
          const dateRange = formatDateRange(item.startDate, item.endDate, item.current);
          const meta = joinTruthy([dateRange, item.location], " · ");

          return `
          <article>
            ${heading ? `<h3>${escapeHtml(heading)}</h3>` : ""}
            ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
            ${safeText(item.summary) ? `<p>${escapeHtml(safeText(item.summary))}</p>` : ""}
            ${highlights ? `<ul>${highlights}</ul>` : ""}
          </article>`;
        })
        .join("")
    : "";

  const education = isSectionVisible(visibleSections, "education")
    ? resume.education
        .map((item) => {
          const degree = joinTruthy([item.degree, item.field], ", ");
          const dateRange = formatDateRange(item.startDate, item.endDate, item.current);
          const meta = joinTruthy([item.school, dateRange], " · ");

          return `
          <article>
            ${degree ? `<h3>${escapeHtml(degree)}</h3>` : ""}
            ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
            ${safeText(item.summary) ? `<p>${escapeHtml(safeText(item.summary))}</p>` : ""}
          </article>`;
        })
        .join("")
    : "";

  const projects = isSectionVisible(visibleSections, "projects")
    ? resume.projects
        .map((item) => {
          const highlights = item.highlights
            .map((highlight) => safeText(highlight))
            .filter(Boolean)
            .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
            .join("");
          const name = safeText(item.name);
          const linkHref = safeText(item.link) ? escapeHtml(normalizeLinkHref(item.link)) : "";

          return `
          <article>
            ${name || item.role ? `<h3>${escapeHtml(name)}${safeText(item.role) ? ` <span class="sub">(${escapeHtml(safeText(item.role))})</span>` : ""}</h3>` : ""}
            ${linkHref ? `<p><a href="${linkHref}">${escapeHtml(safeText(item.link))}</a></p>` : ""}
            ${safeText(item.summary) ? `<p>${escapeHtml(safeText(item.summary))}</p>` : ""}
            ${highlights ? `<ul>${highlights}</ul>` : ""}
          </article>`;
        })
        .join("")
    : "";

  const skills = isSectionVisible(visibleSections, "skills")
    ? resume.skills
        .map((group) => {
          const keywords = group.keywords
            .map((keyword) => safeText(keyword))
            .filter(Boolean)
            .join(", ");

          if (!keywords) {
            return "";
          }

          const name = safeText(group.name);
          return `<li>${name ? `<strong>${escapeHtml(name)}</strong>: ` : ""}${escapeHtml(keywords)}</li>`;
        })
        .filter(Boolean)
        .join("")
    : "";

  const links = isSectionVisible(visibleSections, "links")
    ? resume.links.items
        .map((link) => {
          const url = safeText(link.url);

          if (!url) {
            return "";
          }

          const label = escapeHtml(safeText(link.label) || safeText(link.type) || url);
          const safeUrl = escapeHtml(normalizeLinkHref(url));
          return `<li><a href="${safeUrl}">${label}</a></li>`;
        })
        .filter(Boolean)
        .join("")
    : "";

  const customSections = isSectionVisible(visibleSections, "custom")
    ? resume.customSections
        .map((section) => {
          const items = section.items
            .map((item) => {
              const details = item.details
                .map((detail) => safeText(detail))
                .filter(Boolean)
                .map((detail) => `<li>${escapeHtml(detail)}</li>`)
                .join("");
              const name = safeText(item.name);
              const meta = joinTruthy([item.issuer, item.link, item.date], " · ");

              return `
              <article>
                ${name ? `<h3>${escapeHtml(name)}</h3>` : ""}
                ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
                ${safeText(item.description) ? `<p>${escapeHtml(safeText(item.description))}</p>` : ""}
                ${details ? `<ul>${details}</ul>` : ""}
              </article>`;
            })
            .join("");

          if (!items) return "";

          const title = safeText(section.title);
          return `<section>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${items}</section>`;
        })
        .filter(Boolean)
        .join("")
    : "";

  return `<!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>${name} - Resume</title>
              <style>
                :root { color-scheme: light; }
                body { margin: 0; padding: 40px 20px; font-family: "Segoe UI", Arial, sans-serif; background: #f6f7fb; color: #111827; }
                main { max-width: 880px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; }
                h1 { margin: 0 0 8px; font-size: 2rem; line-height: 1.1; }
                h2 { margin: 32px 0 12px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; }
                h3 { margin: 0 0 6px; font-size: 1rem; }
                p { margin: 0 0 10px; line-height: 1.55; }
                article { margin-bottom: 18px; }
                ul { margin: 0 0 10px 20px; padding: 0; }
                .meta { color: #4b5563; font-size: 0.95rem; }
                .lead { font-size: 1.05rem; color: #374151; }
                .contact { color: #4b5563; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
                .dot { opacity: 0.5; }
                .sub { color: #4b5563; font-weight: 500; }
                a { color: #0f4dbf; text-decoration: none; }
                a:hover { text-decoration: underline; }
              </style>
            </head>
            <body>
              <main>
                <header>
                  <h1>${name}</h1>
                  ${role ? `<p class="lead">${role}</p>` : ""}
                  ${contact ? `<div class="contact">${contact}</div>` : ""}
                </header>
                ${isSectionVisible(visibleSections, "summary") && summary ? `<section><h2>Summary</h2><p>${summary}</p></section>` : ""}
                ${experience ? `<section><h2>Experience</h2>${experience}</section>` : ""}
                ${education ? `<section><h2>Education</h2>${education}</section>` : ""}
                ${projects ? `<section><h2>Projects</h2>${projects}</section>` : ""}
                ${skills ? `<section><h2>Skills</h2><ul>${skills}</ul></section>` : ""}
                ${links ? `<section><h2>Links</h2><ul>${links}</ul></section>` : ""}
                ${customSections}
              </main>
            </body>
            </html>`;
}

function buildRenderedHtmlDocument(targetId: string, resume: ResumeData): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const printableNode = document.getElementById(targetId);

  if (!printableNode) {
    return null;
  }

  const sourceNode = (printableNode.firstElementChild as HTMLElement | null) ?? printableNode;
  const clonedResume = sourceNode.cloneNode(true) as HTMLElement;
  const sourceRect = sourceNode.getBoundingClientRect();

  inlineComputedStyles(sourceNode, clonedResume);

  clonedResume.style.margin = "0 auto";
  clonedResume.style.width = `${Math.ceil(sourceRect.width)}px`;
  clonedResume.style.maxWidth = "100%";
  clonedResume.style.boxSizing = "border-box";

  const bodyStyle = window.getComputedStyle(document.body);

  const title = `${escapeHtml(safeText(resume.basics.fullName) || "Resume")} - Resume`;

  return `<!doctype html>
            <html lang="en" dir="${escapeHtml(document.documentElement.dir || "ltr")}">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>${title}</title>
              <style>
                :root {
                  color-scheme: light;
                }
                body {
                  margin: 0;
                  padding: 24px 16px;
                  background: ${bodyStyle.backgroundColor || "#f6f7fb"};
                  display: flex;
                  justify-content: center;
                }
              </style>
            </head>
            <body>
              ${clonedResume.outerHTML}
            </body>
            </html>`;
}

export function exportResumeAsHtml(resume: ResumeData, targetId?: string): void {
  const html = targetId ? buildRenderedHtmlDocument(targetId, resume) : buildHtml(resume);
  const outputHtml = html ?? buildHtml(resume);

  const blob = new Blob([outputHtml], { type: "text/html;charset=utf-8" });

  downloadBlob(blob, `${getResumeFileBaseName(resume)}.html`);
}
