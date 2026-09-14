export function sanitizeCSVField(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const strValue = String(value);
  if (/[",\n\r]/.test(strValue)) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  if (/^[=+\-@\t\r]/.test(strValue)) {
    return `"'${strValue.replace(/"/g, '""')}"`;
  }
  return strValue;
}

export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field.trim());
  return fields;
}

export function isValidNumber(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

export function isValidInteger(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const num = Number(value);
  return !isNaN(num) && isFinite(num) && Number.isInteger(num);
}
