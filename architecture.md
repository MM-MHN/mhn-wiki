Here’s a concise map of the **techniques** used in this MHN Wiki system.

### Architecture
- **Monorepo (npm workspaces)** — `client` + `server` in one repo  
- **SPA + API** — React frontend talks to Express REST API  
- **PostgreSQL** as the system of record (Prisma ORM)  
- **JWT auth** — Bearer token in `localStorage`, role checks on protected routes  

### Backend techniques
- **Express + TypeScript** (ESM)  
- **Prisma** schema, `db push` / seed / export snapshot  
- **RBAC** — roles `ADMIN` / `EDITOR` / `VIEWER`  
- **Groups** — membership for future space/page ACL (Wiki.js-style model)  
- **Spaces + nested pages** — Docmost/Confluence-like content silos and page tree  
- **Zod** validation on request bodies  
- **bcrypt** password hashing  
- **Multer** local image uploads → `/uploads` static files  
- **Seed-from-snapshot** — `seed-data.json` export/restore of live data  

### Frontend techniques
- **React 19 + Vite + TypeScript**  
- **React Router** for reader, login, admin  
- **Tailwind CSS v4** + shadcn-style UI primitives  
- **Brand theming** from logo colors (CSS variables, light/dark)  
- **Context** for auth + theme  
- **TipTap WYSIWYG** — rich text, paste link/image, upload, drag-drop, selectable/deletable images  
- **Markdown + raw HTML** editor modes (Wiki.js-style per-page editor type)  
- **Page preview** after create/edit  
- **Nested sidebar tree** for space navigation  

### Product / UX techniques (inspired by Wiki.js & Docmost)
| Technique | Where it shows up |
|-----------|-------------------|
| Modular editors | Markdown / WYSIWYG / HTML per page |
| Spaces | Content silos with private flag |
| Nested navigation | Parent/child page tree |
| Role + group model | Users & Groups admin CRUD |
| Clean reader UI | Space page + `PageRenderer` |
| Admin content ops | Spaces CRUD, page editor, users/groups |
| Local-first media | Upload + paste images instead of URL-only |

### Dev / ops techniques
- **Vite proxy** — `/api` and `/uploads` → API in development  
- **Docker Compose** option for Postgres (optional; local Postgres also used)  
- **Production path** — build client + run Express (serve static / reverse proxy)  

### Data model techniques
- **cuid** IDs, unique usernames, optional email  
- **Page hierarchy** via `parentId`  
- **Settings key/value** store (`siteName`, etc.)  
- **Permission tables** prepared for page/space-level ACL (frame ready to tighten)  
