# Zip Uploader

A minimal full-stack app: a React (Vite) single-page form that accepts one
`.zip` file up to 300MB, and an Express server that validates and stores it
on disk.

```
zip-uploader/
├── server/     Express + Multer API (stores files in server/uploads/)
└── client/     React + Vite frontend (the upload page)
```

## 1. Run the server

```bash
cd server
npm install
npm start
```

Starts on `http://localhost:4000`. Uploaded files land in `server/uploads/`,
each renamed to `<timestamp>-<random>-<originalname>.zip` to avoid collisions.
An in-memory list of uploads is exposed at `GET /api/uploads` — swap this for
a real database (Postgres, SQLite, etc.) in production, and swap local disk
storage for S3/GCS/etc. if you need durability beyond a single server.

## 2. Run the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Opens on `http://localhost:5173`. Vite proxies `/api/*` requests to the
server on port 4000 (see `client/vite.config.js`), so no CORS setup is
needed in development.

## How it works

- The client validates file extension/type and the 300MB size limit
  **before** upload, so oversized files never leave the browser.
- The file is sent via `XMLHttpRequest` (not `fetch`) specifically so the
  UI can show a real upload progress bar (`xhr.upload.onprogress`).
- The server re-validates independently with Multer's `fileFilter` and
  `limits.fileSize` — never trust client-side checks alone. An oversized
  or non-zip upload is rejected with a clear JSON error and the correct
  HTTP status (413 for too-large, 400 for wrong type).
- Files are streamed straight to disk via `multer.diskStorage` rather than
  buffered in memory, so a 300MB upload doesn't blow up server RAM.

## Taking this to production

This is intentionally minimal so you can see the whole flow. For a real
deployment you'd likely want to:

- Store an upload record (owner, filename, size, status) in a real database
  instead of the in-memory array.
- Stream large files to object storage (S3, GCS, Azure Blob) instead of
  local disk, using a signed upload URL if you want to bypass your server
  entirely for the transfer.
- Add authentication so uploads are tied to a user/session.
- Virus/malware scan uploaded archives before making them available for
  download elsewhere in the app.
- Put the server behind a reverse proxy (nginx/Caddy) with its own body
  size limit raised to match (nginx defaults to 1MB and will reject large
  uploads before they even reach Node).
