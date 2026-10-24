# @veriworkly/ui

Shared React components, theme tokens, and base styles for every VeriWorkly surface: the
marketing site, Studio, the blog, the docs, and the portfolio dashboard.

`DESIGN.md` at the repository root is the visual specification. This file covers how to
use the package and the guarantees each component makes.

## Setup

The package is a workspace dependency, consumed as TypeScript source (Next.js transpiles
it). In an app:

```css
/* app/globals.css */
@import "tailwindcss";

@source "../../../packages/ui/src";

@import "@veriworkly/ui/styles/themes.css";
@import "@veriworkly/ui/styles/globals.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* …the full mapping is in DESIGN.md → Tailwind mapping */
}
```

```tsx
// app/layout.tsx
import { globalFontVariables } from "@veriworkly/ui";

<html lang="en" className={globalFontVariables}>
```

`@source` is required: Tailwind only generates the classes it can see, and the components
live outside the app.

Peer dependencies: `react` and `react-dom` 19, `next` 16, `next-themes`, `lucide-react`,
and `clsx`.

## Components

| Component                                                                  | Notes                                                                                                                                                             |
| :------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                                   | `variant` primary / secondary / ghost, `size` sm / md / lg, `loading`, `asChild` (render a `Link` with button styling; its `className` and `onClick` are merged). |
| `Input`, `TextArea`, `Select`                                              | `error` sets `aria-invalid`. Text is forced to 16 px on phones so iOS does not zoom on focus. `Input` takes `inputSize`, not `size`.                              |
| `Checkbox`                                                                 | Controlled (`checked`) or uncontrolled (`defaultChecked`), `indeterminate`, optional `label`.                                                                     |
| `Switch`                                                                   | `role="switch"`. It has no visible text: name it with `aria-label` or `aria-labelledby`.                                                                          |
| `Badge`                                                                    | `variant` neutral / accent / success / warning / destructive.                                                                                                     |
| `Card`                                                                     | Polymorphic: `as="article"` for self-contained content.                                                                                                           |
| `Modal` (+ `.Content` `.Header` `.Title` `.Description` `.Body` `.Footer`) | Portaled, focus-trapped, scroll-locked. `Modal.Title` and `Modal.Description` label the dialog automatically. Pass a no-op `onClose` to make it non-dismissible.  |
| `Menu`, `MenuItem`, `MenuSeparator`                                        | APG menu button: arrow keys, Home/End, typeahead, Escape returns focus to the trigger.                                                                            |
| `Tooltip`                                                                  | Top-layer popover, linked by `aria-describedby`. A description, not a name: icon-only triggers still need `aria-label`.                                           |
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`       | `single` / `multiple`, controlled or uncontrolled, `headingLevel` per page. Collapsed answers stay searchable with find-in-page.                                  |
| `AppShell`                                                                 | The page's one `main`, with a skip link.                                                                                                                          |
| `Container`                                                                | 1280 px max width with responsive gutters. Polymorphic.                                                                                                           |
| `MarketingNavbar` and its parts                                            | `header` landmark; the open mobile panel makes the rest of the page `inert`.                                                                                      |
| `MarketingFooter`                                                          | `nav` landmarks, `h2` column headings, contact details in `<address>`.                                                                                            |
| `ThemeToggle`                                                              | Requires a `next-themes` `ThemeProvider` above it.                                                                                                                |
| `GithubIcon`, `LinkedInIcon`, `TwitterXIcon`                               | Decorative (`aria-hidden`) unless given `aria-label`.                                                                                                             |

`cn()` merges class names with `tailwind-merge`, so a consumer's `className` wins over a
component default.

## Behaviour you can rely on

- **Focus.** Every interactive element shows a solid accent ring on keyboard focus only,
  and stays visible in Windows forced-colors mode (`outline-hidden`, never `outline-none`).
- **Escape** is handled innermost-first: a Tooltip, then a Menu, then the topmost Modal,
  then the mobile nav. Each one consumes the keypress, so one press closes one layer.
- **Layers.** Menu `z-30`, navbar `z-100`, Modal `z-200`, skip link `z-300`. Tooltips use
  the browser top layer and sit above all of them. Toasts (Sonner) sit above Modals.
- **Motion** uses `transform` and `opacity` only, enters on the system's ease-out curve,
  and exits faster than it enters. The global reduced-motion rule in `globals.css` covers
  every component; components also carry `motion-reduce:` fallbacks for apps (portfolio)
  that do not import `globals.css`.
- **Server Components.** Everything without `"use client"` (`Button`, `Card`, `Input`,
  `Container`, `MarketingFooter`, …) renders on the server. `Button asChild` never adds a
  handler of its own, so it is safe around `next/link` in a Server Component.

## Development

```bash
npm run typecheck -w @veriworkly/ui
npm run test -w @veriworkly/ui
```

`tests/markup.test.tsx` checks the accessibility wiring in rendered markup.
`tests/guardrails.test.ts` fails on patterns that have broken this package before: classes
from a plugin no app installs, dead tokens, `outline-none` focus styles, raw palette
colours, `transition-all`, arbitrary z-indexes, and `target="_blank"` without `rel`. If you
change a rule, break a file and watch it fail before trusting it.

Colour tokens live in `src/styles/themes.css` and are mirrored in
`apps/site/config/brand.ts` and `DESIGN.md`. Change all three together, then run
`npm run check:design -w @veriworkly/site`.
