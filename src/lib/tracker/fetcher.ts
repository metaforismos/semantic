const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 myHotelTracker/0.1";

export type FetchOk = {
  ok: true;
  status: number;
  final_url: string;
  html: string;
  content_type: string | null;
  duration_ms: number;
};

export type FetchErr = {
  ok: false;
  error: string;
  status?: number;
  final_url?: string;
  duration_ms: number;
};

export async function fetchHtml(
  url: string,
  { timeoutMs = 15000 }: { timeoutMs?: number } = {}
): Promise<FetchOk | FetchErr> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": DEFAULT_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "es-CL,es;q=0.9,en;q=0.8",
      },
    });

    const ct = res.headers.get("content-type");
    if (ct && !/text\/html|application\/xhtml|application\/xml/i.test(ct)) {
      return {
        ok: false,
        error: `content_type: ${ct}`,
        status: res.status,
        final_url: res.url,
        duration_ms: Date.now() - started,
      };
    }

    const text = await res.text();
    return {
      ok: true,
      status: res.status,
      final_url: res.url,
      html: text.slice(0, 2_000_000),
      content_type: ct,
      duration_ms: Date.now() - started,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: controller.signal.aborted ? `timeout_${timeoutMs}ms` : msg,
      duration_ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
