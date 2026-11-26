import { createHash, timingSafeEqual } from "node:crypto";

type RecordData = Record<string, unknown>;

function asRecord(value: unknown): RecordData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Unexpected provider response");
  }
  return value as RecordData;
}

function rows(data: unknown, field: string): RecordData[] {
  const value = asRecord(data)[field];
  if (!Array.isArray(value)) throw new Error("Missing result list");
  return value.map(asRecord);
}

function names(entries: RecordData[], field: string) {
  return entries.flatMap((entry) => {
    const name = entry[field];
    return typeof name === "string" && name.trim() ? [name] : [];
  });
}

function matchesToken(header: string | null, token: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${token}`));
}

export async function POST(request: Request) {
  const token = process.env.PROVIDER_CHECK_TOKEN;
  const respond = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

  if (!token || token.length < 32) return respond({ error: "Checks disabled" }, 404);
  if (!matchesToken(request.headers.get("authorization"), token)) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const provider = new URL(request.url).searchParams.get("provider");
  const checks: {
    step: string;
    upstreamStatus: number | null;
    elapsedMs: number;
    resultCount: number | null;
  }[] = [];

  async function check<T>(
    step: string,
    url: URL,
    parse: (data: unknown) => T[],
    headers?: HeadersInit,
  ) {
    const started = performance.now();
    const report = { step, upstreamStatus: null as number | null, elapsedMs: 0, resultCount: null as number | null };
    try {
      const response = await fetch(url, {
        headers,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      report.upstreamStatus = response.status;
      if (!response.ok) throw new Error("Upstream request failed");
      const results = parse(await response.json());
      report.resultCount = results.length;
      return results;
    } finally {
      report.elapsedMs = Math.round(performance.now() - started);
      checks.push(report);
    }
  }

  function verified(examples: string[]) {
    return respond({ ok: examples.length > 0, checks, examples: examples.slice(0, 3) });
  }

  try {
    switch (provider) {
      case "tmdb": {
        const key = process.env.TMDB_READ_TOKEN;
        if (!key) return respond({ error: "Missing TMDB_READ_TOKEN" }, 503);
        const url = new URL("https://api.themoviedb.org/3/search/movie");
        url.searchParams.set("query", "Arrival");
        return verified(await check("movie search", url, (data) => names(rows(data, "results"), "title"), {
          Authorization: `Bearer ${key}`,
        }));
      }
      case "musicbrainz": {
        const agent = process.env.MUSICBRAINZ_USER_AGENT;
        if (!agent || agent.includes("maintainer@example.com")) {
          return respond({ error: "Set MUSICBRAINZ_USER_AGENT with a maintainer contact" }, 503);
        }
        const url = new URL("https://musicbrainz.org/ws/2/recording");
        url.search = new URLSearchParams({ query: 'recording:"Hey Jude"', fmt: "json", limit: "5" }).toString();
        return verified(await check("recording search", url, (data) => names(rows(data, "recordings"), "title"), {
          "User-Agent": agent,
        }));
      }
      case "geoapify": {
        const key = process.env.GEOAPIFY_API_KEY;
        if (!key) return respond({ error: "Missing GEOAPIFY_API_KEY" }, 503);
        const geocode = new URL("https://api.geoapify.com/v1/geocode/search");
        geocode.search = new URLSearchParams({
          postcode: "30303", type: "postcode", filter: "countrycode:us",
          limit: "1", format: "json", apiKey: key,
        }).toString();
        const [location] = await check("ZIP geocoding", geocode, (data) => rows(data, "results"));
        if (!location) return verified([]);

        const { lon, lat } = location;
        if (typeof lon !== "number" || typeof lat !== "number" ||
            !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
          return respond({ error: "Invalid geocoding coordinates", checks }, 502);
        }
        const places = new URL("https://api.geoapify.com/v2/places");
        places.search = new URLSearchParams({
          categories: "catering.restaurant",
          filter: `circle:${lon},${lat},5000`,
          bias: `proximity:${lon},${lat}`,
          limit: "20",
          apiKey: key,
        }).toString();
        return verified(await check("nearby restaurants", places, (data) =>
          names(rows(data, "features").map((feature) => asRecord(feature.properties)), "name"),
        ));
      }
      default:
        return respond({ error: "Choose tmdb, geoapify, or musicbrainz" }, 400);
    }
  } catch {
    return respond({ error: "Provider request failed or returned unexpected data", checks }, 502);
  }
}
