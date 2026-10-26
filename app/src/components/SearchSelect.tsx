import { useState, useRef, useEffect } from 'react';

interface SearchSelectProps {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  allowCustom?: boolean;
  multiple?: boolean;
  className?: string;
  id?: string;
}

export function SearchSelect({
  label,
  placeholder = 'Type to search...',
  value = [],
  onChange,
  options = [],
  allowCustom = true,
  multiple = true,
  className = '',
  id,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (val: string) => value.includes(val);

  const handleSelect = (option: string) => {
    if (multiple) {
      const newValue = isSelected(option)
        ? value.filter((v) => v !== option)
        : [...value, option];
      onChange(newValue);
    } else {
      onChange(option === value[0] ? [] : [option]);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleCustomInput = () => {
    if (!allowCustom) return;
    const trimmed = searchQuery.trim();
    if (trimmed && !isSelected(trimmed)) {
      onChange(multiple ? [...value, trimmed] : [trimmed]);
      setSearchQuery('');
    }
  };

  const removeSelected = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (allowCustom && searchQuery.trim()) {
        handleCustomInput();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && mainInputRef.current) {
      mainInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className='block text-sm font-medium text-slate-300 mb-1.5'
        >
          {label}
          {allowCustom && (
            <span className='text-slate-500 font-normal ml-1'>(or type to create new)</span>
          )}
        </label>
      )}
      <div
        className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 cursor-pointer flex items-center justify-between gap-2 ${
          isOpen ? 'ring-2 ring-accent/50' : ''
        }`}
        onClick={() => setIsOpen((v) => !v)}
        role='combobox'
        aria-expanded={isOpen}
        aria-haspopup='listbox'
        aria-labelledby={id}
      >
        <input
          ref={mainInputRef}
          id={id}
          type='text'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent outline-none placeholder-slate-500 ${multiple && value.length > 0 ? 'hidden' : ''}`}
          data-testid='search-select-input'
        />
        {multiple && value.length > 0 && (
          <div className='flex flex-wrap gap-1 flex-1'>
            {value.map((v) => (
              <span
                key={v}
                className='inline-flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full'
              >
                {v}
                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelected(v);
                  }}
                  className='hover:text-rose-400'
                >
                  <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z' clipRule='evenodd' />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        {multiple && value.length === 0 && (
          <span className='text-slate-500 text-sm'>{placeholder}</span>
        )}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </div>

      {isOpen && (
        <div
          className='absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto'
          role='listbox'
        >
          <div className='p-2 border-b border-slate-700'>
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Search or type to create...'
              className='w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50'
            />
          </div>

          {filteredOptions.length === 0 && !allowCustom ? (
            <div className='p-4 text-center text-slate-400 text-sm'>
              No groups found
            </div>
          ) : filteredOptions.length === 0 && allowCustom ? (
            <div className='p-4 text-center text-slate-400 text-sm'>
              Type to create a new group
            </div>
          ) : (
            <ul className='py-1' role='option'>
              {filteredOptions.map((option, idx) => (
                <li
                  key={option}
                  className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                    highlightedIndex === idx
                      ? 'bg-accent/20 text-accent'
                      : 'text-slate-300 hover:bg-slate-700'
                  } ${isSelected(option) ? 'font-medium' : ''}`}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  role='option'
                  aria-selected={isSelected(option)}
                >
                  <span>{option}</span>
                  {isSelected(option) && (
                    <svg
                      className='w-4 h-4'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                        clipRule='evenodd'
                      />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          )}

          {allowCustom && searchQuery.trim() && !filteredOptions.some((o) => o === searchQuery.trim()) && (
            <div className='px-4 py-2 text-xs text-slate-500 border-t border-slate-700'>
              Press Enter to create "{searchQuery.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
