# Concierge Tools

Internal tools for the Concierge project — myHotel's AI-powered hotel guest assistant. This module covers onboarding validation and pilot performance reporting.

## Sub-features

### Meta Business ID Verifier (`/concierge/meta-id`)
Validates Meta Business IDs before Concierge onboarding. Distinguishes between Business ID and Facebook Page ID using a server-side Graph API proxy.

### Pilot Report Generator (`/concierge/pilot-report`)
Analyzes Concierge pilot performance from CSV exports. Generates PDF reports with metrics (interaction rate, automation rate, satisfaction, response time) and LLM-powered semantic analysis of conversations.

## Key Files

| Purpose | Path |
|---------|------|
| Meta ID page | `src/app/concierge/meta-id/page.tsx` |
| Pilot report page | `src/app/concierge/pilot-report/page.tsx` |
| Analysis API | `src/app/api/concierge/analyze/route.ts` |
| Analysis status API | `src/app/api/concierge/analyze/status/route.ts` |
| Reports API (CRUD) | `src/app/api/concierge/reports/route.ts` |
| Report by ID API | `src/app/api/concierge/reports/[id]/route.ts` |
| Meta verify API | `src/app/api/labs/meta/verify-business-id/route.ts` |
| CSV parser | `src/lib/concierge/csv-parser.ts` |
| Metrics calculator | `src/lib/concierge/metrics.ts` |
| Data aggregator | `src/lib/concierge/aggregator.ts` |
| PDF export | `src/lib/concierge/pdf-export.ts` |
| Concierge prompts | `src/lib/concierge/prompts.ts` |
| Concierge types | `src/lib/concierge/types.ts` |
| Sample CSV | `data/sample_concierge.csv` |

## UI Components (`src/components/concierge/`)

- `UploadForm` — CSV file upload with drag-and-drop
- `ReportPreview` — Interactive report viewer before export
- `ReportPDF` — PDF layout using `@react-pdf/renderer`
- `AnalysisContext` — React context for analysis state
- `BarChart`, `DonutChart`, `ProgressBar` — Chart components for metrics

## Architecture Notes

- PDF generation uses `@react-pdf/renderer` (not browser print). Components in `ReportPDF.tsx` define the PDF layout declaratively.
- CSV parsing pipeline: upload -> parse (`csv-parser.ts`) -> aggregate (`aggregator.ts`) -> compute metrics (`metrics.ts`) -> optional LLM analysis -> render/export PDF.
- The analysis API supports async processing with status polling via the `/status` endpoint.

## Reference

- `docs/PRD-Concierge-Pilot-Reporte.md` — Pilot report product requirements
- `docs/PRD-meta-business-id-verifier.md` — Meta ID verifier requirements
