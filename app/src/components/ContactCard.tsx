import { Avatar } from './Avatar';
import type { Contact } from '../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface ContactCardProps {
  contact: Contact;
  onClick?: () => void;
  isSelected?: boolean;
  isChecked?: boolean;
  isSelecting?: boolean;
  onCheck?: (id: string) => void;
  activeGroups?: Set<string>;
  onGroupClick?: (group: string) => void;
}

export function ContactCard({
  contact, onClick, isSelected, isChecked, isSelecting, onCheck,
  activeGroups, onGroupClick,
}: ContactCardProps) {
  const lastInteraction = contact.interactions?.[0];

  return (
    <div
      className={clsx(
        'w-full text-left px-3 py-3 rounded-lg transition-colors flex items-center gap-3 group',
        isSelected
          ? 'bg-accent/20 border border-accent/40'
          : isChecked
          ? 'bg-slate-700/70 border border-slate-500/50'
          : 'hover:bg-slate-700/50 border border-transparent'
      )}
    >
      {/* Checkbox / Avatar area */}
      <div className="shrink-0 relative">
        {(isSelecting || isChecked) ? (
          <button
            onClick={(e) => { e.stopPropagation(); onCheck?.(contact.id); }}
            className={clsx(
              'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
              isChecked ? 'bg-accent' : 'bg-slate-600 hover:bg-slate-500'
            )}
            aria-label={isChecked ? 'Deselect' : 'Select'}
          >
            {isChecked ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
              </svg>
            )}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCheck?.(contact.id); }}
            className="relative"
            aria-label="Select"
            tabIndex={-1}
          >
            <Avatar name={contact.full_name} size="md" contactId={contact.id} photo_path={contact.photo_path} />
            {/* Hover overlay to hint at selection */}
            <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-70 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* Row body — opens detail */}
      <button
        onClick={isSelecting ? () => onCheck?.(contact.id) : onClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100 truncate">{contact.full_name}</span>
          {contact.nickname && (
            <span className="text-slate-500 text-sm truncate">"{contact.nickname}"</span>
          )}
          {contact.is_private && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400 shrink-0" title="Private — only visible to you">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
          )}
        </div>
        {contact.organization && (
          <div className="text-sm text-slate-400 truncate">
            {contact.title ? `${contact.title} at ` : ''}{contact.organization}
          </div>
        )}
        {contact.groups && contact.groups.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {contact.groups.slice(0, 3).map((g) => {
              const isActive = activeGroups?.has(g);
              return onGroupClick && !isSelecting ? (
                <span
                  key={g}
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onGroupClick(g); }}
                  className={clsx(
                    'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer',
                    isActive
                      ? 'bg-accent/30 text-accent-200 ring-1 ring-accent/60'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  )}
                >
                  {g}
                </span>
              ) : (
                <span key={g} className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-700 text-slate-200">
                  {g}
                </span>
              );
            })}
            {contact.groups.length > 3 && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-700 text-slate-200">
                +{contact.groups.length - 3}
              </span>
            )}
          </div>
        )}
      </button>

      {lastInteraction && !isSelecting && (
        <div className="text-xs text-slate-500 shrink-0">
          {formatDistanceToNow(new Date(lastInteraction.date), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}
