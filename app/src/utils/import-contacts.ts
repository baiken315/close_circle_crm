import type { ImportContactMethod, ParsedContact } from '../types';

/**
 * Parse a CSV file into an array of ParsedContact objects.
 * Handles quoted fields, embedded commas/newlines, BOM, and flexible column matching.
 */
export function parseCSV(content: string): ParsedContact[] {
  // Strip BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.substring(1);
  }

  const rows = parseCSVRows(content);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => normalizeHeader(h));
  const parsed: ParsedContact[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip empty rows
    if (row.every((cell) => !cell.trim())) continue;

    const contact: ParsedContact = {
      full_name: '',
      contact_methods: [],
      groups: [],
    };

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[j]?.trim();
      if (!value) continue;

      mapCSVColumn(header, value, contact);
    }

    if (contact.full_name) {
      parsed.push(contact);
    }
  }

  return parsed;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9()]/g, '');
}

function mapCSVColumn(header: string, value: string, contact: ParsedContact) {
  if (header.match(/^fullname|^full name|^name$/) || header === 'fullname') {
    contact.full_name = value;
    return;
  }
  if (header.match(/^nickname|^preferredname|^preferred|^nick$/)) {
    contact.nickname = value;
    return;
  }
  if (header.match(/^organization|^org|^company$/)) {
    contact.organization = value;
    return;
  }
  if (header.match(/^title$/)) {
    contact.title = value;
    return;
  }
  if (header.match(/^dateofbirth|^dob|^birthday|^bday$/)) {
    contact.date_of_birth = normalizeDate(value);
    return;
  }
  if (header.match(/^note$/)) {
    contact.notes = value;
    return;
  }
  if (header.match(/^groups|^group$/)) {
    contact.groups = value.split(/[\s;]+/).map((g) => g.trim()).filter(Boolean);
    return;
  }

  // Email fields
  if (header.match(/^email/)) {
    const cm: ImportContactMethod = {
      type: 'email',
      value,
      label: 'internet',
      is_primary: header.includes('primary') || header === 'emailprimary',
    };
    contact.contact_methods.push(cm);
    return;
  }

  // Phone fields
  if (header.match(/^phone$/)) {
    const cm: ImportContactMethod = {
      type: 'phone',
      value,
      label: 'mobile',
    };
    contact.contact_methods.push(cm);
    return;
  }
  if (header.match(/^phone.*mobile|^phone.*cell|^phone.*mobile|^cell$/)) {
    const cm: ImportContactMethod = {
      type: 'phone',
      value,
      label: 'mobile',
    };
    contact.contact_methods.push(cm);
    return;
  }
  if (header.match(/^phone.*work|^phone.*office/)) {
    const cm: ImportContactMethod = {
      type: 'phone',
      value,
      label: 'work',
    };
    contact.contact_methods.push(cm);
    return;
  }

  // Address
  if (header.match(/^address$/)) {
    const cm: ImportContactMethod = {
      type: 'address',
      value,
      label: 'home',
    };
    contact.contact_methods.push(cm);
    return;
  }

  // Social
  if (header.match(/^social/)) {
    const cm: ImportContactMethod = {
      type: 'social',
      value,
      label: 'other',
    };
    contact.contact_methods.push(cm);
    return;
  }

  // URL
  if (header.match(/^url$/)) {
    const cm: ImportContactMethod = {
      type: 'social',
      value,
      label: 'website',
    };
    contact.contact_methods.push(cm);
    return;
  }
}

function normalizeDate(value: string): string | null {
  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // MM/DD/YYYY or M/D/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const parts = value.split('/');
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    const parts = value.split('-');
    // Assume DD-MM-YYYY if first part < 13 and second part is also < 13
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (day <= 12 && month > 12) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  // If it doesn't match any expected format, return null
  return null;
}

/**
 * Lightweight CSV row parser that handles quoted fields with embedded commas and newlines.
 */
function parseCSVRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 0 || rows.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === '\r') i++; // skip \r in \r\n
      } else {
        currentField += char;
      }
    }
  }

  // Last field/row
  currentRow.push(currentField);
  if (currentRow.length > 0 || rows.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}
