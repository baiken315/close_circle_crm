import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  photo_path?: string;
  contactId?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function getColorClass(name: string): string {
  const colors = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-fuchsia-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + (name.charCodeAt(i) ?? 0)) % colors.length;
  }
  return colors[hash] ?? colors[0] ?? 'bg-violet-500';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export function Avatar({ name, size = 'md', className, photo_path, contactId }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (photo_path && contactId) {
      setUrl(`/api/contacts/${contactId}/photo?t=${Date.now()}`);
    } else {
      setUrl(null);
    }
  }, [photo_path, contactId]);

  return (
    <div
      className={clsx(
        'relative rounded-full flex items-center justify-center font-semibold text-white shrink-0 overflow-hidden',
        sizeClasses[size],
        className
      )}
    >
      <div className={clsx('w-full h-full rounded-full flex items-center justify-center font-semibold text-white shrink-0', getColorClass(name))}>
        {getInitials(name)}
      </div>
      {url && (
        <img
          src={url}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
