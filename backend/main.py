from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, List, Optional
from uuid import uuid4
import secrets
import string

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, HttpUrl


ALPHABET = string.ascii_letters + string.digits


class ClickEvent(BaseModel):
    id: str
    urlId: str
    clickedAt: datetime


class UrlRecord(BaseModel):
    id: str
    originalUrl: HttpUrl
    shortCode: str
    createdAt: datetime
    clickCount: int = 0
    lastAccessedAt: Optional[datetime] = None
    clickHistory: List[ClickEvent] = []


class CreateUrlRequest(BaseModel):
    originalUrl: HttpUrl


class UrlListItem(BaseModel):
    id: str
    originalUrl: HttpUrl
    shortCode: str
    createdAt: datetime
    clickCount: int
    lastAccessedAt: Optional[datetime] = None


class AnalyticsPoint(BaseModel):
    label: str
    clicks: int
    creations: int


class UrlAnalyticsResponse(BaseModel):
    id: str
    originalUrl: HttpUrl
    shortCode: str
    shortUrl: str
    createdAt: datetime
    clickCount: int
    lastAccessedAt: Optional[datetime] = None
    clickHistory: List[ClickEvent]
    stats: List[AnalyticsPoint]


class UrlStore:
    def __init__(self) -> None:
        self._records: Dict[str, UrlRecord] = {}
        self._code_to_id: Dict[str, str] = {}
        self._lock = Lock()
        self._seed_demo_data()

    def _generate_code(self, length: int = 6) -> str:
        while True:
            code = "".join(secrets.choice(ALPHABET) for _ in range(length))
            if code not in self._code_to_id:
                return code

    def _seed_demo_data(self) -> None:
        examples = [
            ("https://www.figma.com/community/file/bitly-dashboard-reference", 18, 46),
            ("https://tailwindcss.com/docs/installation/using-vite", 11, 30),
            ("https://fastapi.tiangolo.com/tutorial/path-params/", 6, 16),
        ]

        now = datetime.now(timezone.utc)
        for idx, (url, clicks, created_hours_ago) in enumerate(examples, start=1):
            created_at = now - timedelta(hours=created_hours_ago)
            code = self._generate_code()
            record = UrlRecord(
                id=f"seed-{idx}",
                originalUrl=url,
                shortCode=code,
                createdAt=created_at,
                clickCount=clicks,
                lastAccessedAt=now - timedelta(hours=max(1, idx * 2)),
                clickHistory=[
                    ClickEvent(
                        id=str(uuid4()),
                        urlId=f"seed-{idx}",
                        clickedAt=now - timedelta(hours=created_hours_ago - offset),
                    )
                    for offset in range(clicks)
                ],
            )
            self._records[record.id] = record
            self._code_to_id[record.shortCode] = record.id

    def create_url(self, original_url: HttpUrl) -> UrlRecord:
        with self._lock:
            record = UrlRecord(
                id=str(uuid4()),
                originalUrl=original_url,
                shortCode=self._generate_code(),
                createdAt=datetime.now(timezone.utc),
                clickCount=0,
                clickHistory=[],
            )
            self._records[record.id] = record
            self._code_to_id[record.shortCode] = record.id
            return record

    def list_urls(self) -> List[UrlRecord]:
        return sorted(
            self._records.values(),
            key=lambda item: item.createdAt,
            reverse=True,
        )

    def get_url(self, url_id: str) -> UrlRecord:
        record = self._records.get(url_id)
        if not record:
            raise HTTPException(status_code=404, detail="URL not found")
        return record

    def resolve(self, short_code: str) -> UrlRecord:
        with self._lock:
            url_id = self._code_to_id.get(short_code)
            if not url_id:
                raise HTTPException(status_code=404, detail="Short URL not found")

            record = self._records[url_id]
            click = ClickEvent(
                id=str(uuid4()),
                urlId=record.id,
                clickedAt=datetime.now(timezone.utc),
            )
            record.clickHistory.append(click)
            record.clickCount += 1
            record.lastAccessedAt = click.clickedAt
            self._records[url_id] = record
            return record

    def build_analytics(self, url_id: str, base_url: str) -> UrlAnalyticsResponse:
        record = self.get_url(url_id)
        now = datetime.now(timezone.utc)
        stats: List[AnalyticsPoint] = []

        all_records = self.list_urls()
        for days_ago in range(6, -1, -1):
            day_start = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            clicks = sum(
                1
                for click in record.clickHistory
                if day_start <= click.clickedAt < day_end
            )
            creations = sum(
                1
                for item in all_records
                if day_start <= item.createdAt < day_end
            )
            stats.append(
                AnalyticsPoint(
                    label=day_start.strftime("%a"),
                    clicks=clicks,
                    creations=creations,
                )
            )

        return UrlAnalyticsResponse(
            id=record.id,
            originalUrl=record.originalUrl,
            shortCode=record.shortCode,
            shortUrl=f"{base_url.rstrip('/')}/{record.shortCode}",
            createdAt=record.createdAt,
            clickCount=record.clickCount,
            lastAccessedAt=record.lastAccessedAt,
            clickHistory=record.clickHistory,
            stats=stats,
        )


store = UrlStore()
app = FastAPI(title="Easy URL Shortener API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/api/urls", response_model=UrlListItem, status_code=201)
def create_short_url(payload: CreateUrlRequest) -> UrlListItem:
    record = store.create_url(payload.originalUrl)
    return UrlListItem(**record.model_dump())


@app.get("/api/urls", response_model=List[UrlListItem])
def get_recent_urls() -> List[UrlListItem]:
    return [UrlListItem(**record.model_dump()) for record in store.list_urls()]


@app.get("/api/urls/{url_id}/analytics", response_model=UrlAnalyticsResponse)
def get_url_analytics(url_id: str) -> UrlAnalyticsResponse:
    return store.build_analytics(url_id, "http://localhost:8000")


@app.get("/{short_code}")
def redirect_short_url(short_code: str) -> RedirectResponse:
    record = store.resolve(short_code)
    return RedirectResponse(url=str(record.originalUrl), status_code=307)
