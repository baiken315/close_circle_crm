import { useState, useRef, useCallback } from 'react';
import { Modal } from './Modal';
import { parseCSV } from '../utils/import-contacts';
import { parseVCF } from '../utils/vcf';
import { api } from '../lib/api';
import type { ParsedContact } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportState = 'idle' | 'preview' | 'importing' | 'complete';

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [format, setFormat] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [defaultPrivate, setDefaultPrivate] = useState(false);
  const [results, setResults] = useState<{ created: number; skipped: number; failed: number }>({
    created: 0,
    skipped: 0,
    failed: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const detectFormat = useCallback((fileName: string, content: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.vcf') || lower.endsWith('.vcard')) return 'vcf';
    if (lower.endsWith('.csv')) return 'csv';
    if (/BEGIN:VCARD/i.test(content)) return 'vcf';
    return 'csv';
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setFile(file);
    const content = await file.text();
    const detectedFormat = detectFormat(file.name, content);
    setFormat(detectedFormat);

    let parsed: ParsedContact[];
    if (detectedFormat === 'vcf') {
      parsed = parseVCF(content);
    } else {
      parsed = parseCSV(content);
    }

    setContacts(parsed);
    setState('preview');
  }, [detectFormat]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) parseFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) parseFile(dropped);
  };

  const handleImport = async () => {
    setState('importing');
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const parsed of contacts) {
      try {
        if (skipDuplicates) {
          const existing: any[] = await api.get(
            `/api/contacts?search=${encodeURIComponent(parsed.full_name)}`
          );
          const email = parsed.contact_methods.find((m) => m.type === 'email')?.value;
          const isDuplicate = existing.some((c: any) => {
            if (c.full_name.toLowerCase() !== parsed.full_name.toLowerCase()) return false;
            if (email) {
              const existingEmails = c.contact_methods?.filter((m: any) => m.type === 'email');
              if (existingEmails.some((m: any) => m.value === email)) return true;
            }
            return true;
          });

          if (isDuplicate) {
            skipped++;
            continue;
          }
        }

        await api.post('/api/contacts', {
          full_name: parsed.full_name,
          nickname: parsed.nickname ?? null,
          organization: parsed.organization ?? null,
          title: parsed.title ?? null,
          date_of_birth: parsed.date_of_birth ?? null,
          notes: parsed.notes ?? null,
          is_private: defaultPrivate,
          groups: parsed.groups ?? [],
          contact_methods: parsed.contact_methods,
        });
        created++;
      } catch {
        failed++;
      }
    }

    setResults({ created, skipped, failed });
    setState('complete');
  };

  const handleModalClose = () => {
    setState('idle');
    setFile(null);
    setContacts([]);
    setFormat('');
    setResults({ created: 0, skipped: 0, failed: 0 });
    onClose();
  };

  const matchedFields = contacts.length > 0
    ? contacts.reduce((acc, c) => {
        if (c.full_name) acc.full_name = true;
        if (c.nickname) acc.nickname = true;
        if (c.organization) acc.organization = true;
        if (c.title) acc.title = true;
        if (c.date_of_birth) acc.date_of_birth = true;
        if (c.notes) acc.notes = true;
        if (c.groups && c.groups.length > 0) acc.groups = true;
        if (c.contact_methods.length > 0) acc.methods = true;
        return acc;
      }, { full_name: false, nickname: false, organization: false, title: false, date_of_birth: false, notes: false, groups: false, methods: false as boolean })
    : null;

  const fieldCount = matchedFields ? Object.values(matchedFields).filter(Boolean).length : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Import Contacts" size="lg">
      <div className="space-y-6">
        {/* Idle state: file picker */}
        {state === 'idle' && (
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging
                  ? 'border-accent bg-accent/10'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
            >
              <svg className="w-10 h-10 mx-auto mb-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-slate-300 mb-1">Drag and drop your file here</p>
              <p className="text-xs text-slate-500 mb-4">Supports CSV and vCard (.vcf) files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.vcf,.vcard"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-accent hover:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Choose File
              </button>
            </div>
          </div>
        )}

        {/* Preview state */}
        {state === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">
                  {contacts.length} contact{contacts.length !== 1 ? 's' : ''} detected
                  {format && ` (${format.toUpperCase()})`}
                  {matchedFields && fieldCount > 0 && `, ${fieldCount} fields matched`}
                </p>
                {file && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              <button
                onClick={() => setState('idle')}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Change file
              </button>
            </div>

            {/* Preview table */}
            {contacts.length > 0 ? (
              <div className="max-h-64 overflow-y-auto bg-slate-900/50 rounded-lg border border-slate-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Phone</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Groups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 20).map((c, i) => (
                      <tr key={i} className="border-t border-slate-700/30">
                        <td className="px-3 py-2 text-slate-200 font-medium">{c.full_name}</td>
                        <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">
                          {c.contact_methods.find((m) => m.type === 'email')?.value ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-400 hidden md:table-cell">
                          {c.contact_methods.find((m) => m.type === 'phone')?.value ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-400 hidden lg:table-cell">
                          {c.groups?.join('; ') ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contacts.length > 20 && (
                  <p className="text-xs text-slate-500 text-center px-3 py-2">
                    Showing first 20 of {contacts.length} contacts
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No contacts found in file</p>
                <p className="text-xs text-slate-500 mt-1">Make sure the file format is correct</p>
              </div>
            )}

            {/* Options */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-accent focus:ring-accent/50"
                />
                <span className="text-sm text-slate-300">Skip duplicates</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultPrivate}
                  onChange={(e) => setDefaultPrivate(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-accent focus:ring-accent/50"
                />
                <span className="text-sm text-slate-300">Create as private</span>
              </label>
            </div>

            <button
              onClick={handleImport}
              disabled={contacts.length === 0}
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent-400 disabled:bg-accent/30 disabled:text-slate-500 text-white text-sm font-medium transition-colors"
            >
              Import {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Importing state */}
        {state === 'importing' && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-300">Importing contacts...</p>
          </div>
        )}

        {/* Complete state */}
        {state === 'complete' && (
          <div className="text-center space-y-4">
            <svg className="w-10 h-10 mx-auto text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm text-slate-300 font-medium">
                {results.created} contact{results.created !== 1 ? 's' : ''} imported
              </p>
              {results.skipped > 0 && (
                <p className="text-xs text-slate-400">{results.skipped} skipped (duplicate)</p>
              )}
              {results.failed > 0 && (
                <p className="text-xs text-rose-400">{results.failed} failed</p>
              )}
            </div>
            <button
              onClick={handleModalClose}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
