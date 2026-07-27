<div align="center">
  <a href="https://veriworkly.com">
    <img src="apps/site/public/og/landing-page-og.png" alt="VeriWorkly Resume" style="border-radius: 12px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);" />
  </a>

  <br />
  <br />

  <h1>🚀 VeriWorkly Resume</h1>

  <p><strong>Professional, privacy-first, and open-source career document engineering platform.</strong></p>

  <p>
    <a href="https://veriworkly.com">✨ Main Application</a>
    ·
    <a href="https://docs.veriworkly.com">📖 Documentation</a>
    ·
    <a href="https://blog.veriworkly.com">📰 Official Blog</a>
    ·
    <a href="https://veriworkly.com/roadmap">🗺️ Product Roadmap</a>
  </p>

  <p>
    <img src="https://img.shields.io/github/package-json/v/VeriWorkly/veriworkly-resume?style=for-the-badge&color=blue" alt="Version">
    <img src="https://img.shields.io/github/stars/VeriWorkly/veriworkly-resume?style=for-the-badge&color=gold" alt="Stars">
    <img src="https://img.shields.io/github/license/VeriWorkly/veriworkly-resume?style=for-the-badge&color=green" alt="License" />
  </p>
</div>

---

## 🎯 Executive Summary

VeriWorkly is a **privacy-first career workspace**: a resume and cover letter builder, a public portfolio/website builder, and the AI and career tooling (ATS scoring, AI rewriting, GitHub/LinkedIn import) that connects them — all built around one shared **Master Profile** so your career facts live in one place and flow into every document and every portfolio. It challenges the surveillance-heavy, login-first SaaS resume builder model by operating on a **local-first** principle: no account is required to start.

---

## ✨ Key Capabilities

- **⚡ Real-Time Rendering**: Edit details and see your ATS-optimized resume, cover letter, or portfolio update instantly with pixel-perfect live previews.
- **🌐 Portfolio Builder**: A separate public website/portfolio product (`apps/portfolio`) — template gallery, a three-pane editor, analytics, and publishing to a shared path or your own `*.veriworkly.com` subdomain.
- **🧠 Master Profile**: One canonical career-facts record that auto-seeds new resumes, cover letters, and portfolios — editing a document never writes back to it.
- **🤖 AI & ATS Tooling**: AI-assisted rewriting (Anthropic Claude and OpenAI GPT, credit-metered, cost shown before you generate) and a deterministic + AI-layered ATS checker.
- **🔒 Local-First Storage**: Your data stays on your machine first. No mandatory account, tracking cookies, or remote server lock-in to start building.
- **📥 Universal Exports**: PDF, DOCX, HTML, Markdown, plain text, and JSON — all client-rendered via `react-pdf`, no headless-browser dependency.
- **☁️ Optional Cloud Sync**: Secure, cross-device sync for logged-in users, with per-document conflict detection.
- **🔧 API Extensibility**: A self-serve developer API with scoped keys — see [docs.veriworkly.com/api-reference](https://docs.veriworkly.com/api-reference) for what's currently documented (auth, API keys, GitHub stats, health, roadmap, and core user endpoints; broader route coverage — documents, profiles, ATS, AI, portfolios, billing — is in progress).

---

## 🎨 Premium Templates

### Resume Templates

<table width="100%">
  <tr>
    <td align="center" width="50%">
      <img src="apps/studio/public/templates/resume/precision-ats.png" alt="Precision ATS" style="border-radius: 8px; border: 1px solid #eaeaea;" width="320" />
      <br /><strong>Precision ATS</strong>
    </td>
    <td align="center" width="50%">
      <img src="apps/studio/public/templates/resume/executive-clarity.png" alt="Executive Clarity" style="border-radius: 8px; border: 1px solid #eaeaea;" width="320" />
      <br /><strong>Executive Clarity</strong>
    </td>
  </tr>
</table>

### Cover Letter Templates

<table width="100%">
  <tr>
    <td align="center" width="50%">
      <img src="apps/studio/public/templates/cover-letter/professional.png" alt="Professional" style="border-radius: 8px; border: 1px solid #eaeaea;" width="320" />
      <br /><strong>Professional</strong>
    </td>
    <td align="center" width="50%">
      <img src="apps/studio/public/templates/cover-letter/veriworkly-special.png" alt="Veriworkly Special" style="border-radius: 8px; border: 1px solid #eaeaea;" width="320" />
      <br /><strong>VeriWorkly Special</strong>
    </td>
  </tr>
</table>

---

## ⚙️ Architecture & Tech Stack

VeriWorkly uses a type-safe **monorepo** layout to ensure clean service isolation and high developer velocity.

```
veriworkly-resume/
├── apps/
│   ├── site/             # Marketing & Landing Site (Next.js)
│   ├── studio/           # Document Builder App & Workspace (Next.js)
│   ├── portfolio/        # Portfolio/Website Builder — gallery, editor, published sites (Next.js)
│   ├── server/           # Express API & Sync backend (NodeJS)
│   ├── docs-platform/    # Technical Documentation Hub (Fumadocs)
│   └── blog-platform/    # Official Product Blog (Next.js)
└── packages/
    └── ui/               # Shared UI Design System & Component Library
```

| Layer                     | Technologies Used                                 |
| :------------------------ | :------------------------------------------------ |
| **Frontend Applications** | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| **Backend API**           | Node.js, Express, TypeScript                      |
| **Data Persistence**      | PostgreSQL (Prisma ORM)                           |
| **Rendering Pipeline**    | react-pdf (Client-side high-fidelity generation)  |
| **Authentication**        | Better-Auth (Passwordless OTP)                    |
| **State Management**      | Zustand (with localStorage persistence)           |

---

## 🚀 Quick Start Guide

### Local Development Setup

To run VeriWorkly locally on your system, follow these commands:

1. **Clone the Repo & Install Dependencies**

   ```bash
   git clone https://github.com/VeriWorkly/veriworkly.git
   cd veriworkly-resume
   npm install
   ```

2. **Configure Environment Variables**

   ```bash
   cp .env.example .env
   cp apps/server/.env.example apps/server/.env
   ```

3. **Deploy Local Database migrations**

   ```bash
   npm run db:push -w @veriworkly/server
   ```

4. **Launch Dev Environment**
   ```bash
   npm run dev
   ```

### Running with Docker

Deploy the complete ecosystem (database, backend server, and frontend client) instantly via Docker Compose:

```bash
docker compose --env-file .env.docker up -d --build
```

---

## 📖 Documentation Directory

| Resource                    | Description                                          | Location                                                        |
| :-------------------------- | :--------------------------------------------------- | :-------------------------------------------------------------- |
| **Technical Documentation** | Monorepo architecture, API Reference, deployment.    | [docs.veriworkly.com](https://docs.veriworkly.com)              |
| **User Support & Guides**   | Walkthroughs for editing, building and templates.    | [User Guides Hub](https://docs.veriworkly.com/docs/user-guides) |
| **Manual Setup Guide**      | Standard local environment installation.             | [README.Local.md](README.Local.md)                              |
| **Docker Operations**       | Configuration, environment variables, orchestration. | [README.Docker.md](README.Docker.md)                            |
| **Contributing Guide**      | Repository protocols, standards, and git guidelines. | [CONTRIBUTING.md](CONTRIBUTING.md)                              |

---

## 🤝 Contributing

VeriWorkly is built on open-source principles, and we welcome community contributions!

> [!IMPORTANT]
> Before checking out a branch or creating a pull request, please review our full **[Contributing Guidelines](CONTRIBUTING.md)**.
>
> 1. 🌟 **Star the repository** to show your support.
> 2. 📋 **Claim an issue** by commenting on it and waiting to be assigned before starting work. **PRs submitted for unclaimed/unassigned issues will not be merged unless claimed. Authors have a 7-day grace period to claim them, otherwise they may be closed. Priority always goes to the contributor who officially requested the claim.**
> 3. 📝 Ensure your **PR titles** follow the standard naming convention.

### Ways to Help Out

1. **Code**: Implement new features, performance improvements, or address open issues.
2. **Design**: Build and submit new ATS-optimized resume templates.
3. **Docs**: Refine explanations, fix typos, or add code setup examples.
4. **Feedback**: File bugs or suggest future features on our product roadmap.

---

## 🔒 Security & Privacy

We take security and user data privacy very seriously:

- **Local-First Architecture**: Your resumes reside locally in your browser storage.
- **No Third-Party Tracking**: No mouse tracking, heatmaps, ad trackers, or sale of user data. We do run first-party, aggregate-only product telemetry (e.g. counts of resumes created or exports) to understand usage — never individual behavioral tracking.
- **Vulnerability Disclosure**: If you discover a security issue, please do **not** file a public GitHub issue. Email us privately at `info@veriworkly.com` with steps to reproduce. Read [SECURITY.md](SECURITY.md) for more info.

---

## 📄 License

VeriWorkly is released under the [MIT License](LICENSE).

---

<div align="center">
  <h3>Made with ❤️ by the VeriWorkly Team and our amazing community of contributors</h3>
</div>
