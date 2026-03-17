# mianhua.me

[English](./README.md) | [简体中文](./README.zh-CN.md)

Personal blog and content site for [mianhua.me](https://mianhua.me), built with `Next.js` and adapted for direct server-side content editing.

## Overview

This repository is no longer using the original "GitHub App + front-end commit" workflow.

It now runs as a small self-hosted CMS:

- visitors can only read
- the admin can log in from the front end
- content is saved on the server
- images are uploaded through a server-side proxy
- GitHub is used for version sync, not as the live editing backend

Live site:

- [https://mianhua.me](https://mianhua.me)
- [https://www.mianhua.me](https://www.mianhua.me)

Repository:

- [https://github.com/tangchunwu/mianhua.me](https://github.com/tangchunwu/mianhua.me)

## Features

- Online admin editing for site content
- Server-side content storage
- Blog creation, editing, and deletion
- Project / about / pictures / snippets / bloggers / share page editing
- Image host integration for new uploads
- GitHub sync for code and content history
- Domain access via `nginx + Cloudflare`
- Backup strategy for disaster recovery

## Current Architecture

```text
Browser
  -> Cloudflare
  -> Nginx
  -> Next.js app (:3000)
  -> local content files (data/, public/blogs/)
  -> image host proxy (openclaw-tu.us.ci)
```

### Runtime model

- `Next.js` serves the site
- `nginx` reverse proxies `mianhua.me` to `127.0.0.1:3000`
- content is primarily stored in:
  - `data/`
  - `public/blogs/`
- sensitive config stays in server env files
- GitHub stores the versioned snapshot of code and content

## What Changed From the Original Project

The original upstream project was designed around GitHub-based content editing.

This deployment has been changed to:

- remove GitHub private-key based editing
- add admin login and cookie auth
- save content directly to the server
- restrict editing to the admin only
- route image uploads through a server-side image host integration

## Editable Content

The admin can edit these sections directly in the browser:

- Home page settings
- About
- Projects
- Pictures
- Snippets
- Bloggers
- Share
- Blog list
- Write / edit / delete articles

## Admin Auth

Editing is protected by server-side auth.

Implemented safeguards:

- login rate limiting
- session expiration
- delete confirmation
- write page restricted to admin

## Image Uploads

New uploaded images are routed through the image host:

- `https://openclaw-tu.us.ci/`

Relevant environment variables:

```bash
IMAGE_HOST_BASE_URL=https://openclaw-tu.us.ci
IMAGE_HOST_ENABLED=true
IMAGE_HOST_AUTH_CODE=***
```

Used for:

- favicon / avatar / home art / background
- social button images
- project images
- article cover images
- article body images

Notes:

- old local images still work
- new images prefer absolute hosted URLs
- remote deletion is not implemented in the current version

## Project Structure

```text
src/
  app/                routes and API handlers
  components/         shared UI components
  lib/                auth, server config, blog IO, image host logic
  stores/             UI state stores
data/                 runtime content data
public/blogs/         blog content and related assets
```

Key server routes:

- `src/app/api/admin/login/route.ts`
- `src/app/api/admin/logout/route.ts`
- `src/app/api/admin/status/route.ts`
- `src/app/api/config/route.ts`
- `src/app/api/content/[key]/route.ts`
- `src/app/api/blog/save/route.ts`
- `src/app/api/blog/delete/route.ts`
- `src/app/api/blog/listing/route.ts`
- `src/app/api/image-host/upload/route.ts`

## Local Development

Install dependencies:

```bash
pnpm install
```

Run in development:

```bash
pnpm dev
```

Build:

```bash
pnpm exec next build --webpack
```

Start:

```bash
pnpm start
```

## Production Deployment

Current production stack:

- Ubuntu
- Node.js via `nvm`
- `pnpm`
- `Next.js` on port `3000`
- `nginx` on port `80`
- Cloudflare in front of the domain

Typical deploy sequence:

```bash
pnpm install
pnpm exec next build --webpack
pnpm start -p 3000
```

## GitHub Sync Strategy

GitHub is used as version history for the real running site state.

Tracked on purpose:

- source code
- `data/`
- `public/blogs/`

Not tracked:

- `.env.production`
- runtime logs
- temporary deployment files

This matters because it prevents the common failure mode:

> content changed on the server, but never made it into version control

## Backup Strategy

GitHub is not the backup layer by itself.

Current backup focus:

- `data/`
- `public/blogs/`
- `.env.production`

Role split:

- GitHub: version sync and history
- backups: disaster recovery

## Domain and Access

The site is connected to:

- `mianhua.me`
- `www.mianhua.me`

Current path:

- Cloudflare DNS
- `nginx` reverse proxy
- Next.js origin on the server

## Notes

This repository should now be treated as the source of truth for the current `mianhua.me` deployment, not as a pristine mirror of the original upstream project.

When updating this project, keep these rules:

- online edits save to the server first
- content changes should be synced back to GitHub
- secrets stay out of the repository
