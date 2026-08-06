# Manual Wiki

User-manual web app frame inspired by **Wiki.js** (modular editors, RBAC) and **Docmost** (spaces, nested sidebar, modern reader UI).

Stack: **React + Vite + Tailwind (shadcn-style)** · **Express + Node** · **PostgreSQL**

## Features in this frame

| Area | Included |
|------|----------|
| Spaces | Docmost-like content silos with private flag |
| Pages | Nested tree sidebar, Markdown / WYSIWYG / HTML editor types |
| Auth | Local JWT login (OAuth/LDAP/SAML hooks later) |
| Permissions | Roles `ADMIN` / `EDITOR` / `VIEWER` + Groups model |
| UI | Light/dark mode, clean reader + admin panel |
| Data | Seed sample manuals — replace from admin |

## Quick start

### 1. Start PostgreSQL (no Docker needed)

Docker Desktop needs CPU virtualization (VT-x/AMD-V + Hyper-V/WSL2). If you see **“Virtualization support not detected”**, skip Docker and use local PostgreSQL.

Your machine already has PostgreSQL — create the app database with the password you chose at install time:

```powershell
.\scripts\setup-local-db.ps1 -PostgresPassword "YOUR_POSTGRES_PASSWORD"
```

That creates user `wiki` / password `wiki_secret` and database `wiki` (matches `server/.env`).

**Optional Docker path** (only if virtualization works):

```bash
docker compose up -d
```

To enable virtualization later: BIOS → enable Intel VT-x / AMD-V, then Windows Features → Virtual Machine Platform + Hyper-V/WSL2. Contact IT if those settings are locked.

### 2. Install & seed

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. Run app

```bash
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:4000  

### Demo / saved accounts

Seeding restores your **saved database snapshot** from `server/prisma/seed-data.json` (users, groups, spaces, pages, settings).

After you change data in the app and want to keep it in the seeder:

```bash
npm run db:export-seed
```

Then later:

```bash
npm run db:seed
```

will wipe and restore that snapshot.

## Project layout

```
wiki/
├── client/          # React reader + admin UI
├── server/          # Express API + Prisma
├── docker-compose.yml
└── package.json     # workspace scripts
```

## Customize later

1. Sign in as admin → **Admin → Content** to edit spaces/pages  
2. **Admin → Users** to manage roles/groups  
3. Replace seed markdown with your real product manual  
4. Extend auth providers, live WYSIWYG collab, and diagram embeds as needed  

## Environment

`server/.env`:

```
DATABASE_URL=postgresql://wiki:wiki_secret@localhost:5432/wiki?schema=public
JWT_SECRET=change-me-in-production
PORT=4000
CLIENT_URL=http://localhost:5173
```
