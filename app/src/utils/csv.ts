import type { Contact } from '../types';

function escapeCSV(value: string | undefined | null): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ContactMethodRow {
  emails: { value: string; label: string }[];
  phones: { value: string; label: string }[];
  addresses: { value: string }[];
  socials: { value: string; label: string }[];
  primaryEmail: string;
  firstEmail: string;
  firstPhone: string;
  firstAddress: string;
  firstSocial: string;
}

function extractMethods(c: Contact): ContactMethodRow {
  const emails: ContactMethodRow['emails'] = [];
  const phones: ContactMethodRow['phones'] = [];
  const addresses: ContactMethodRow['addresses'] = [];
  const socials: ContactMethodRow['socials'] = [];

  for (const m of c.contact_methods || []) {
    const label = m.label || (m.is_primary ? 'primary' : 'other');
    switch (m.type) {
      case 'email':
        emails.push({ value: m.value, label });
        break;
      case 'phone':
        phones.push({ value: m.value, label: m.label || (m.is_primary ? '' : 'other') });
        break;
      case 'address':
        addresses.push({ value: m.value });
        break;
      case 'social':
        socials.push({ value: m.value, label: m.label || 'other' });
        break;
    }
  }

  return {
    emails,
    phones,
    addresses,
    socials,
    primaryEmail: emails.find((e) => e.label === 'primary')?.value ?? '',
    firstEmail: emails[0]?.value ?? '',
    firstPhone: phones.find((p) => p.label === '')?.value ?? phones[0]?.value ?? '',
    firstAddress: addresses[0]?.value ?? '',
    firstSocial: socials[0]?.value ?? '',
  };
}

export function contactsToCSV(contacts: Contact[]): string {
  const headers = [
    'Full Name',
    'Nickname',
    'Organization',
    'Title',
    'Date of Birth',
    'Email',
    'Email (Primary)',
    'Email (Other)',
    'Phone',
    'Phone (Mobile)',
    'Phone (Work)',
    'Address',
    'Social',
    'Social (Other)',
    'Groups',
    'Factoids',
    'Notes',
  ];

  const rows = contacts.map((c) => {
    const m = extractMethods(c);
    const otherEmails = m.emails.filter((e) => e.label !== 'primary').map((e) => e.value);
    const mobilePhone = m.phones.find(
      (p) => p.label.toLowerCase() === 'mobile' || p.label.toLowerCase() === 'cell'
    )?.value ?? '';
    const workPhone = m.phones.find((p) => p.label.toLowerCase() === 'work')?.value ?? '';
    const otherSocials = m.socials.filter((s) => s.label.toLowerCase() !== 'website').map((s) => s.value);

    return [
      escapeCSV(c.full_name),
      escapeCSV(c.nickname ?? null),
      escapeCSV(c.organization ?? null),
      escapeCSV(c.title ?? null),
      escapeCSV(c.date_of_birth ?? null),
      escapeCSV(m.firstEmail),
      escapeCSV(m.primaryEmail),
      escapeCSV(otherEmails.join('; ')),
      escapeCSV(m.firstPhone),
      escapeCSV(mobilePhone),
      escapeCSV(workPhone),
      escapeCSV(m.firstAddress),
      escapeCSV(m.firstSocial),
      escapeCSV(otherSocials.join('; ')),
      escapeCSV((c.groups ?? []).join('; ')),
      escapeCSV((c.factoids ?? []).join('; ')),
      escapeCSV(c.notes ?? null),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function contactsToVCF(contacts: Contact[]): string {
  const vcardEntries = contacts.map((c) => {
    const lines: string[] = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCF(c.full_name)}`,
    ];

    if (c.nickname) lines.push(`NICKNAME:${escapeVCF(c.nickname)}`);
    if (c.organization) lines.push(`ORG:${escapeVCF(c.organization)}`);
    if (c.title) lines.push(`TITLE:${escapeVCF(c.title)}`);
    if (c.date_of_birth) lines.push(`BDAY:${escapeVCF(c.date_of_birth)}`);
    if (c.notes) lines.push(`NOTE:${escapeVCF(c.notes)}`);

    for (const cm of c.contact_methods || []) {
      switch (cm.type) {
        case 'email':
          const emailTypes: string[] = [];
          if (cm.label?.toLowerCase() === 'primary' || cm.is_primary) emailTypes.push('INTERNET');
          if (emailTypes.length === 0) emailTypes.push('INTERNET');
          lines.push(`EMAIL;TYPE=${emailTypes.join(',')}:${escapeVCF(cm.value)}`);
          break;
        case 'phone':
          let phoneType = 'HOME';
          if (cm.label) {
            const l = cm.label.toLowerCase();
            if (l === 'mobile' || l === 'cell') phoneType = 'CELL';
            else if (l === 'work' || l === 'office') phoneType = 'WORK';
          }
          lines.push(`TEL;TYPE=${phoneType}:${escapeVCF(cm.value)}`);
          break;
        case 'address':
          lines.push(`ADR;TYPE=HOME:;;${escapeVCF(cm.value)}`);
          break;
        case 'social':
          lines.push(`URL:${escapeVCF(cm.value)}`);
          break;
      }
    }

    if (c.groups && c.groups.length > 0) {
      lines.push(`CATEGORIES:${escapeVCF(c.groups.join(', '))}`);
    }

    lines.push('END:VCARD');
    return lines.join('\n');
  });

  return vcardEntries.join('\n');
}

function escapeVCF(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadVCF(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
