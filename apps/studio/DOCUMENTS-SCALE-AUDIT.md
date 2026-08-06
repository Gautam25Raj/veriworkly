# Resume & Cover Letter — Structure / Sharing / Scale Audit

**Scope:** the resume and cover-letter document pipeline in `apps/studio` — `features/resume/`, `features/cover-letter/`, `features/documents/`, `templates/`, the `/documents` and `/editor` routes, plus the `apps/server` document API behind them.

**Question asked:** is the code properly shared and divided, is it dynamically imported, and does it hold up at 40–50 documents without killing the editor?

**Method:** static import-graph trace, a real production build (`next build`, Turbopack) to measure per-route client JS, and a benchmark against the actual zod schemas and storage code paths at 1 / 10 / 25 / 50 resumes.

**Verdict:** the *sharing* is good — genuinely better than most codebases of this shape. The *scaling* is not. Nothing crashes at 50 documents, but the document dashboard freezes for ~half a second on every save, and four routes ship ~2.2 MB of PDF/DOCX engine they never call. Both have narrow, high-leverage fixes. See [Fix order](#fix-order).

---

## 1. What is already right

This is not a "rewrite it" audit. The shared layer is real and load-bearing:

- **`features/documents/` is a true shared core.** `DocumentEditorShell` (zoom/pan/rails/mobile tabs) is used unchanged by both editors. `LocalStorageService` is generic over `BaseDocumentData`. `DocumentSyncService` is generic and instantiated per type. `SyncEngine` (outbox + telemetry) is type-agnostic and scoped by document type.
- **One registry drives both types.** `features/documents/core/registry.tsx` maps `RESUME` / `COVER_LETTER` to `{ createDefault, parse, templates, exportFormats, Editor }`, and `documentRegistry` is the single lookup. Route paths come from one `core/routes.ts`. Storage keys come from one `services/storage-keys.ts`.
- **One storage writer per type.** `getWorkspaceStorage()` (`document-workspace-service.ts:56`) memoizes a single `LocalStorageService` per document type, shared by autosave *and* the sync worker. The two-independent-writers problem in the older `AUDIT.md` is fixed.
- **Web and PDF renderers share their data layer, not just their types.** `features/documents/rendering/resume-rendering.ts` (`getResumeRenderModel`, `sectionVisible`, `getContactItems`, `normalizeLinkHref`, `hasResumeSectionContent`, …) plus `templates/resume/shared/{model,tokens,typography}.ts` and `templates/shared/{box,text-tokens,social-icons}.ts` are consumed by both `shared/web.tsx` and `shared/pdf.tsx`. The six resume templates are thin skins over that, 63–89 lines each. This is why preview/PDF parity is testable at all.
- **Cover-letter logic is properly extracted.** `templates/cover-letter/shared.ts` holds the palette, pagination, flow-item construction, and text/markdown builders; the two templates are presentation only.
- **Real contract tests exist** for template render, PDF render, geometry, text overflow, sync engine, and the workspace service, plus a preview/PDF parity harness.
- **Sync correctness fixes have landed.** `patchSync()` (`local-storage-service.ts:154`) closes the stale-snapshot data-loss race; `SyncEngine.safeParse` self-heals corrupted JSON; `sanitizeImportedResume()` resets identity on import.

Keep all of this. Everything below is about cost, not correctness of design.

---

## 2. The scaling wall (measured)

Benchmarked against the real `parseResumeCollectionInput` / `parseResumeDataInput` zod schemas, with realistically-filled resumes (5 roles × 5 highlights, 6 projects, 8 skill groups — **11.2 KB** of JSON each). Node 24, warm. A browser main thread with synchronous `localStorage` I/O on top will be the same or worse.

| Documents | Collection blob | One autosave tick | Dashboard snapshot rebuild |
| --------: | --------------: | ----------------: | -------------------------: |
|         1 |           11 KB |           0.8 ms  |                     1.5 ms |
|        10 |          112 KB |           4.5 ms  |                    30.4 ms |
|        25 |          281 KB |           9.3 ms  |                   149.8 ms |
|    **50** |      **563 KB** |      **15.0 ms**  |               **522.8 ms** |

Two separate problems produce those two columns.

### 2.1 🔴 Autosave re-reads, re-validates and re-writes *every* document on every keystroke — O(N)

`LocalStorageService.persist()` (`features/documents/services/local-storage-service.ts:173-203`) does, per call:

1. `loadCollection()` → `JSON.parse` the whole blob, then run `parseItem` (a full zod parse) over **every** document in it (`document-workspace-service.ts:30-48`).
2. `hasPayloadChanged()` → `JSON.stringify` both the previous and next item to compare.
3. `writeCollection()` → `JSON.stringify` the whole collection and write it.

It is called on a 300 ms debounce from both editors — `ResumeEditor.tsx:109` (`saveToStorage({ debounceMs: 300 })` in an effect keyed on `resume`, i.e. every keystroke) and `useCoverLetterDocument.ts:59`. So while the user types, the app parses and re-validates their other 49 resumes ~3× per second. At 50 documents that is a 15 ms main-thread block every 300 ms — visible input latency, and it grows linearly with the library.

**Fix:** one localStorage key per document (`veriworkly:docs:v2:RESUME:<id>`) plus a small index key holding only `{id, type, title, templateId, updatedAt, sync}`. A save then touches one document and one index entry — O(1), independent of library size. A one-time migration reads the existing collection blob and splits it. This single change also removes the multi-tab last-write-wins clobbering of *other* documents noted in `AUDIT.md`, because tabs editing different documents no longer share a key.

If a full-key refactor is too large right now, the cheap interim is to make `loadCollection()` cache the parsed collection keyed on the raw string, and skip `parseItem` on items whose raw JSON is byte-identical to what was already validated. That takes the 15 ms to roughly the cost of one document.

### 2.2 🔴 The document library rebuilds in O(N²) — 523 ms at 50 documents

`getDocumentLibrarySnapshot()` (`features/documents/services/document-library.ts:91-95`):

```ts
const allDocs = listDocuments()                                  // 1 full collection load per type
  .map((document) => loadDocumentById(document.type, document.id)) // + 1 full collection load per document
```

`loadDocumentById()` (`document-workspace-service.ts:126`) calls `loadCollection()` and indexes into it — so it re-parses and re-zod-validates the *entire* collection to fetch one item. With N documents that is N+1 full collection loads, i.e. N² document validations. Measured: **30 ms at 10, 150 ms at 25, 523 ms at 50.** Classic quadratic.

`listDocuments()` already returns everything the library card needs except `description` and template metadata, and `describeDocument()` only reads `basics.role` / `jobTitle` / `companyName` / `subject`. So the per-document reload buys almost nothing.

**Fix:** drop the `.map(loadDocumentById)` and build library items from the already-loaded collection in a single pass. Combined with the per-document keys from §2.1, feed the list off the index key and don't touch document bodies at all.

### 2.3 🟠 The snapshot cache key embeds the entire collection, and is rebuilt on every render

`document-library.ts:82-88` builds its cache key by concatenating the **raw JSON of every collection**:

```ts
const storageKey = [
  ...DOCUMENT_TYPES.map((type) => storage.getItem(getDocumentCollectionKey(type)) ?? ""),
  ...
].join("::");
```

This is the `getSnapshot` of a `useSyncExternalStore` (`useDocumentsWorkspace.ts:49-53`), so React calls it on every render and again on every store event. At 50 documents that allocates and compares a ~563 KB string each time (~0.6 ms plus GC pressure) purely to decide whether anything changed.

**Fix:** version the collection instead of hashing it. Bump a counter (or reuse the newest `updatedAt`) on every write and key the cache on that.

### 2.4 🟠 One-slot cache thrashes between the dashboard and the search modal

`snapshotCache` (`document-library.ts:54-58`) is a single module-level slot whose key is prefixed with `activeType`. The dashboard passes its current filter (`useDocumentsWorkspace.ts:51`), but `WorkspaceSearchModal` — mounted globally in `StudioShell.tsx:260` — always calls `getDocumentLibrarySnapshot()` with the default `"ALL"` (`WorkspaceSearchModal.tsx:44`).

When the dashboard has a type filter active, the two callers alternate between two different keys and each invalidates the other. Worse, the modal's `useMemo` deps are `[open, query]` (`WorkspaceSearchModal.tsx:62`), so **every keystroke in the search box** re-enters the snapshot — paying the full 523 ms O(N²) rebuild from §2.2 each time. Searching a 50-document library with a filter set is unusable.

**Fix:** make the cache a small `Map` keyed by `activeType`, and compute the unfiltered list once and filter downstream (the counts are already computed over all docs).

### 2.5 🟠 Every autosave fires two events the library subscribes to

`LocalStorageService.saveCollection()` dispatches `DOCUMENT_STORAGE_UPDATED_EVENT` (`local-storage-service.ts:123`) and `document-workspace-service.saveCollection()` dispatches a synthetic `new Event("storage")` (`document-workspace-service.ts:90`). `subscribeToDocumentLibrary` (`document-library.ts:63-65`) listens to both, plus the sync outbox event.

So each debounced autosave triggers ≥2 snapshot re-evaluations, and the sync worker adds more (`persist` on `"syncing"`, `patchSync` on success, plus `SyncEngine.saveOutbox` → `veriworkly:sync-outbox-updated`). Because the real `storage` event also fires cross-tab, a dashboard tab left open beside an editor tab will re-run §2.2 continuously while the user types in the other tab.

**Fix:** dispatch one event, and coalesce listeners through a microtask/rAF so a burst of writes yields one recompute.

### 2.6 🟠 `syncAllPending` is an unbounded request fan-out

`document-sync-service.ts:175-185`:

```ts
const results = await Promise.all(pending.map((item) => this.syncNow(item.id)));
```

With 50 pending documents this fires 50 concurrent `POST`/`PATCH` requests (browsers cap at ~6 per host, so the rest queue and time out under load), and each `syncNow` performs several full-collection reads and writes (`loadById`, `setLocalSyncState` → `persist`, `patchSync`) — reintroducing O(N²) storage churn *and* an event storm per §2.5. `syncAllPendingDocuments()` then runs this for both types in parallel (`document-sync.ts:88`). It is reachable from the Settings → Sync button (`SyncSection.tsx:90`).

**Fix:** a bounded work queue (4–6 concurrent) with per-item progress, and reuse one collection read across the batch.

### 2.7 🟡 The resume paginator is O(items²); the cover letter already has the O(items) version

`ResumePagedPreview.tsx:165-196` fits a section by trying every prefix length:

```ts
for (let count = 1; itemIndex + count <= items.length; count += 1) {
  const fragment = createSectionFragment(child, items.slice(itemIndex, itemIndex + count), includeHeader);
  if (fitsPage([...current, fragment])) acceptedCount = count; else break;
}
```

Each iteration deep-clones the section and calls `fitsPage`, which writes `probe.innerHTML` and reads `probe.scrollHeight` — a **forced synchronous reflow**. A 10-item Experience section costs ~10 clones and ~10 reflows; a full multi-section resume is easily 50–150 forced reflows. It re-runs whenever `children` identity changes (`ResumePagedPreview.tsx:220`), and `children` is a fresh element on every `ResumeEditor` render, which is every keystroke (`useResume()` is a whole-store subscription — `use-resume.ts:8`).

The cover letter solved this already: `paginateMeasuredItems` (`templates/cover-letter/shared.ts:271-294`) walks items once, one measurement per item, with a `keepWithNext` widow/orphan hook.

**Fix:** port `ResumePagedPreview` onto `paginateMeasuredItems` (lift it out of `cover-letter/shared.ts` into a shared paginator), and debounce the measurement effect ~150 ms. This is the single biggest typing-latency win in the editor and it *reduces* code.

### 2.8 🟢 localStorage quota is not the wall

Worth stating because it's the usual fear: 50 realistic resumes measured **563 KB**, comfortably inside the ~5 MB per-origin budget. Even 200 documents would fit. `safeSetLocalStorageItem` correctly returns `{ok:false, reason:"quota-exceeded"}` rather than throwing — but most callers still discard the result, so a quota failure is a silent lost edit (already flagged in `AUDIT.md` and still open). Surface it as a toast.

---

## 3. Dynamic imports and bundle size (measured)

You asked specifically whether things are dynamically imported. Mostly they are not, and it is expensive. From a real `next build`:

| Route | Client JS | Contains |
| --- | --: | --- |
| `/documents` | **3251 KB** | react-pdf (1776 KB) + docx (392 KB) |
| `/(dashboard)` (overview) | **3248 KB** | react-pdf + docx |
| `/ats` | **3226 KB** | react-pdf + docx |
| `/editor/[type]/[id]` | **2654 KB** | react-pdf + docx |
| `/share/[username]/[slug]` | 2568 KB | react-pdf + docx |
| `/editor/[type]/[id]/preview` | 2548 KB | react-pdf + docx |
| every other dashboard route | ~970–1050 KB | — |

The baseline is ~1 MB. The export engine adds **~2.2 MB** to six routes, two of which (`/documents`, the overview) never render a PDF at all.

### 3.1 🔴 One barrel re-export puts the entire PDF + DOCX engine on the dashboard

`features/resume/services/resume-service.ts:18`:

```ts
export * from "@/features/documents/export";
```

`features/documents/export/index.ts` re-exports `export-pdf`, `export-docx`, and `export-dispatcher`, whose module tops do `import { pdf } from "@react-pdf/renderer"` and `import { ... } from "docx"`, and which statically pull in all six resume PDF templates plus both cover-letter PDF templates and the PDF font registry.

So this import chain — `OverviewHome` → `useDocumentsWorkspace` → `deleteResumeById` — drags 2.2 MB onto the dashboard home to get **one delete function**. `@react-pdf/renderer` is not tree-shakable in practice (global `Font` registry, yoga-layout WASM shim), so the bundler cannot drop it.

**Fix, in order:**
1. Delete the `export *` from `resume-service.ts`. Have the four non-export consumers (`useDocumentsWorkspace.ts:23`, `PreviewClient.tsx:14`, `AtsWorkspace.tsx:38`, `DownloadActions.tsx:27`) import `resume-core` directly.
2. Make every export entry point lazy at the call site: `const { exportDocumentByType } = await import("@/features/documents/export/export-dispatcher")` inside the download handler. `useToolbarDownloads.ts` and `CoverLetterToolbar.tsx:22` are the only real callers. Nothing needs the PDF engine until a user clicks Download.

That should take `/documents` and the overview back to ~1 MB and drop the editor by ~2 MB until first download.

### 3.2 🟠 The template registry claims to be dynamic and isn't

`templates/index.ts:20-23` says:

> Components are imported lazily (dynamic) in the EditorLayout so this file stays server-side-safe.

Thirteen lines later it statically imports all six web templates (`templates/index.ts:31-36`), and `ResumeEditor.tsx:133` `await`s a `loadTemplateComponentById` that is fully synchronous. `templates/resume/pdf/index.ts` does the same for all six PDF templates. So loading the editor pays for six templates to render one, and any PDF template touch invalidates the chunk for every route in §3.1.

**Fix:** convert both registries to `Record<string, () => Promise<Component>>` with `next/dynamic` (or plain `import()`), keyed by template id. The metadata (`meta.ts`, `skin.ts`) stays static so the picker and catalog still work without loading render code. `ResumeEditor`'s `loadTemplateComponentById` is already `await`ed and cancellation-guarded, so the call site needs no change. Add a case to `tests/contracts/template-render.contract.test.tsx` so the four-place registration contract keeps holding.

### 3.3 🟡 Only two dynamic imports exist in the whole feature area

`registry.tsx:18-19` lazily loads the two editors — correct and worth keeping. Beyond that and one `PDFViewer` in the debug route, there are none. The DOCX path (`export/docx/*`, 392 KB) and the markdown/HTML importers (`resume-markdown-import.ts`, `markdown-import.ts`) are all eager and all user-action-triggered — every one is a candidate for `import()` at the handler.

---

## 4. Architecture and division gaps

These do not hurt today but will bite on the third document type or the next contributor.

### 4.1 🟠 Export is not part of `DocumentDefinition`, so the dispatcher hardcodes types

`DocumentDefinition` (`core/definition.ts`) declares `exportFormats: ExportFormat[]` — the *list* — but no handlers. The actual behaviour lives in `export-dispatcher.tsx`, which branches `switch (document.type)` and keeps a separate per-format switch per type. Meanwhile the resume's exporters (`export-html.ts`, `export-markdown.ts`, `export-text.ts`, `export-json.ts`, `docx/resume-docx.ts`) live *inside* the supposedly shared `features/documents/export/`, importing from `features/resume/services/resume-formatters`, while the cover letter's equivalents live in `templates/cover-letter/`. Two document types, two different homes for the same concern.

**Fix:** add `exporters: Partial<Record<ExportFormat, (doc) => Promise<void>>>` to `DocumentDefinition` and have the dispatcher be a lookup. Move resume-specific exporters under `features/resume/export/` and keep only the generic plumbing (`download.ts`, `export-file-names.ts`, `docx/docx-paragraph.ts`) in `features/documents/export/`. The `assertNever` guards are already in place, so this is mechanical.

### 4.2 🟡 The two editors use different state architectures

Resume state is a module-level Zustand singleton (`features/resume/store/resume-store.ts`, 526 lines, ~45 actions); cover-letter state is `useState` in a hook (`useCoverLetterDocument.ts`). Consequences:

- The resume store is a global singleton holding *one* document, so `resume.id` is ambient rather than a parameter. It works because only one editor mounts at a time, but nothing enforces that, and it's why `loadResume()` has to re-read the active-id key from localStorage (`resume-core.ts:44-56`).
- The cover letter has **no `useDeferredValue`** — the resume at least defers its preview (`ResumeEditor.tsx:51`). Every cover-letter keystroke re-renders the template and re-runs its measured pagination at blocking priority.
- Section-level components use narrow selectors correctly (`ExperienceSection.tsx:24`, `EditorSettingsPanel.tsx:59-67` — good), but `ResumeEditor.tsx:44` and `ResumeToolbar.tsx:39` subscribe to the whole `resume`, so both re-render on every keystroke. `ResumeToolbar` is the component that pulls in the export barrel from §3.1.

**Fix:** at minimum add `useDeferredValue` to the cover-letter preview and `React.memo` to the template components. Longer term, converge on one pattern — a `create()`-per-document store factory keyed by `documentId` would serve both and remove the ambient-singleton assumption.

### 4.3 🟠 The server sends whole document bodies for list views, and ignores the incremental-sync parameter the client sends

- `DocumentService.listDocuments` (`apps/server/src/services/documentService.ts:76-87`) has no `select`, so `content` ships for every document. At 50 resumes that is a ~600 KB response, cached in Redis for 30 minutes, and the cap is `MAX_DOCUMENTS_PER_LIST = 500` (~6 MB worst case).
- `DocumentApi.list(type, updatedSince)` (`document-api.ts:25-31`) builds an `updatedSince` query param, but `listQuerySchema` (`documentController.ts:13-15`) only parses `type` and `listDocuments()` takes no such argument. **The parameter is silently dropped** — every hydrate is a full download. The cache key (`documents:list:${userId}:${type}`) also doesn't include it, so naively wiring it up would poison the cache.

**Fix:** add a metadata-only list projection (`select` everything but `content`) for the library view, keep the full body on `GET /documents/:id`, and either implement `updatedSince` (with it in the cache key) or remove the dead client parameter. Given hydration merges by `updatedAt` already (`document-sync-service.ts:351-377`), incremental sync is a small change with a large payoff.

### 4.4 🟡 Smaller items

- `parseResumeCollectionInput` (`resume-storage-schema.ts:238`) exists and is exported but the workspace service uses its own `parseCollection` (`document-workspace-service.ts:30`). Two collection parsers for one format.
- `resumeDataInputSchema` uses zod 3's `deepPartial()`, which is deprecated and rebuilds a deep-optional schema clone; it's on the hot path measured in §2.1.
- No virtualization on the document grid/list (`workspace.tsx:147,163`). Fine at 50; revisit past ~200.
- Still open from the previous `AUDIT.md` and confirmed present: `formatDateRange` leaking `"Start - End"` placeholders into real exports (`features/documents/utils/formatters.ts`), export link hrefs not scheme-validated, quota errors not surfaced, `Sidebar.tsx` and `AdvancedThemeSettings.tsx` dead.

---

## Status: fixed

All ten items are implemented. Verification: **122 studio tests + 191 server tests pass**, both apps typecheck clean, ESLint and Prettier clean, and `next build` succeeds.

### Measured results

Same benchmark methodology as §2 (realistic 11.2 KB resumes, warm, Node):

| Documents | Autosave tick | Library snapshot rebuild |
| --------: | ------------------------: | -----------------------------: |
|        10 |  4.5 ms → **0.9 ms** |  30.4 ms → **0.1 ms** |
|        25 |  9.3 ms → **0.7 ms** | 149.8 ms → **0.3 ms** |
|    **50** | 15.0 ms → **0.8 ms** | 522.8 ms → **0.5 ms** |

Autosave is now **flat** — 0.7–0.9 ms whether the user has 10 documents or 50, because a save touches one document key plus the index instead of the whole library. The index at 50 documents is 14.9 KB, against the 563 KB collection blob it replaced.

Per-route client JS (same scan as §3):

| Route | Before | After |
| --- | --: | --: |
| `/documents` | 3251 KB (react-pdf + docx) | **1035 KB** (neither) |
| dashboard overview | 3248 KB (react-pdf + docx) | **1032 KB** (neither) |
| `/ats` | 3226 KB (react-pdf + docx) | **1009 KB** (neither) |
| `/share/[username]/[slug]` | 2568 KB (react-pdf + docx) | **< 975 KB** (neither) |

The editor route still shows the export chunks in its module graph (2659 KB by that metric) — correctly, since it is the one place that *does* export. The difference is that every path to `@react-pdf/renderer` and `docx` is now an `await import()`, so the browser fetches them when the user clicks Download rather than on page load. That is verifiable from the source: no module reachable without a dynamic import references either package.

### What changed

| # | Fix | Key files |
| - | --- | --- |
| 1 | Library snapshot built from the storage index — no per-document reload | `document-library.ts` |
| 2 | `export *` barrel deleted; exporters `import()`ed at click time | `resume-service.ts`, `useToolbarDownloads.ts`, `DownloadActions.tsx`, `export/index.ts` |
| 3 | One localStorage key per document + `veriworkly:docs:v3:index`, with lazy v2 migration | `local-storage-service.ts`, `document-index.ts`, `storage-keys.ts`, `document-workspace-service.ts` |
| 4 | `paginateIncremental` — one measurement per item, plus a 120 ms debounce | `templates/shared/pagination.ts`, `ResumePagedPreview.tsx` |
| 5 | Revision-integer cache key; cache is a `Map` per `activeType`; one storage event per write | `document-index.ts`, `document-library.ts` |
| 6 | Metadata-only list projection; `updatedSince` now honoured and in the cache key | `documentService.ts`, `documentController.ts`, `document-api.ts`, `cacheKeys.ts` |
| 7 | Registries left eager, deliberately — see below | `templates/index.ts` |
| 8 | `SYNC_CONCURRENCY = 4` work queue; pending scan reads the index | `document-sync-service.ts` |
| 9 | `useDeferredValue` on the cover-letter preview content and template | `CoverLetterEditor.tsx` |
| 10 | `DocumentDefinition.describe` + `loadExporter`; per-type exporter modules | `core/definition.ts`, `core/registry.tsx`, `export/{resume,cover-letter}-exporters.tsx` |

Ten new contract tests in `tests/contracts/document-storage-layout.contract.test.ts` lock in the properties that matter: documents live under separate keys, bodies stay out of the index, saving one document reads no other document's body, the library snapshot reads no bodies at all, the cache survives alternating filters, and the v2 migration is idempotent, retried on quota failure, and self-healing on corrupt input.

### Two deliberate deviations from the plan

**Item 7 (lazy template registries) was not done, on purpose.** Once item 2 landed, `templates/resume/pdf` became reachable only through `export-pdf`, which is already dynamically imported — so the PDF templates are behind a lazy boundary regardless. Splitting the six *web* templates would add six chunk round trips to save ~85 lines of skin code each, while `templates/resume/shared/web.tsx` (the actual weight) is needed by whichever template is selected anyway. It would also have churned eight test files. The misleading comment that claimed these imports were already dynamic is now corrected to describe what the code actually does and why.

**Item 4 shares a new paginator rather than adopting the cover letter's.** `paginateMeasuredItems` takes the whole candidate page as an array, which forces a rebuild per measurement. The new `paginateIncremental` in `templates/shared/pagination.ts` is append-only: each item is added and measured once, and a page break rewinds a single append — O(items + pages) reflows instead of O(items²). The resume now uses it. The cover letter still uses its own measured paginator; it is already O(n) and sits behind the preview/PDF parity harness, so changing it was risk without benefit. It can adopt `paginateIncremental` later.

### Still open from the earlier `AUDIT.md`

Out of scope here, unchanged, and worth a separate pass: `formatDateRange` leaking `"Start - End"` placeholders into real exports, export link `href`s not scheme-validated, quota-exceeded results still discarded by most `saveDocument` callers, and the dead `Sidebar.tsx` / `AdvancedThemeSettings.tsx`.

### Note on the build

`npm run build -w @veriworkly/studio` was already failing before this work on an unrelated JSX syntax error — a `{/* comment */}` in expression position inside a ternary branch at `components/admin/shell/AdminSidebar.tsx:153-155` (an untracked file). I moved the comment above the ternary so the build could run. Revert it if you'd rather fix it differently.
