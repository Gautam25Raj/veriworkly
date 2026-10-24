## 🚀 v3.30.0

This release moves to ATS Engine 0.17.0, redesigns most marketing pages, adds a template gallery, and shows who built each release on the changelog. It also fixes keyboard, screen reader and contrast problems in the shared components that every VeriWorkly app uses. Some resumes will score differently with the new engine, so read the engine notes below.

## ✨ Highlights

### ATS Engine 0.17.0

- Upgraded @veriworkly/ats-engine from 0.16.0 to 0.17.0 in the server, site, Studio and docs.
- Scores can change for the same resume. The checker now reads "Till now", "onwards" and "bis heute" as a current role, compares the right to work by country (being authorized to work in the US no longer meets a UK requirement), and counts an expired or in-progress certification as partial.
- Security clearances are read in their own part of a sentence. German "-kenntnisse" and the resume's own language now count for language requirements. "Or related field" no longer stands in for a degree.
- Hidden text in a PDF is judged more fairly: text in bordered boxes and tints is no longer flagged, while text clipped out of view or hidden under a white box is.
- A job posting from a URL is now read up to 20,000 characters, the same as a pasted one. It used to stop at 12,000. A longer posting gets a note saying it was cut.
- An AI analysis that comes back completely empty now counts as no answer and is tried again, instead of counting as a success. The AI now waits between retries, so a rate-limited analysis takes longer before it gives up.
- The scoring policy was rebuilt for 0.17.0. The server will not start with a policy the engine rejects, so deploy the rebuilt policy together with this release.

### Marketing Pages

- Every marketing page except the landing page, pricing, roadmap, style guide and brand kit has a new design. They share one layout and show the real product, with interface pieces in place of the old grid backgrounds, glowing blobs and icon cards.
- The ATS checker page now shows two plans. The "No account" plan is gone.
- The Security page no longer makes claims the code does not back up: encrypted local storage, AES-256, TLS 1.3 and a 24-hour response time.
- The Compare pages now read their prices and feature tables from one set of competitor data. The old hand-typed copy had wrong prices for Novoresume and Zety.
- The About page hides the affiliate and ambassador links while those programs are switched off.

### Changelog & Templates

- The top of the changelog now lists every contributor, not just the first ten, and links to the full contributor graph. Every release row has a fixed spot for its people, so nothing jumps around.
- Release pages keep the version, title and summary together on the left, with the type, date, counts and GitHub links in one panel on the right.
- The changelog now credits every merged pull request, with its author, to the right release. Before, most releases showed no pull requests, and the changelog credited 3 people when 12 had contributed.
- Synced release notes no longer leak horizontal rules, the Pull Requests list or the Full Changelog link into the bullets, and the intro paragraph is kept as the summary.
- The templates pages are now a gallery: three to four templates per row on desktop, two on a phone, with search, style and layout filters and a live count. Every template still appears in the page's HTML.
- A template page keeps its preview in view while the reasons, audience and sections scroll beside it.
- Fixed the name "VeriWorkly Special".

### Accessibility & Keyboard

- Dialogs now announce their title to screen readers. Focus no longer jumps out of an open dialog when the page behind it updates, dialogs open above the navbar, and Escape closes only the top one. On a phone you can swipe the dialog down to close it.
- The mobile menu no longer lets Tab reach its links while it is closed, or the page underneath while it is open. Escape closes it and puts focus back on the menu button.
- Dropdown menus work with the arrow keys, Home and End, and typing a letter jumps to the matching item. Escape closes the menu and returns focus to its button.
- Tooltips now appear above dialogs, stay open while you hover them, close with Escape and stay on screen. Screen readers read them with their button.
- FAQ answers stay in the page when closed, so Ctrl+F finds them and opens them in browsers that support it.
- Icon-only links, such as GitHub and the social icons, now have names. The first click on the theme button works for people whose system is already dark.
- Error red is a little darker in light mode and the footer text is easier to read, so both meet the 4.5:1 contrast minimum. Native scrollbars, dropdown lists and date pickers now follow dark mode.
- Buttons shrink slightly when pressed, and the keyboard focus ring is now solid blue. Menus, tooltips and dialogs animate in.

### Fixes

- Styles passed to a button made with `asChild` were silently dropped. They now apply, so about 20 buttons look the way they were designed: the call-to-action buttons on the blog and docs, the Studio login buttons, the error pages in the portfolio and the main button in the mobile menu.
- Dialogs, tooltips and checkboxes were missing their animations because of a missing plugin. They now animate.
- A checkbox ignored its starting value. It now respects it.
- Text fields use 16px text on phones, so iPhones no longer zoom in when you tap one.
- Blog posts no longer scroll sideways on a phone.
- The Studio Auto-Sync switch and the blog's share link field now have names for screen readers.

### For Developers

- The shared UI package has 41 tests that check its accessibility markup, and they run on every pull request.
- The package now lists the same versions of Next.js, React and Lucide as the apps, and declares Next.js and next-themes, which it uses.

## 🔀 Pull Requests

- **#225** - `[Fix] [UI/Site/Studio/Blog/Portfolio]: harden the shared UI package for accessibility and correctness` by @Gautam25Raj
- **#224** - `[Chore] [Server/Site/Studio/Docs]: move to @veriworkly/ats-engine 0.17.0` by @Gautam25Raj
- **#223** - `[Fix] [Site/Server]: credit every contributor and browse templates as a gallery` by @Gautam25Raj
- **#222** - `[Feature] [Site/Server]: redesign secondary marketing pages and fix synced release notes` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.29.0...Release-v3.30.0
