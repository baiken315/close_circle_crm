import type { ParsedContact } from '../types';

/**
 * Parse a vCard 3.0/4.0 string into an array of ParsedContact objects.
 * Handles line folding (RFC 5545), multiple properties, and N;Family;Given parsing.
 */
export function parseVCF(content: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  // Normalize line endings and unfold (lines starting with space/tab are continuations)
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/(?:^|\n)[ \t]+/g, '');

  const blocks = normalized.split(/BEGIN:VCARD(?=\n)/i);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed.startsWith('BEGIN:VCARD') || !trimmed.endsWith('END:VCARD')) continue;

    const contact = parseSingleVCard(trimmed);
    if (contact) contacts.push(contact);
  }

  return contacts;
}

function parseSingleVCard(block: string): ParsedContact | null {
  const lines = block.split('\n');
  const contact: ParsedContact = {
    full_name: '',
    contact_methods: [],
  };

  let currentField = '';
  let currentValue = '';
  let currentTypes: string[] = [];

  function flushField() {
    if (!currentField) return;
    const propName = currentField.split(';')[0].toUpperCase();
    const params = currentField.split(';').slice(1);
    currentTypes = [];
    for (const param of params) {
      const eqIdx = param.indexOf('=');
      if (eqIdx > -1) {
        currentTypes.push(param.substring(0, eqIdx).toUpperCase());
      }
    }
    const typesStr = currentTypes.join(',');
    const value = currentValue.trim();

    switch (propName) {
      case 'FN':
        contact.full_name = value;
        break;
      case 'N':
        // N;Family;Given;Additional;Prefix;Suffix
        const parts = value.split(';').map((p) => p.trim());
        const family = parts[0] || '';
        const given = parts[1] || '';
        const additional = parts[2] || '';
        const prefix = parts[3] || '';
        const suffix = parts[4] || '';
        const nameParts: string[] = [];
        if (prefix) nameParts.push(prefix);
        if (given) nameParts.push(given);
        if (family) nameParts.push(family);
        if (suffix) nameParts.push(suffix);
        contact.full_name = nameParts.join(' ').trim();
        if (additional) contact.nickname = additional;
        break;
      case 'NICKNAME':
        contact.nickname = value;
        break;
      case 'ORG':
        contact.organization = value;
        break;
      case 'TITLE':
        contact.title = value;
        break;
      case 'BDAY':
        contact.date_of_birth = parseBday(value);
        break;
      case 'NOTE':
        contact.notes = value;
        break;
      case 'EMAIL':
        contact.contact_methods.push({
          type: 'email',
          value,
          is_primary: typesStr.includes('INTERNET') && !typesStr.includes('HOME'),
          label: typesStr || 'internet',
        });
        break;
      case 'TEL':
        const telType = mapPhoneType(typesStr);
        contact.contact_methods.push({
          type: 'phone',
          value,
          label: telType || undefined,
          is_primary: currentTypes.includes('PREF') || currentTypes.includes('HOME'),
        });
        break;
      case 'ADR':
        contact.contact_methods.push({
          type: 'address',
          value,
          label: typesStr.includes('HOME') ? 'home' : typesStr.includes('WORK') ? 'work' : undefined,
        });
        break;
      case 'URL':
        contact.contact_methods.push({
          type: 'social',
          value,
          label: 'website',
        });
        break;
      case 'CATEGORIES':
        contact.groups = value.split(',').map((g) => g.trim()).filter(Boolean);
        break;
    }

    currentField = '';
    currentValue = '';
    currentTypes = [];
  }

  for (const line of lines) {
    if (line === 'BEGIN:VCARD' || line === 'END:VCARD') continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const fieldPart = line.substring(0, colonIdx);
    const rest = line.substring(colonIdx + 1);

    // Check for encoded parameters (e.g., FN;TYPE=WORK: value)
    const paramMatch = fieldPart.match(/^([^:]+)(;[^:]*)?$/);
    if (paramMatch) {
      flushField();
      currentField = paramMatch[1];
      if (paramMatch[2]) currentField = paramMatch[0]; // include params
    }

    // Handle line continuation (lines starting with space)
    if (rest.startsWith(' ') || rest.startsWith('\t')) {
      currentValue += rest.substring(1);
    } else {
      if (currentValue) {
        currentValue += '\n';
      }
      currentValue = rest;
    }
  }

  flushField();

  if (!contact.full_name) return null;
  return contact;
}

function parseBday(bday: string): string | null {
  // Handle formats: YYYYMMDD, --MMDD, +YYYYYYMMDD
  if (bday.length >= 8 && /^\d{8}$/.test(bday)) {
    const year = bday.substring(0, 4);
    const month = bday.substring(4, 6);
    const day = bday.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  if (bday.startsWith('--') && bday.length === 5) {
    // --MMDD — we don't know the year, return as-is with placeholder
    return `0000${bday.substring(1)}`;
  }
  return null;
}

function mapPhoneType(typesStr: string): string | null {
  const upper = typesStr.toUpperCase();
  if (upper.includes('CELL') || upper.includes('MOBILE') || upper.includes('PAGER')) return 'mobile';
  if (upper.includes('WORK') || upper.includes('VOICE')) return 'work';
  if (upper.includes('HOME')) return 'home';
  return 'other';
}
