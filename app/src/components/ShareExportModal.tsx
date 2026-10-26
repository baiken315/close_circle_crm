import { useState } from 'react';
import { Modal } from '../components/Modal';
import { contactsToCSV, contactsToVCF, downloadCSV, downloadVCF } from '../utils/csv';
import type { Contact } from '../types';

interface ShareExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
}

export function ShareExportModal({ isOpen, onClose, contacts }: ShareExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'vcf'>('vcf');
  const [exportedCount, setExportedCount] = useState(0);

  const count = contacts.length;

  const description =
    count === 1
      ? `Export ${contacts[0].full_name} as a downloadable file:`
      : `Export ${count} contacts as a single downloadable file:`;

  const handleExport = () => {
    if (count === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename =
      count === 1
        ? `${contacts[0].full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${dateStr}`
        : `close-circle-contacts-${dateStr}`;

    if (format === 'csv') {
      downloadCSV(contactsToCSV(contacts), `${filename}.csv`);
    } else {
      downloadVCF(contactsToVCF(contacts), `${filename}.vcf`);
    }
    setExportedCount(count);
  };

  const handleClose = () => {
    setFormat('vcf');
    setExportedCount(0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={count === 1 ? 'Share Contact' : 'Share & Export'} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">{description}</p>
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
        <p className="text-xs text-slate-500">
          {format === 'csv'
            ? 'Compatible with Google Contacts, Apple Contacts, and most CRM systems'
            : 'Standard vCard format for Apple Contacts, Google Contacts, and address books'}
        </p>
        <button
          onClick={() => { handleExport(); handleClose(); }}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-400 text-white text-sm font-medium transition-colors"
        >
          Export & Download
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
