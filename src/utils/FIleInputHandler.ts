import Papa from "papaparse";
import ExcelJS from "exceljs";

type ParsedRow = Record<string, any>;

//   Read first bytes to detect ZIP (XLSX) signature 'PK\x03\x04'
export async function readHeader(file: File, len = 4): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const blob = file.slice(0, len);
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      let s = "";
      for (const b of arr) s += String.fromCharCode(b);
      resolve(s);
    };

    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(blob);
  });
}

//   Parse CSV with PapaParse (sync-style using parse on string)
async function tryParseCsv(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const res = Papa.parse<ParsedRow>(text, {
        header: true,
        skipEmptyLines: true,
      });
      if (res.errors && res.errors.length) {
        reject(
          new Error(
            "CSV parse errors: " + JSON.stringify(res.errors.slice(0, 3))
          )
        );
      } else {
        resolve(res.data.slice(0, 10000)); // protect huge files
      }
    };
    reader.onerror = () => reject(new Error("Failed to read CSV file."));
    reader.readAsText(file);
  });
}

/**
 * Parse XLSX/XLS using ExcelJS
 * - ExcelJS works in browsers (but someties needs polyfills depending on bubdler)
 * - We read the first worksheet and convert to array of objects using the first row as headers
 */
export async function tryParseXlsx(
  file: File,
  maxRows = 10000
): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        // ExcelJS accepts ArrayBuffer in browser via workbook.xlsx.load
        await workbook.xlsx.load(arrayBuffer);

        const firstSheet = workbook.worksheets[0];
        if (!firstSheet) {
          reject(new Error("No worksheets found in workbook."));
          return;
        }

        // Use first non-empty row as header (usually row 1)
        const headerRowNumber = firstSheet.actualColumnCount > 0 ? 1 : null;
        if (!headerRowNumber) {
          reject(new Error("No header row found in workbook."));
          return;
        }

        const headerRow: any = firstSheet.getRow(headerRowNumber);
        const header = headerRow.values
          .slice(1)
          .map((h: any) =>
            h === null || h === undefined ? "" : String(h).trim()
          ); // values[0] is usually null

        const data: ParsedRow[] = [];
        // Start reading from row headerRowNUmber + 1
        for (let r = headerRowNumber + 1; r <= firstSheet.rowCount; r++) {
          const row: any = firstSheet.getRow(r);
          // Skip entirely empty rows
          if (row && row.actualCellCount === 0) continue;

          const values = row.values.slice(1); // drop first empty index
          const obj: ParsedRow = {};
          for (let i = 0; i < Headers.length; i++) {
            const key = header[i] || `column_${i + 1}`;
            obj[key] = values[i] === undefined ? null : values[i];
          }
          // Slight safeguard: skip rows that are completely null
          const hasAny = Object.values(obj).some((v) => v !== null && v !== "");
          if (hasAny) data.push(obj);
          if (data.length >= maxRows) break;
        }

        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read XLSX file."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Heuristic sniff & safe parse wrapper
 * Tries extension -> header sniff -> fallbacks
 */
export async function parseSpreadsheetFile(file: File): Promise<{
  parsed: ParsedRow[] | null;
  detectedType: "csv" | "xlsx" | null;
}> {
  // helper
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  const isCsvExt = ext === "csv" || ext === "tsv" || ext === "txt";
  const isXlsxExt = ext === "xlsx" || ext === "xls" || ext === "xlsm";

  try {
    if (isCsvExt) {
      const parsed = await tryParseCsv(file);
      return { parsed, detectedType: "csv" };
    }

    if (isXlsxExt) {
      try {
        const parsed = await tryParseXlsx(file);
        return { parsed, detectedType: "xlsx" };
      } catch (err) {
        // fallthrough to sniffing attempts
        console.warn("ExcelJS parse failed for extension-marked xlsx:", err);
      }
    }

    // Header sniff (XLSX files are zip-based -> header starts with PK\003\004)
    const header = await readHeader(file);
    if (header.startsWith("PK\u0003\u0004")) {
      try {
        const parsed = await tryParseXlsx(file);
        return { parsed, detectedType: "xlsx" };
      } catch (err) {
        console.warn("Header indicated xlsx but parse failed:", err);
      }
    }

    // Heuristic: read first chunk and try CSV parse if it looks text-like
    const snippet = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      const blob = file.slice(0, 64 * 1024);
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = (e) => reject(e);
      r.readAsText(blob);
    });
    const hasNewline = /\r?\n/.test(snippet);
    const hasComma = /,/.test(snippet);
    const hasSemicolon = /;/.test(snippet);

    if (hasNewline && (hasComma || hasSemicolon)) {
      try {
        const parsed = await tryParseCsv(file);
        return { parsed, detectedType: "csv" };
      } catch (err) {
        console.warn("CSV sniff failed:", err);
      }
    }

    // final attempt: try CSV parse (some spreadsheets are saved with .xls but are comma-separated)
    try {
      const parsed = await tryParseCsv(file);
      return { parsed, detectedType: "csv" };
    } catch (err) {
      console.error(
        "The following error was triggered when parsing the data: ",
        err
      );
      // Nothing worked
      return { parsed: null, detectedType: null };
    }
  } catch (err) {
    console.error("parseSpreadsheetFile failed:", err);
    return { parsed: null, detectedType: null };
  }
}
