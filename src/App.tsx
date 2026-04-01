import { useEffect, useMemo, useState } from "react";

type ClickEvent = {
  id: string;
  clickedAt: string;
};

type ShortUrlRecord = {
  id: string;
  originalUrl: string;
  shortCode: string;
  createdAt: string;
  clickCount: number;
  clickHistory: ClickEvent[];
  lastAccessedAt?: string;
};

type CreatePayload = {
  originalUrl: string;
};

const STORAGE_KEY = "easy-url-shortener-records";
const PAGE_SIZE = 5;
const DEMO_NOW = Date.now();

const demoSeed: ShortUrlRecord[] = [
  {
    id: "seed-1",
    originalUrl: "https://www.figma.com/community/file/bitly-dashboard-reference",
    shortCode: "x7Kp2Q",
    createdAt: new Date(DEMO_NOW - 1000 * 60 * 60 * 46).toISOString(),
    clickCount: 18,
    lastAccessedAt: new Date(DEMO_NOW - 1000 * 60 * 38).toISOString(),
    clickHistory: [
      40, 35, 30, 28, 24, 18, 15, 12, 10, 8, 5, 2,
    ].map((hours, index) => ({
      id: `seed-1-${index}`,
      clickedAt: new Date(DEMO_NOW - 1000 * 60 * 60 * hours).toISOString(),
    })),
  },
  {
    id: "seed-2",
    originalUrl: "https://tailwindcss.com/docs/installation/using-vite",
    shortCode: "r4Tm9L",
    createdAt: new Date(DEMO_NOW - 1000 * 60 * 60 * 30).toISOString(),
    clickCount: 11,
    lastAccessedAt: new Date(DEMO_NOW - 1000 * 60 * 60 * 3).toISOString(),
    clickHistory: [
      26, 22, 21, 19, 16, 14, 9, 6, 4, 3, 1,
    ].map((hours, index) => ({
      id: `seed-2-${index}`,
      clickedAt: new Date(DEMO_NOW - 1000 * 60 * 60 * hours).toISOString(),
    })),
  },
  {
    id: "seed-3",
    originalUrl: "https://fastapi.tiangolo.com/tutorial/path-params/",
    shortCode: "m2Qa8V",
    createdAt: new Date(DEMO_NOW - 1000 * 60 * 60 * 16).toISOString(),
    clickCount: 6,
    lastAccessedAt: new Date(DEMO_NOW - 1000 * 60 * 80).toISOString(),
    clickHistory: [10, 8, 7, 5, 4, 2].map((hours, index) => ({
      id: `seed-3-${index}`,
      clickedAt: new Date(DEMO_NOW - 1000 * 60 * 60 * hours).toISOString(),
    })),
  },
];

function isBrowser() {
  return typeof window !== "undefined";
}

function readRecords(): ShortUrlRecord[] {
  if (!isBrowser()) return demoSeed;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSeed));
      return demoSeed;
    }

    const parsed = JSON.parse(raw) as ShortUrlRecord[];
    if (!Array.isArray(parsed)) return demoSeed;
    return parsed.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return demoSeed;
  }
}

function writeRecords(records: ShortUrlRecord[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function generateShortCode(existingCodes: Set<string>) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let code = "";

  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (existingCodes.has(code));

  return code;
}

function shortDisplayUrl(code: string) {
  if (!isBrowser()) return `easy.short/${code}`;
  return `${window.location.origin}/${code}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function truncateMiddle(value: string, max = 42) {
  if (value.length <= max) return value;
  const start = value.slice(0, Math.ceil(max / 2) - 2);
  const end = value.slice(-Math.floor(max / 2) + 1);
  return `${start}…${end}`;
}

function getDailyBuckets(records: ShortUrlRecord[]) {
  const days = 7;
  const labels: string[] = [];
  const clickSeries: number[] = [];
  const createSeries: number[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    labels.push(
      new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
    );

    createSeries.push(
      records.filter((record) => {
        const createdAt = new Date(record.createdAt).getTime();
        return createdAt >= date.getTime() && createdAt < nextDate.getTime();
      }).length,
    );

    clickSeries.push(
      records.reduce((sum, record) => {
        return (
          sum +
          record.clickHistory.filter((event) => {
            const clickedAt = new Date(event.clickedAt).getTime();
            return clickedAt >= date.getTime() && clickedAt < nextDate.getTime();
          }).length
        );
      }, 0),
    );
  }

  return { labels, clickSeries, createSeries };
}

function buildLinePath(values: number[], width: number, height: number, padding = 12) {
  const maxValue = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x =
        padding + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
      const y = padding + innerHeight - (value / maxValue) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, padding = 12) {
  const linePath = buildLinePath(values, width, height, padding);
  const maxValue = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const lastX =
    padding + (values.length === 1 ? innerWidth / 2 : innerWidth);
  const baseY = padding + innerHeight;
  const firstX = padding;

  if (!linePath) return "";

  const firstPointY = padding + innerHeight - (values[0] / maxValue) * innerHeight;

  return `${linePath} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${firstX.toFixed(2)} ${baseY.toFixed(2)} L ${firstX.toFixed(2)} ${firstPointY.toFixed(2)} Z`;
}

async function createShortUrl(payload: CreatePayload): Promise<ShortUrlRecord> {
  const records = readRecords();
  const existingCodes = new Set(records.map((record) => record.shortCode));
  const now = new Date().toISOString();

  const created: ShortUrlRecord = {
    id: crypto.randomUUID(),
    originalUrl: payload.originalUrl,
    shortCode: generateShortCode(existingCodes),
    createdAt: now,
    clickCount: 0,
    clickHistory: [],
  };

  const next = [created, ...records];
  writeRecords(next);
  return created;
}

async function getUrls(): Promise<ShortUrlRecord[]> {
  return readRecords();
}

async function getAnalytics(id: string): Promise<ShortUrlRecord | null> {
  const records = readRecords();
  return records.find((record) => record.id === id) ?? null;
}

async function resolveShortCode(code: string) {
  const records = readRecords();
  const record = records.find((item) => item.shortCode === code);
  if (!record) return null;

  const clickEvent: ClickEvent = {
    id: crypto.randomUUID(),
    clickedAt: new Date().toISOString(),
  };

  const updatedRecord: ShortUrlRecord = {
    ...record,
    clickCount: record.clickCount + 1,
    lastAccessedAt: clickEvent.clickedAt,
    clickHistory: [...record.clickHistory, clickEvent],
  };

  const updatedRecords = records.map((item) =>
    item.id === updatedRecord.id ? updatedRecord : item,
  );
  writeRecords(updatedRecords);

  return updatedRecord;
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
      <div className={`mb-3 h-2 w-16 rounded-full ${accent}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        🔗
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No custom links yet</h3>
      <p className="mt-2 text-sm text-slate-500">
        Paste a long URL above to create your first shortened link and start tracking engagement.
      </p>
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState<ShortUrlRecord[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [redirectStatus, setRedirectStatus] = useState<{
    state: "idle" | "checking" | "missing";
    code?: string;
  }>({ state: "checking" });

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  );

  useEffect(() => {
    getUrls().then((data) => {
      setRecords(data);
      if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (!isBrowser()) return;

    const pathCode = window.location.pathname.replace(/^\/+/, "").trim();
    if (!pathCode) {
      setRedirectStatus({ state: "idle" });
      return;
    }

    const knownRootPaths = new Set(["index.html"]);
    if (knownRootPaths.has(pathCode)) {
      setRedirectStatus({ state: "idle" });
      return;
    }

    resolveShortCode(pathCode).then((resolved) => {
      if (!resolved) {
        setRedirectStatus({ state: "missing", code: pathCode });
        return;
      }

      window.history.replaceState({}, "", "/");
      window.location.replace(resolved.originalUrl);
    });
  }, []);

  useEffect(() => {
    if (!copiedId) return;
    const timeout = window.setTimeout(() => setCopiedId(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copiedId]);

  const stats = useMemo(() => getDailyBuckets(records), [records]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [page, records]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const totalClicks = records.reduce((sum, record) => sum + record.clickCount, 0);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const normalized = normalizeUrl(urlInput);
    if (!normalized || !isValidUrl(normalized)) {
      setFormError("Please enter a valid http or https URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createShortUrl({ originalUrl: normalized });
      const updated = await getUrls();
      setRecords(updated);
      setSelectedId(created.id);
      setUrlInput("");
      setPage(1);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy(record: ShortUrlRecord) {
    await navigator.clipboard.writeText(shortDisplayUrl(record.shortCode));
    setCopiedId(record.id);
  }

  async function handleOpen(record: ShortUrlRecord) {
    const next = await resolveShortCode(record.shortCode);
    if (!next) return;
    const updated = await getUrls();
    setRecords(updated);
    window.open(next.originalUrl, "_blank", "noopener,noreferrer");
  }

  async function handleAnalytics(recordId: string) {
    const details = await getAnalytics(recordId);
    if (!details) return;
    setSelectedId(details.id);
    const latest = await getUrls();
    setRecords(latest);
  }

  const analyticsSeries = selectedRecord
    ? getDailyBuckets([{ ...selectedRecord }])
    : { labels: [], clickSeries: [], createSeries: [] };

  const dashboardLine = buildLinePath(stats.clickSeries, 560, 240);
  const dashboardArea = buildAreaPath(stats.clickSeries, 560, 240);
  const dashboardCreateLine = buildLinePath(stats.createSeries, 560, 240);

  const analyticsMiniLine = buildLinePath(
    analyticsSeries.clickSeries.length ? analyticsSeries.clickSeries : [0],
    360,
    180,
  );
  const analyticsMiniArea = buildAreaPath(
    analyticsSeries.clickSeries.length ? analyticsSeries.clickSeries : [0],
    360,
    180,
  );

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">
              Productivity Toolkit
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Easy URL Shortener
            </h1>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            <span className="font-semibold text-slate-900">FastAPI-style API</span> simulated in-browser for demo persistence
          </div>
        </header>

        {redirectStatus.state === "missing" && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Short URL <span className="font-semibold">/{redirectStatus.code}</span> was not found.
          </div>
        )}

        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1779ff] via-[#136cf0] to-[#0f56c8] shadow-[0_28px_60px_rgba(19,108,240,0.28)]">
          <div className="grid gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div className="text-white">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-100/90">
                Smart link management
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
                Simplify your URL
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Create memorable short links, monitor engagement, and review recent performance from one lightweight dashboard.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 max-w-3xl">
                <div className="flex flex-col gap-3 rounded-[24px] bg-white/12 p-3 backdrop-blur-sm sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor="url-input">
                    Long URL
                  </label>
                  <input
                    id="url-input"
                    type="text"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    placeholder="Paste your long URL here"
                    className="h-14 flex-1 rounded-2xl border border-white/25 bg-white px-4 text-[15px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-300"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-7 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Shortening..." : "Shorten URL"}
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-blue-100">
                    Your short links are stored locally for this demo and behave like a simple Bitly-style system.
                  </p>
                  {formError && <p className="text-sm font-medium text-rose-100">{formError}</p>}
                </div>
              </form>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <MetricCard label="Links created" value={records.length} accent="bg-blue-500" />
              <MetricCard label="Total clicks" value={totalClicks} accent="bg-emerald-500" />
              <MetricCard
                label="Top short URL"
                value={records[0] ? `/${records[0].shortCode}` : "—"}
                accent="bg-violet-500"
              />
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.5fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">Recent URLs</h3>
                <p className="mt-1 text-sm text-slate-500">
                  View your latest shortened links, click counts, and analytics.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                {records.length} total records
              </div>
            </div>

            {records.length === 0 ? (
              <div className="pt-6">
                <EmptyState />
              </div>
            ) : (
              <>
                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          {[
                            "Original URL",
                            "Short URL",
                            "Actions",
                            "Created",
                            "Clicks",
                            "Analytics",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="border-b border-slate-200 px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRecords.map((record, index) => (
                          <tr
                            key={record.id}
                            className={index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                          >
                            <td className="border-b border-slate-200 px-4 py-4 align-top">
                              <div className="max-w-[270px]">
                                <a
                                  href={record.originalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="line-clamp-2 text-sm font-medium leading-6 text-slate-900 hover:text-sky-600"
                                >
                                  {truncateMiddle(record.originalUrl, 58)}
                                </a>
                              </div>
                            </td>
                            <td className="border-b border-slate-200 px-4 py-4 align-top">
                              <button
                                type="button"
                                onClick={() => handleCopy(record)}
                                className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                              >
                                {truncateMiddle(shortDisplayUrl(record.shortCode), 28)}
                              </button>
                            </td>
                            <td className="border-b border-slate-200 px-4 py-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(record)}
                                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-200 hover:text-sky-700"
                                >
                                  {copiedId === record.id ? "Copied" : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpen(record)}
                                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-950"
                                >
                                  Open
                                </button>
                              </div>
                            </td>
                            <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-600 align-top">
                              {formatDate(record.createdAt)}
                            </td>
                            <td className="border-b border-slate-200 px-4 py-4 align-top">
                              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                                {record.clickCount}
                              </span>
                            </td>
                            <td className="border-b border-slate-200 px-4 py-4 align-top">
                              <button
                                type="button"
                                onClick={() => handleAnalytics(record.id)}
                                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                              >
                                View Analytics
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, records.length)} of {records.length} URLs
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={`h-10 w-10 rounded-xl text-sm font-semibold transition ${
                          page === pageNumber
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-950">Analytics</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Detailed metrics for the selected short URL.
                  </p>
                </div>
                {selectedRecord && (
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                    /{selectedRecord.shortCode}
                  </span>
                )}
              </div>

              {selectedRecord ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Original URL
                      </p>
                      <p className="mt-2 break-all text-sm font-medium leading-6 text-slate-900">
                        {selectedRecord.originalUrl}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Created
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {formatDateTime(selectedRecord.createdAt)}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        Last accessed: {selectedRecord.lastAccessedAt ? formatDateTime(selectedRecord.lastAccessedAt) : "Not yet visited"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-500">Total clicks</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{selectedRecord.clickCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-500">Short URL</p>
                      <p className="mt-2 text-sm font-semibold text-sky-700">
                        {shortDisplayUrl(selectedRecord.shortCode)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-500">Engagement status</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedRecord.clickCount > 10 ? "High traction" : selectedRecord.clickCount > 3 ? "Growing" : "New"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-950 p-4 text-white sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                          Click trend
                        </p>
                        <h4 className="mt-2 text-lg font-semibold">Clicks over time</h4>
                      </div>
                      <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                        7-day view
                      </div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-2xl bg-white/5 p-3">
                      <svg viewBox="0 0 360 180" className="h-44 w-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="miniArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        {analyticsSeries.clickSeries.length > 0 && (
                          <>
                            <path d={analyticsMiniArea} fill="url(#miniArea)" />
                            <path
                              d={analyticsMiniLine}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </>
                        )}
                      </svg>
                      <div className="mt-2 grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
                        {analyticsSeries.labels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  Select a URL from the table to view analytics.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">Statistics</h3>
              <p className="mt-1 text-sm text-slate-500">
                Compare overall URL clicks and creations over the last seven days.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-sky-500" /> URL clicks over time
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-violet-500" /> URL creations over time
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-[26px] bg-slate-950 p-4 sm:p-6">
            <div className="overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_38%),linear-gradient(180deg,_rgba(15,23,42,0.72),_rgba(15,23,42,1))] p-4 sm:p-5">
              <svg viewBox="0 0 560 240" className="h-[280px] w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {Array.from({ length: 5 }, (_, index) => {
                  const y = 20 + index * 50;
                  return (
                    <line
                      key={y}
                      x1="12"
                      y1={y}
                      x2="548"
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                  );
                })}

                <path d={dashboardArea} fill="url(#dashboardArea)" />
                <path
                  d={dashboardLine}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d={dashboardCreateLine}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="6 8"
                />
              </svg>

              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                {stats.labels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
