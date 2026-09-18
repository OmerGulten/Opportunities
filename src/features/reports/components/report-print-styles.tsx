/**
 * Print rules for the public report.
 *
 * A shared report is very often saved as a PDF or printed, so the document has
 * to survive leaving the browser: chrome-only controls disappear, the tinted
 * surfaces flatten to ink on white (the reader may be in dark mode), the
 * `ring-*` shadows become real hairlines and cards stop splitting across pages.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #ffffff !important; }
  [data-report-hide-print] { display: none !important; }
  [data-report-root] {
    max-width: none !important;
    padding: 0 !important;
  }
  [data-report-root], [data-report-root] * {
    color: #18181b !important;
    background-color: transparent !important;
    border-color: #d4d4d8 !important;
    box-shadow: none !important;
  }
  [data-report-root] [data-report-muted] { color: #52525b !important; }
  [data-report-card] {
    border: 1px solid #d4d4d8 !important;
    border-radius: 8px !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  [data-report-section] {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  [data-report-accent] { border-top-width: 3px !important; }
}
`;

/** Rendered once by the report page; React hoists it into the document head. */
export function ReportPrintStyles() {
  return <style href="oos-public-report-print" precedence="high" dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />;
}
