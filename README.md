Easy URL Shortener
A simple URL Shortener application built with:
- Frontend: React + Vite + TypeScript
- Backend: FastAPI
- UI: Clean minimal responsive interface

Project Structure
urlshort-project/
  backend/
  frontend/
 
Features
Enter a long URL and shorten it
Display shortened URLs in a table
Show original URL, short URL, and click count
Fetch all URLs from backend API
Update UI after creating a new short URL
Responsive and minimal design

 Tech Stack
 Frontend - React, TypeScript
 Backend - Python ,FastAPI 
 Setup Instructions

1. Clone the repository

```bash
git clone <your-public-repo-link>
cd urlshort-project
```

 Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on:

```text
http://127.0.0.1:8000
``

 Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

API Endpoints

Create Short URL

```http
POST /api/urls
```

Request body:

```json
{
  "originalUrl": "https://example.com"
}
```

Get All URLs

```http
GET /api/urls
```

## Build Instructions

### Frontend build

```bash
cd frontend
npm install
npm run build
```
 Backend verification

```bash
cd backend
uvicorn main:app --reload
```
Verification Steps

1. Start the FastAPI backend
2. Start the React frontend
3. Open `http://localhost:5173`
4. Enter a long URL
5. Click **Shorten URL**
6. Verify the short URL appears in the table
7. Verify click count is displayed
8. Verify data is fetched from backend API

