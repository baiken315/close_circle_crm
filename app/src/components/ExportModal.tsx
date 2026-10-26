import { useState } from 'react';
import { Modal } from './Modal';
import { useContacts } from '../hooks/useContacts';
import { contactsToCSV, contactsToVCF, downloadCSV, downloadVCF } from '../utils/csv';
import type { Contact } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'csv' | 'vcf';
type ExportScope = 'all' | 'groups';

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('all');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedCount, setExportedCount] = useState(0);

  const { data: contacts, refetch } = useContacts();

  const contactsList = (contacts as Contact[]) ?? [];

  const allGroups = (() => {
    const groupSet = new Set<string>();
    contactsList.forEach((c) => c.groups?.forEach((g) => groupSet.add(g)));
    return Array.from(groupSet).sort();
  })();

  const handleExport = async () => {
    setIsExporting(true);
    setExportedCount(0);

    try {
      const res = await refetch();
      const all = (res.data as Contact[]) ?? contactsList;
      const filtered = getFiltered(all);

      if (filtered.length === 0) {
        setExportedCount(0);
        setIsExporting(false);
        return;
      }

      let content: string;
      let filename: string;

      if (format === 'csv') {
        content = contactsToCSV(filtered);
        filename = `close-circle-contacts-${new Date().toISOString().split('T')[0]}.csv`;
        downloadCSV(content, filename);
      } else {
        content = contactsToVCF(filtered);
        filename = `close-circle-contacts-${new Date().toISOString().split('T')[0]}.vcf`;
        downloadVCF(content, filename);
      }

      setExportedCount(filtered.length);
    } finally {
      setIsExporting(false);
    }
  };

  const getFiltered = (all: Contact[]): Contact[] => {
    if (scope === 'all') return all;
    if (scope === 'groups') {
      return all.filter((c) => c.groups?.some((g) => selectedGroups.includes(g)));
    }
    return [];
  };

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleModalClose = () => {
    setFormat('csv');
    setScope('all');
    setSelectedGroups([]);
    setExportedCount(0);
    setIsExporting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Export Contacts" size="md">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ExportScope)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="all">All Contacts</option>
            <option value="groups">Selected Groups</option>
          </select>
        </div>

        {scope === 'groups' && allGroups.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Groups</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {allGroups.map((group) => (
                <button
                  key={group}
                  onClick={() => toggleGroup(group)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedGroups.includes(group)
                      ? 'bg-accent/30 text-accent-200 ring-1 ring-accent/60'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Format</label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat('csv')}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                format === 'csv'
                  ? 'bg-accent/10 border-accent/40 text-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              CSV
            </button>
            <button
              onClick={() => setFormat('vcf')}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                format === 'vcf'
                  ? 'bg-accent/10 border-accent/40 text-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              vCard (VCF)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {format === 'csv'
              ? 'Compatible with Google Contacts, Apple Contacts, and most CRM systems'
              : 'Standard vCard format for Apple Contacts, Google Contacts, and address books'}
          </p>
        </div>

        <button
          onClick={() => {
            void handleExport();
            setTimeout(handleModalClose, 1000);
          }}
          disabled={isExporting}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-400 disabled:bg-accent/50 text-white text-sm font-medium transition-colors"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>

        {exportedCount > 0 && (
          <p className="text-center text-sm text-emerald-400 font-medium">
            Exported {exportedCount} contact{exportedCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Modal>
  );
}
