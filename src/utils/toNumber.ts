// Convert a variety of numeric-looking strings to Number safely (returns 0 on failure)
export function toNumber(value: any): number {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    Number.isNaN(value)
  )
    return 0;

  if (typeof value === "number") return value;

  const text = String(value).trim();

  // Remove currency symbols and spaces
  const cleaned = text.replace(/[^\d.,\-]/g, "");

  // Heuristics:
  // - If string contains both '.' and ',' -> decide which is thousand and which is decimal
  // e.g. "1.234,56" -> '.' thousands, ',' decimal -> normalize to "1234.56"
  // - If it contains only ',' and there are 1-2 digits after last comma -> treat comma as decimal
  // - Otherwise remove commas (thousands) and parse
  if (cleaned.includes(".") && cleaned.includes(",")) {
    // Assume dot is thousand sep and comma is decimal -> remove dots, replace comma with dot
    return Number(cleaned.replace(/\./g, "").replace(/, /g, "."));
  }

  if (cleaned.includes(",") && !cleaned.includes(".")) {
    // If pattern like "1234,56" -> comma decimal
    const commaDecimal = /,\d{1,3}/.test(cleaned);
    if (commaDecimal) {
      return Number(cleaned.replace(/,/g, "."));
    } else {
      // ambiguous -> remove commas
      return Number(cleaned.replace(/,/g, ""));
    }
  }

  // default: remove commas and parse
  const normalized = cleaned.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}
