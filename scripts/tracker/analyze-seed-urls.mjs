#!/usr/bin/env node
// Cuenta URLs reales (no-OTA) en el CSV seed. No modifica nada.
import fs from "node:fs";

const CSV = "/Users/andresjohnson/proyectos/hotel-scraper/scraper_latam/hoteles.csv";

const OTA_DOMAINS = [
  "booking.com",
  "expedia.com",
  "expedia.cl",
  "expedia.com.ar",
  "expedia.com.br",
  "expedia.mx",
  "hotels.com",
  "tripadvisor.com",
  "tripadvisor.cl",
  "tripadvisor.com.ar",
  "tripadvisor.com.br",
  "tripadvisor.com.mx",
  "tripadvisor.es",
  "airbnb.com",
  "airbnb.cl",
  "airbnb.com.ar",
  "airbnb.com.br",
  "airbnb.com.mx",
  "vrbo.com",
  "agoda.com",
  "despegar.com",
  "despegar.com.ar",
  "despegar.cl",
  "despegar.com.mx",
  "decolar.com",
  "kayak.com",
  "trivago.com",
  "trivago.cl",
  "trivago.com.ar",
  "trivago.com.mx",
  "trivago.com.br",
  "travelocity.com",
  "priceline.com",
  "orbitz.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "pinterest.com",
  "wikipedia.org",
  "google.com",
  "maps.google.com",
  "goo.gl",
  "bing.com",
  "yandex.com",
  "yelp.com",
  "foursquare.com",
  "hoteles.com",
  "hotelscombined.com",
  "hotelbeds.com",
  "cuponatic.com",
  "groupon.com",
  "linkedin.com",
  "wa.me",
  "t.me",
];

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function* rows(path) {
  const raw = fs.readFileSync(path, "utf8");
  let buf = "";
  let inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') { if (inQ && raw[i + 1] === '"') { buf += '""'; i++; } else { inQ = !inQ; buf += c; } }
    else if (c === "\n" && !inQ) { if (buf.trim()) yield buf; buf = ""; }
    else if (c === "\r" && !inQ) {/* skip */}
    else buf += c;
  }
  if (buf.trim()) yield buf;
}

function extractHost(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isOta(host) {
  if (!host) return false;
  return OTA_DOMAINS.some((o) => host === o || host.endsWith("." + o));
}

const it = rows(CSV);
const header = parseCsvLine(it.next().value);
const urlIdx = [];
for (let i = 1; i <= 10; i++) urlIdx.push(header.indexOf(`url_${i}`));
const countryIdx = header.indexOf("pais");

const stats = {
  total: 0,
  noUrls: 0,
  otaOnly: 0,
  hasRealUrl: 0,
  byCountry: new Map(),
  byDomain: new Map(),
};

for (const row of it) {
  const f = parseCsvLine(row);
  stats.total++;
  const country = (f[countryIdx] || "").trim() || "_unknown";
  if (!stats.byCountry.has(country)) stats.byCountry.set(country, { total: 0, withRealUrl: 0 });
  stats.byCountry.get(country).total++;

  const urls = urlIdx
    .map((i) => (i >= 0 ? f[i] : ""))
    .map((s) => (s || "").trim())
    .filter(Boolean);

  if (urls.length === 0) {
    stats.noUrls++;
    continue;
  }
  const hosts = urls.map(extractHost).filter(Boolean);
  const realHost = hosts.find((h) => !isOta(h));
  if (realHost) {
    stats.hasRealUrl++;
    stats.byCountry.get(country).withRealUrl++;
    stats.byDomain.set(realHost, (stats.byDomain.get(realHost) || 0) + 1);
  } else {
    stats.otaOnly++;
  }
}

console.log("\n=== Seed CSV URL stats ===");
console.log(`Total hoteles: ${stats.total}`);
console.log(`Sin URLs: ${stats.noUrls}`);
console.log(`Solo OTAs: ${stats.otaOnly}`);
console.log(`Con URL real (candidato oficial): ${stats.hasRealUrl}`);
console.log(`Tasa analizable: ${((stats.hasRealUrl / stats.total) * 100).toFixed(1)}%\n`);

console.log("Por país (top 15 con URLs reales):");
const byCountryArr = [...stats.byCountry.entries()]
  .map(([country, v]) => ({ country, ...v }))
  .filter((x) => x.withRealUrl > 0)
  .sort((a, b) => b.withRealUrl - a.withRealUrl)
  .slice(0, 15);
console.table(byCountryArr);

console.log("Top 15 dominios más repetidos (señal de agencias/plataformas):");
const byDomainArr = [...stats.byDomain.entries()]
  .map(([d, n]) => ({ domain: d, hotels: n }))
  .sort((a, b) => b.hotels - a.hotels)
  .slice(0, 15);
console.table(byDomainArr);
