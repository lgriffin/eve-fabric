import { useState, useEffect, useCallback, useRef } from 'react';
import {
  searchItems,
  listRegions,
  searchSystems,
  type ReferenceDataItem,
} from '../../services/reference-data-service.js';
import { colors } from '../../tokens.js';

interface SearchableSelectorProps {
  semanticType: string;
  value: unknown;
  displayLabel: string;
  onChange: (value: unknown, displayLabel: string) => void;
  placeholder?: string;
}

function getSearchFn(
  semanticType: string,
): ((query: string) => Promise<ReferenceDataItem[]>) | (() => Promise<ReferenceDataItem[]>) {
  switch (semanticType) {
    case 'eve.type.reference':
      return (q: string) => searchItems(q);
    case 'eve.region.reference':
      return () => listRegions();
    case 'eve.system.reference':
      return (q: string) => searchSystems(q);
    default:
      return (q: string) => searchItems(q);
  }
}

export function SearchableSelector({
  semanticType,
  value,
  displayLabel,
  onChange,
  placeholder,
}: SearchableSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<ReferenceDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const isStaticList = semanticType === 'eve.region.reference';

  useEffect(() => {
    if (isStaticList && isOpen) {
      setIsLoading(true);
      const fn = getSearchFn(semanticType);
      (fn as () => Promise<ReferenceDataItem[]>)()
        .then((items) => {
          setOptions(items);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [isOpen, isStaticList, semanticType]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      if (isStaticList) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.length < 2) {
        setOptions([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        const fn = getSearchFn(semanticType);
        const results = await (fn as (q: string) => Promise<ReferenceDataItem[]>)(text);
        setOptions(results);
        setIsLoading(false);
      }, 300);
    },
    [semanticType, isStaticList],
  );

  const handleSelect = useCallback(
    (item: ReferenceDataItem) => {
      onChange(item.id, item.name);
      setIsOpen(false);
      setSearchText('');
    },
    [onChange],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions =
    isStaticList && searchText
      ? options.filter((o) => o.name.toLowerCase().includes(searchText.toLowerCase()))
      : options;

  return (
    <div
      className="searchable-selector nopan nodrag"
      ref={containerRef}
      style={{ position: 'relative' }}
    >
      <button
        className="searchable-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          background: colors.surface.base,
          border: `1px solid ${colors.surface.borderLight}`,
          borderRadius: 4,
          color: value != null ? colors.text.primary : colors.text.dim,
          fontSize: '11px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value != null ? displayLabel : (placeholder ?? 'Select...')}
        </span>
        <span style={{ marginLeft: 4, fontSize: '8px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          className="searchable-selector-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: colors.surface.base,
            border: `1px solid ${colors.surface.borderLight}`,
            borderRadius: 4,
            zIndex: 100,
            maxHeight: 200,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
            style={{
              padding: '4px 8px',
              background: colors.surface.base,
              border: 'none',
              borderBottom: `1px solid ${colors.surface.border}`,
              color: colors.text.primary,
              fontSize: '11px',
              outline: 'none',
            }}
          />
          {isLoading && (
            <div style={{ padding: '6px 8px', color: colors.text.dim, fontSize: '10px' }}>
              Loading...
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                type="button"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '4px 8px',
                  background: item.id === value ? colors.surface.overlay : 'transparent',
                  border: 'none',
                  color: colors.text.primary,
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = colors.surface.overlay;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    item.id === value ? colors.surface.overlay : 'transparent';
                }}
              >
                {item.name}
              </button>
            ))}
            {!isLoading && filteredOptions.length === 0 && searchText.length >= 2 && (
              <div style={{ padding: '6px 8px', color: colors.text.dim, fontSize: '10px' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
