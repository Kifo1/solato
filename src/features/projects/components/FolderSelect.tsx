import {
  buildFolderTree,
  flattenFolderTree,
  Folder,
  FolderTreeNode,
} from '@/shared/lib/models/project';
import { cn } from '@/shared/lib/utils';
import { Check, ChevronDown, CircleSlash, Folder as FolderIcon, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface FolderSelectProps {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  excludeIds?: Set<string>;
  emptyLabel?: string;
  variant?: 'form' | 'inline';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxListHeight: number;
}

interface SelectableItem {
  id: string | null;
  node?: FolderTreeNode;
}

export function FolderSelect({
  folders,
  value,
  onChange,
  excludeIds,
  emptyLabel = 'No folder',
  variant = 'form',
  disabled = false,
  className = '',
  ariaLabel,
}: Readonly<FolderSelectProps>) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const allNodes = useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders]);

  const options: FolderTreeNode[] = useMemo(() => {
    if (!excludeIds || excludeIds.size === 0) return allNodes;
    return allNodes.filter((node) => !excludeIds.has(node.folder.id));
  }, [allNodes, excludeIds]);

  const selectedNode = useMemo(
    () => (value ? (allNodes.find((node) => node.folder.id === value) ?? null) : null),
    [allNodes, value],
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const showSearch = options.length > 5;

  const filteredOptions = useMemo(() => {
    if (!isSearching) return options;
    return options.filter(
      (node) =>
        node.folder.name.toLowerCase().includes(trimmedQuery) ||
        node.pathLabel.toLowerCase().includes(trimmedQuery),
    );
  }, [options, isSearching, trimmedQuery]);

  const selectableItems: SelectableItem[] = useMemo(() => {
    const items: SelectableItem[] = [];
    if (!isSearching) {
      items.push({ id: null });
    }
    for (const node of filteredOptions) {
      items.push({ id: node.folder.id, node });
    }
    return items;
  }, [isSearching, filteredOptions]);

  const closeMenu = useCallback((returnFocus = false) => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const handleSelect = useCallback(
    (folderId: string | null) => {
      onChange(folderId);
      closeMenu(true);
    },
    [onChange, closeMenu],
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const margin = 10;
    const gap = 6;
    const searchHeaderHeight = showSearch ? 44 : 0;
    const minMenuWidth = variant === 'inline' ? 228 : rect.width;
    const width = Math.min(Math.max(rect.width, minMenuWidth), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));

    const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxListHeight = Math.max(112, Math.min(240, Math.floor(availableSpace - searchHeaderHeight - 12)));

    if (openUpward) {
      setCoords({
        bottom: window.innerHeight - rect.top + gap,
        left,
        width,
        maxListHeight,
      });
    } else {
      setCoords({
        top: rect.bottom + gap,
        left,
        width,
        maxListHeight,
      });
    }
  }, [showSearch, variant]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIdx = selectableItems.findIndex((item) => item.id === value);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : selectableItems.length > 0 ? 0 : -1);
  }, [isOpen, isSearching, trimmedQuery, selectableItems, value]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        closeMenu(true);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectableItems.length === 0) return;
        setHighlightedIndex((prev) => (prev + 1) % selectableItems.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectableItems.length === 0) return;
        setHighlightedIndex((prev) =>
          prev <= 0 ? selectableItems.length - 1 : prev - 1,
        );
        return;
      }

      if (e.key === 'Home') {
        if (document.activeElement === searchInputRef.current) return;
        e.preventDefault();
        if (selectableItems.length > 0) setHighlightedIndex(0);
        return;
      }

      if (e.key === 'End') {
        if (document.activeElement === searchInputRef.current) return;
        e.preventDefault();
        if (selectableItems.length > 0) setHighlightedIndex(selectableItems.length - 1);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const activeItem = selectableItems[highlightedIndex];
        if (activeItem) {
          handleSelect(activeItem.id);
        }
      }
    };

    const handleResizeOrScroll = () => updatePosition();

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen, selectableItems, highlightedIndex, handleSelect, closeMenu, updatePosition]);

  const triggerClasses =
    variant === 'inline'
      ? cn(
          'inline-flex h-8 w-full max-w-[168px] items-center justify-between gap-2 rounded-lg border px-2.5 text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50',
          isOpen
            ? 'border-amber-500/55 bg-[#191D26] text-[#F4F5F7] ring-2 ring-amber-500/15'
            : 'border-white/[0.08] bg-[#101217] text-[#F4F5F7] hover:border-white/[0.16] hover:bg-[#171B23]',
        )
      : cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50',
          isOpen
            ? 'border-amber-500/60 bg-[#0E1015] text-[#F4F5F7] ring-2 ring-amber-500/20'
            : 'border-white/[0.09] bg-[#0E1015] text-[#F4F5F7] hover:border-white/[0.16]',
        );

  const activeDescendantId =
    isOpen && highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={activeDescendantId}
        title={selectedNode?.pathLabel ?? emptyLabel}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            closeMenu();
          } else {
            setIsOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(triggerClasses, className)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {selectedNode ? (
            <>
              <FolderIcon
                className={cn(variant === 'inline' ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0')}
                style={{ color: selectedNode.folder.color }}
              />
              <span className="truncate text-[#F4F5F7]">
                {variant === 'inline' ? selectedNode.folder.name : selectedNode.pathLabel}
              </span>
            </>
          ) : (
            <>
              <CircleSlash
                className={cn(
                  variant === 'inline' ? 'h-3.5 w-3.5' : 'h-4 w-4',
                  'shrink-0 text-[#646C7A]',
                )}
              />
              <span className="truncate text-[#9CA3B0]">{emptyLabel}</span>
            </>
          )}
        </span>
        <ChevronDown
          className={cn(
            variant === 'inline' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            'shrink-0 text-[#646C7A] transition-transform duration-150',
            isOpen && 'rotate-180 text-amber-400',
          )}
        />
      </button>

      {isOpen &&
        coords &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-[1200]"
              onMouseDown={(e) => {
                e.stopPropagation();
                closeMenu();
              }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
              className="surface-elevated animate-popover fixed z-[1201] overflow-hidden rounded-xl backdrop-blur-md"
            >
              {showSearch && (
                <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#101217]/80 px-3 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#646C7A]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search folders..."
                    aria-label="Search folders"
                    className="w-full bg-transparent text-xs text-[#F4F5F7] placeholder-[#646C7A] focus:outline-none"
                  />
                  {isSearching && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="cursor-pointer rounded p-0.5 text-[#646C7A] transition-colors hover:text-[#F4F5F7]"
                      aria-label="Clear folder search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel ?? 'Folders'}
                style={{ maxHeight: `${coords.maxListHeight}px` }}
                className="overflow-y-auto p-1"
              >
                {!isSearching && (
                  <button
                    ref={(el) => {
                      optionRefs.current[0] = el;
                    }}
                    id={`${listboxId}-opt-0`}
                    type="button"
                    role="option"
                    aria-selected={value === null}
                    onMouseEnter={() => setHighlightedIndex(0)}
                    onClick={() => handleSelect(null)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                      value === null
                        ? 'bg-amber-500/12 font-medium text-[#F4F5F7]'
                        : highlightedIndex === 0
                          ? 'bg-white/[0.06] text-[#F4F5F7]'
                          : 'text-[#9CA3B0] hover:bg-white/[0.05] hover:text-[#F4F5F7]',
                    )}
                  >
                    <CircleSlash
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        value === null ? 'text-amber-400' : 'text-[#646C7A]',
                      )}
                    />
                    <span className="truncate">{emptyLabel}</span>
                    {value === null && (
                      <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-400" />
                    )}
                  </button>
                )}

                {!isSearching && options.length > 0 && (
                  <div className="my-1 border-t border-white/[0.06]" />
                )}

                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-[#646C7A]">
                    {isSearching ? 'No matching folders' : 'No folders created yet'}
                  </div>
                ) : (
                  filteredOptions.map((node, idx) => {
                    const itemIndex = isSearching ? idx : idx + 1;
                    const isSelected = value === node.folder.id;
                    const isHighlighted = highlightedIndex === itemIndex;
                    const indentPx = isSearching ? 10 : 10 + Math.min(node.depth, 5) * 14;

                    return (
                      <button
                        key={node.folder.id}
                        ref={(el) => {
                          optionRefs.current[itemIndex] = el;
                        }}
                        id={`${listboxId}-opt-${itemIndex}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        title={node.pathLabel}
                        onMouseEnter={() => setHighlightedIndex(itemIndex)}
                        onClick={() => handleSelect(node.folder.id)}
                        style={{ paddingLeft: `${indentPx}px` }}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pr-2.5 text-left text-xs transition-colors',
                          isSelected
                            ? 'bg-amber-500/12 font-medium text-[#F4F5F7]'
                            : isHighlighted
                              ? 'bg-white/[0.06] text-[#F4F5F7]'
                              : 'text-[#D1D5DE] hover:bg-white/[0.05] hover:text-[#F4F5F7]',
                        )}
                      >
                        <FolderIcon
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: node.folder.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {isSearching ? node.pathLabel : node.folder.name}
                        </span>
                        {isSelected && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
