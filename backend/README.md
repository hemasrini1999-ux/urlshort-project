# Easy URL Shortener Backend

This folder contains a lightweight FastAPI implementation for the URL shortener.

## Endpoints

- `POST /api/urls` — create a short URL
- `GET /api/urls` — list recent URLs
- `GET /api/urls/{id}/analytics` — fetch analytics for a URL
- `GET /{shortCode}` — resolve and redirect while incrementing click count

## Run locally

Install Python dependencies:

```bash
pip install fastapi uvicorn pydantic
```

Start the server:

```bash
uvicorn main:app --reload
```

```bash
npm run dev
```

The current frontend demo uses local browser storage so it can run inside this single Vite app without additional server wiring, but the FastAPI file provides the required backend structure and endpoint behavior.
