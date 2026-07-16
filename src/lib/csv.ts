/**
 * Generic CSV parse/serialize helpers shared by every CSV-backed content
 * module (see CsvCollectionPage). Runs entirely in the browser — these modules
 * never call the backend, since the source CSVs live in an S3 bucket we don't
 * have write access to; the user uploads, edits locally, and re-downloads.
 */
import Papa from 'papaparse';

export interface ParsedCsv {
  /** Column headers exactly as they appeared in the file, in original order. */
  headers: string[];
  /** Every row, values still as raw strings — not yet validated or typed. */
  rows: Record<string, string>[];
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/** Parse a `.csv` File into headers + raw string rows. */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new CsvParseError(result.errors.map((e) => e.message).join('; ')));
          return;
        }
        resolve({ headers: result.meta.fields ?? [], rows: result.data });
      },
      error: (err: Error) => reject(new CsvParseError(err.message)),
    });
  });
}

/** Serialize rows back to CSV text, always in the given column order. */
export function unparseCsv(headers: readonly string[], rows: Record<string, unknown>[]): string {
  const data: string[][] = rows.map((row) =>
    headers.map((h) => (row[h] == null ? '' : String(row[h]))),
  );
  return Papa.unparse({ fields: [...headers], data }, { newline: '\r\n' });
}

/** Trigger a browser download of CSV text. Purely client-side, no backend call. */
export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Compare a parsed file's headers against the expected set for a module.
 * Requires an exact match (no missing, no unexpected extra columns) — safer
 * than silently dropping columns we don't model on the next export.
 */
export function validateHeaders(
  actual: string[],
  expected: readonly string[],
): { missing: string[]; unexpected: string[] } {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((h) => !actualSet.has(h)),
    unexpected: actual.filter((h) => !expectedSet.has(h)),
  };
}
