import { useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { CopyButton } from '../../components/CopyButton';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingPage } from '../../components/LoadingSpinner';
import { ContactForm } from './ContactForm';
import { useContact, useUpdateContact, useDeleteContact, useContacts, useUploadPhoto, useDeletePhoto } from '../../hooks/useContacts';
import { useLogInteraction, useUpdateInteraction, useDeleteInteraction } from '../../hooks/useInteractions';
import { useAddImportantDate, useDeleteImportantDate, useUpdateImportantDate } from '../../hooks/useDates';
import { useCreateReminder } from '../../hooks/useReminders';
import { toLocalDatetimeInput, to12hLocalInput, daysUntilNextAnnual } from '../../utils/dates';
import { DatePickerModal } from '../../components/DatePickerModal';
import { PhotoUploadModal } from '../../components/PhotoUploadModal';
import { ShareExportModal } from '../../components/ShareExportModal';

interface ContactDetailProps {
  contactId: string;
  onClose?: () => void;
}

function InteractionTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    meeting: '🤝',
    call: '📞',
    email: '📧',
    text: '💬',
    social: '🌐',
    other: '📝',
  };
  return <span>{icons[type] ?? '📝'}</span>;
}

export function ContactDetail({ contactId, onClose }: ContactDetailProps) {
  const { data: contact, isLoading } = useContact(contactId);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const logInteraction = useLogInteraction();
  const updateInteraction = useUpdateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const addImportantDate = useAddImportantDate();
  const deleteImportantDate = useDeleteImportantDate();
  const updateImportantDate = useUpdateImportantDate();
  const createReminder = useCreateReminder();
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();

  // Extract all unique groups from contacts for the groups selector
  const { data: allContacts } = useContacts();
  const allGroups = useMemo(() => {
    const groupSet = new Set<string>();
    allContacts?.forEach((c) => {
      c.groups?.forEach((group) => groupSet.add(group));
    });
    return Array.from(groupSet).sort();
  }, [allContacts]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isInteractionOpen, setIsInteractionOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Date/time picker modal state
  const [pickerTarget, setPickerTarget] = useState<
    | 'interaction'
    | 'editInteraction'
    | 'date'
    | 'editDate'
    | 'reminder'
    | null
  >(null);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);

  // Interaction form state
  const [interactionType, setInteractionType] = useState<'meeting' | 'call' | 'email' | 'text' | 'social' | 'other'>('meeting');
  const [interactionDate, setInteractionDate] = useState(() => toLocalDatetimeInput());
  const [interactionNotes, setInteractionNotes] = useState('');

  // Interaction edit state
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  const [editInteractionType, setEditInteractionType] = useState<'meeting' | 'call' | 'email' | 'text' | 'social' | 'other'>('meeting');
  const [editInteractionDate, setEditInteractionDate] = useState('');
  const [editInteractionNotes, setEditInteractionNotes] = useState('');

  // Date form state (add)
  const [dateTitle, setDateTitle] = useState('Birthday');
  const [dateValue, setDateValue] = useState('');
  const [dateNotes, setDateNotes] = useState('');

  // Date edit state
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDateValue, setEditDateValue] = useState('');

  // Reminder form state
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDue, setReminderDue] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return toLocalDatetimeInput(tomorrow);
  });
  const [reminderNotes, setReminderNotes] = useState('');

  if (isLoading) return <LoadingPage />;
  if (!contact) return null;

  const primaryEmail = contact.contact_methods?.find((m) => m.type === 'email' && m.is_primary) ??
    contact.contact_methods?.find((m) => m.type === 'email');
  const primaryPhone = contact.contact_methods?.find((m) => m.type === 'phone' && m.is_primary) ??
    contact.contact_methods?.find((m) => m.type === 'phone');

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateWithOffset = new Date(interactionDate).toISOString();
    await logInteraction.mutateAsync({
      contactId,
      type: interactionType,
      date: dateWithOffset,
      notes: interactionNotes || undefined,
    });
    setIsInteractionOpen(false);
    setInteractionNotes('');
  };

  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault();
    await addImportantDate.mutateAsync({
      contactId,
      title: dateTitle,
      date: dateValue,
      notes: dateNotes || undefined,
    });
    setIsDateOpen(false);
    setDateValue('');
    setDateNotes('');
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateWithOffset = new Date(reminderDue).toISOString();
    await createReminder.mutateAsync({
      title: reminderTitle,
      due_date: dateWithOffset,
      contact_id: contactId,
      notes: reminderNotes || undefined,
    });
    setIsReminderOpen(false);
    setReminderTitle('');
    setReminderNotes('');
  };

  const handleUploadPhoto = async (base64Data: string) => {
    await uploadPhoto.mutateAsync({ contactId, photoData: base64Data });
  };

  const handleRemovePhoto = async () => {
    await deletePhoto.mutateAsync(contactId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
        <div className="flex items-start gap-4">
          <Avatar name={contact.full_name} size="lg" contactId={contact.id} photo_path={contact.photo_path} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">{contact.full_name}</h2>
              {contact.is_private && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400" title="Private — only visible to you">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Private
                </span>
              )}
            </div>
            {contact.nickname && (
              <p className="text-slate-400 text-sm">"{contact.nickname}"</p>
            )}
            {(contact.title || contact.organization) && (
              <p className="text-slate-300 text-sm mt-0.5">
                {[contact.title, contact.organization].filter(Boolean).join(' at ')}
              </p>
            )}
            {contact.groups && contact.groups.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {contact.groups.map((g) => (
                  <Badge key={g} variant="accent">{g}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
            title="Edit contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setIsPhotoOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
            title="Change photo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setIsShareOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
            title="Share contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
            title="Delete contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          {primaryEmail && (
            <a
              href={`mailto:${primaryEmail.value}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
          )}
          {primaryPhone && (
            <a
              href={`tel:${primaryPhone.value}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call
            </a>
          )}
          <button
            onClick={() => setIsInteractionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
          >
            + Log Interaction
          </button>
          <button
            onClick={() => setIsReminderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
          >
            + Reminder
          </button>
          <button
            onClick={() => setIsDateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
          >
            + Date
          </button>
        </div>

        {/* Contact methods */}
        {contact.contact_methods && contact.contact_methods.length > 0 && (
          <Section title="Contact Info">
            <div className="space-y-0.5 -mx-2">
              {contact.contact_methods.map((method) => (
                <div key={method.id} className="group flex items-center gap-3 text-sm px-2 py-1 rounded-lg hover:bg-slate-700/40 transition-colors">
                  <span className="text-slate-500 capitalize w-16 shrink-0">
                    {method.type === 'social' ? (method.label ?? 'Social') : method.type}
                  </span>
                  {method.type === 'email' ? (
                    <a href={`mailto:${method.value}`} className="text-accent-300 hover:underline truncate">
                      {method.value}
                    </a>
                  ) : method.type === 'phone' ? (
                    <a href={`tel:${method.value}`} className="text-accent-300 hover:underline">
                      {method.value}
                    </a>
                  ) : method.type === 'social' ? (
                    <a href={method.value.startsWith('http') ? method.value : `https://${method.value}`}
                       target="_blank" rel="noopener noreferrer"
                       className="text-accent-300 hover:underline truncate">
                      {method.value}
                    </a>
                  ) : (
                    <span className="text-slate-300">{method.value}</span>
                  )}
                  {method.is_primary && <Badge size="sm">Primary</Badge>}
                  <CopyButton
                    value={method.value}
                    label={`Copy ${method.type === 'social' ? (method.label ?? 'link') : method.type}`}
                    className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Notes */}
        {contact.notes && (
          <Section title="Notes">
            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{contact.notes}</p>
          </Section>
        )}

        {/* Factoids */}
        {contact.factoids && contact.factoids.length > 0 && (
          <Section title="Quick Facts">
            <ul className="space-y-1.5">
              {contact.factoids.map((fact, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-accent-400 mt-0.5">•</span>
                  {fact}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Important dates */}
        {contact.important_dates && contact.important_dates.length > 0 && (
          <Section title="Important Dates">
            <div className="space-y-2">
              {contact.important_dates.map((d) => {
                const datePart = (d.date ?? '').slice(0, 10);
                const [dYear, dMonth, dDay] = datePart.split('-').map(Number);
                const daysUntil = daysUntilNextAnnual(datePart);
                const displayDate = datePart ? new Date(dYear, dMonth - 1, dDay) : null;

                if (editingDateId === d.id) {
                  return (
                    <form key={d.id} onSubmit={async (e) => {
                      e.preventDefault();
                      await updateImportantDate.mutateAsync({ contactId: d.contact_id, dateId: d.id, title: editTitle, date: editDateValue });
                      setEditingDateId(null);
                    }} className="flex gap-2 items-center">
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required
                        className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
                      <DateButton value={editDateValue} onPick={() => setPickerTarget('editDate')} placeholder="Select date..." compact />
                      <button type="submit" disabled={updateImportantDate.isPending}
                        className="px-2 py-1.5 bg-accent hover:bg-accent-400 text-white text-xs rounded-lg transition-colors disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => setEditingDateId(null)}
                        className="px-2 py-1.5 text-slate-400 hover:text-slate-50 text-xs transition-colors">Cancel</button>
                    </form>
                  );
                }

                return (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-slate-200 font-medium">{d.title}</span>
                      <span className="text-slate-400 ml-2">
                        {displayDate ? format(displayDate, 'MMMM d') : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={daysUntil <= 7 ? 'warning' : 'default'}>
                        {daysUntil === 0 ? 'Today!' : `in ${daysUntil} days`}
                      </Badge>
                      <button onClick={() => { setEditingDateId(d.id); setEditTitle(d.title); setEditDateValue(datePart); }}
                        className="p-0.5 text-slate-600 hover:text-slate-300 transition-colors" title="Edit date">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => void deleteImportantDate.mutateAsync({ contactId: d.contact_id, dateId: d.id })}
                        className="p-0.5 text-slate-600 hover:text-rose-400 transition-colors" title="Remove date">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Interactions timeline */}
        {contact.interactions && contact.interactions.length > 0 && (
          <Section title="Recent Interactions">
            <div className="space-y-3">
              {contact.interactions.map((interaction) => {
                const interactionDatePart = (interaction.date ?? '').slice(0, 16);

                if (editingInteractionId === interaction.id) {
                  return (
                    <div key={interaction.id} className="flex items-start gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-base">
                        <InteractionTypeIcon type={editInteractionType} />
                      </div>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!editInteractionDate) return;
                          await updateInteraction.mutateAsync({
                            id: interaction.id,
                            type: editInteractionType,
                            date: new Date(editInteractionDate).toISOString(),
                            notes: editInteractionNotes || undefined,
                          });
                          setEditingInteractionId(null);
                        }}
                        className="flex-1 min-w-0 space-y-2"
                      >
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={editInteractionType}
                            onChange={(e) => setEditInteractionType(e.target.value as typeof editInteractionType)}
                            className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                          >
                            <option value="meeting">Meeting</option>
                            <option value="call">Call</option>
                            <option value="email">Email</option>
                            <option value="text">Text</option>
                            <option value="social">Social</option>
                            <option value="other">Other</option>
                          </select>
                          <DateButton value={editInteractionDate} onPick={() => setPickerTarget('editInteraction')} compact />
                          <button
                            type="submit"
                            disabled={updateInteraction.isPending}
                            className="px-2 py-1.5 bg-accent hover:bg-accent-400 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingInteractionId(null)}
                            className="px-2 py-1.5 text-slate-400 hover:text-slate-50 text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        <textarea
                          value={editInteractionNotes}
                          onChange={(e) => setEditInteractionNotes(e.target.value)}
                          rows={2}
                          placeholder="What happened?"
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                        />
                      </form>
                    </div>
                  );
                }

                return (
                  <div key={interaction.id} className="flex items-start gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-base">
                      <InteractionTypeIcon type={interaction.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-medium capitalize">{interaction.type}</span>
                        <span className="text-slate-500 text-xs">
                          {formatDistanceToNow(new Date(interaction.date), { addSuffix: true })}
                        </span>
                      </div>
                      {interaction.notes && (
                        <p className="text-slate-400 mt-0.5 leading-snug">{interaction.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingInteractionId(interaction.id);
                          setEditInteractionType(interaction.type);
                          setEditInteractionDate(interactionDatePart);
                          setEditInteractionNotes(interaction.notes ?? '');
                        }}
                        className="p-0.5 text-slate-600 hover:text-slate-300 transition-colors"
                        title="Edit interaction"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void deleteInteraction.mutateAsync(interaction.id)}
                        className="p-0.5 text-slate-600 hover:text-rose-400 transition-colors"
                        title="Delete interaction"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Contact" size="lg">
        <ContactForm
          initial={contact}
          onSubmit={async (data) => {
            await updateContact.mutateAsync({ id: contactId, ...data });
            setIsEditOpen(false);
          }}
          onCancel={() => setIsEditOpen(false)}
          isLoading={updateContact.isPending}
          allGroups={allGroups}
          beforeActions={
            <div className="pt-4 pb-1 border-t border-slate-700">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Important Dates</h3>

              {contact.important_dates && contact.important_dates.length > 0 ? (
                <div className="space-y-1.5 mb-3">
                  {contact.important_dates.map((d) => {
                    const datePart = (d.date ?? '').slice(0, 10);
                    const [y, m, day] = datePart.split('-').map(Number);
                    const displayDate = datePart ? new Date(y, m - 1, day) : null;

                    if (editingDateId === d.id) {
                      return (
                        <div key={d.id} className="flex gap-2 items-center bg-slate-700/40 px-3 py-2 rounded-lg">
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
                          <DateButton value={editDateValue} onPick={() => setPickerTarget('editDate')} placeholder="Select date..." compact />
                          <button type="button" disabled={updateImportantDate.isPending}
                            onClick={async () => {
                              if (!editTitle.trim() || !editDateValue) return;
                              await updateImportantDate.mutateAsync({ contactId: d.contact_id, dateId: d.id, title: editTitle, date: editDateValue });
                              setEditingDateId(null);
                            }}
                            className="px-2 py-1 bg-accent hover:bg-accent-400 text-white text-xs rounded transition-colors disabled:opacity-50">Save</button>
                          <button type="button" onClick={() => setEditingDateId(null)}
                            className="px-2 py-1 text-slate-400 hover:text-slate-50 text-xs transition-colors">Cancel</button>
                        </div>
                      );
                    }

                    return (
                      <div key={d.id} className="flex items-center justify-between text-sm bg-slate-700/40 px-3 py-2 rounded-lg">
                        <div>
                          <span className="text-slate-200 font-medium">{d.title}</span>
                          <span className="text-slate-400 ml-2">{displayDate ? format(displayDate, 'MMMM d, yyyy') : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button"
                            onClick={() => { setEditingDateId(d.id); setEditTitle(d.title); setEditDateValue(datePart); }}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button type="button"
                            onClick={() => void deleteImportantDate.mutateAsync({ contactId: d.contact_id, dateId: d.id })}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic mb-3">No important dates yet.</p>
              )}

              <div className="flex gap-2 items-center">
                <input type="text" value={dateTitle} onChange={(e) => setDateTitle(e.target.value)}
                  placeholder="Birthday, Anniversary..."
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
                <DateButton value={dateValue} onPick={() => setPickerTarget('date')} placeholder="Select date..." compact />
                <button type="button"
                  disabled={!dateValue || !dateTitle.trim() || addImportantDate.isPending}
                  onClick={async () => {
                    if (!dateValue || !dateTitle.trim()) return;
                    await addImportantDate.mutateAsync({ contactId, title: dateTitle, date: dateValue, notes: dateNotes || undefined });
                    setDateValue('');
                    setDateNotes('');
                  }}
                  className="px-3 py-2 bg-accent hover:bg-accent-400 text-white text-sm rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                  + Add
                </button>
              </div>
            </div>
          }
        />
      </Modal>

      {/* Share Modal */}
      <ShareExportModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        contacts={[contact]}
      />

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        onUpload={handleUploadPhoto}
        onRemove={handleRemovePhoto}
        isUploading={uploadPhoto.isPending}
      />

      {/* Delete Modal */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={async () => {
          await deleteContact.mutateAsync(contactId);
          setIsDeleteOpen(false);
          onClose?.();
        }}
        title="Delete Contact"
        message={`Are you sure you want to delete ${contact.full_name}? This will also delete all interactions, reminders, and dates linked to this contact. This cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
        isLoading={deleteContact.isPending}
      />

      {/* Log Interaction Modal */}
      <Modal isOpen={isInteractionOpen} onClose={() => setIsInteractionOpen(false)} title="Log Interaction" size="sm">
        <form onSubmit={(e) => void handleLogInteraction(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
            <select
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value as typeof interactionType)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="meeting">Meeting</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="text">Text</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Date & Time</label>
            <DateButton value={interactionDate} onPick={() => setPickerTarget('interaction')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
            <textarea
              value={interactionNotes}
              onChange={(e) => setInteractionNotes(e.target.value)}
              rows={3}
              placeholder="What happened?"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setIsInteractionOpen(false)} className="px-4 py-2 text-slate-300 hover:text-slate-50">Cancel</button>
            <button type="submit" disabled={logInteraction.isPending} className="px-4 py-2 bg-accent hover:bg-accent-400 text-white rounded-lg transition-colors disabled:opacity-50">
              {logInteraction.isPending ? 'Saving...' : 'Log Interaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Important Date Modal */}
      <Modal isOpen={isDateOpen} onClose={() => setIsDateOpen(false)} title="Add Important Date" size="sm">
        <form onSubmit={(e) => void handleAddDate(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
            <input
              type="text"
              value={dateTitle}
              onChange={(e) => setDateTitle(e.target.value)}
              placeholder="Birthday, Anniversary, etc."
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
            <DateButton value={dateValue} onPick={() => setPickerTarget('date')} placeholder="Select date..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={dateNotes}
              onChange={(e) => setDateNotes(e.target.value)}
              placeholder="Any notes..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setIsDateOpen(false)} className="px-4 py-2 text-slate-300 hover:text-slate-50">Cancel</button>
            <button type="submit" disabled={addImportantDate.isPending} className="px-4 py-2 bg-accent hover:bg-accent-400 text-white rounded-lg transition-colors disabled:opacity-50">
              {addImportantDate.isPending ? 'Saving...' : 'Add Date'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Reminder Modal */}
      <Modal isOpen={isReminderOpen} onClose={() => setIsReminderOpen(false)} title="Set Reminder" size="sm">
        <form onSubmit={(e) => void handleCreateReminder(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Reminder</label>
            <input
              type="text"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              placeholder="What do you need to do?"
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date & Time</label>
            <DateButton value={reminderDue} onPick={() => setPickerTarget('reminder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label>
            <textarea
              value={reminderNotes}
              onChange={(e) => setReminderNotes(e.target.value)}
              rows={2}
              placeholder="Additional context..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setIsReminderOpen(false)} className="px-4 py-2 text-slate-300 hover:text-slate-50">Cancel</button>
            <button type="submit" disabled={createReminder.isPending} className="px-4 py-2 bg-accent hover:bg-accent-400 text-white rounded-lg transition-colors disabled:opacity-50">
              {createReminder.isPending ? 'Saving...' : 'Set Reminder'}
            </button>
          </div>
        </form>
      </Modal>

      <DatePickerModal
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onConfirm={(v) => {
          if (pickerTarget === 'interaction') setInteractionDate(v);
          else if (pickerTarget === 'editInteraction') setEditInteractionDate(v);
          else if (pickerTarget === 'date') setDateValue(v);
          else if (pickerTarget === 'editDate') setEditDateValue(v);
          else if (pickerTarget === 'reminder') setReminderDue(v);
          setPickerTarget(null);
        }}
        initialDate={
          pickerTarget === 'interaction' ? interactionDate
          : pickerTarget === 'editInteraction' ? editInteractionDate
          : pickerTarget === 'date' ? dateValue
          : pickerTarget === 'editDate' ? editDateValue
          : pickerTarget === 'reminder' ? reminderDue
          : ''
        }
        withTime={pickerTarget === 'interaction' || pickerTarget === 'editInteraction' || pickerTarget === 'reminder'}
        title={
          pickerTarget === 'interaction' ? 'Select Date & Time'
          : pickerTarget === 'editInteraction' ? 'Edit Date & Time'
          : pickerTarget === 'reminder' ? 'Select Due Date & Time'
          : 'Select Date'
        }
      />
    </div>
  );
}

function DateButton({ value, onPick, placeholder = 'Select date & time...', compact = false }: { value: string; onPick: () => void; placeholder?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={compact
        ? 'flex-1 min-w-0 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm text-left focus:outline-none focus:ring-2 focus:ring-accent/50'
        : 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-accent/50'}
    >
      <span className={compact ? 'truncate block' : ''}>{to12hLocalInput(value) || <span className="text-slate-500">{placeholder}</span>}</span>
      {!compact && (
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}
