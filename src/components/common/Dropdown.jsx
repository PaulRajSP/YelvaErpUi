import { useRef, useEffect, useState, forwardRef } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { formatOrderStatus } from '../../common/utils';

// Moved outside the component to prevent recreation on every render
const isAllOption = (opt) => {
    if (typeof opt === 'string') {
        return opt.trim().toLowerCase() === 'all';
    }
    const candidates = [opt?.id, opt?.value, opt?.label, opt?.name];
    return candidates.some(
        (c) => c != null && String(c).trim().toLowerCase() === 'all'
    );
};

export const Dropdown = forwardRef(({
    label,
    error,
    value,
    onChange,
    options = [],
    placeholder = 'Select',
    disabled = false,
    className = '',
    containerClassName = '',
    onAddNew,
    addNewLabel = '+ Add New',
    icon: Icon,
    required = false,
    searchable = false,
    searchPlaceholder = 'Search...',
    onSearchChange,
    onOpen,
    isDefault = false
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpwards, setOpenUpwards] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Locate the raw "All" option (if any) so we can use it as the default value
    const allOptRaw = options.find(isAllOption);
    const allOptValue = allOptRaw == null
        ? undefined
        : (typeof allOptRaw === 'string'
            ? allOptRaw
            : (allOptRaw.id ?? allOptRaw.value));
    const allOptLabel = allOptRaw == null
        ? 'All'
        : (typeof allOptRaw === 'string'
            ? allOptRaw
            : (allOptRaw.label ?? allOptRaw.name ?? 'All'));

    const normalised = options
        // isDefault = true  -> hide "All" from the open list
        // isDefault = false -> keep "All" in the open list
        .filter((opt) => !isDefault || !isAllOption(opt))
        .map((opt) => {
            if (typeof opt === 'string') return { value: opt, label: opt };
            return {
                value: opt.id ?? opt.value,
                label: opt.label ?? opt.name ?? '',
                isDefault: opt.isDefault ?? false,
                ...opt
            };
        });

    // Default selection:
    // If isDefault is true: default option is the first element of normalised list (never "All", skips disabled).
    // If isDefault is false: default option is "All" if it exists, otherwise null (show placeholder, never auto-select).
    const defaultOpt = isDefault
        ? (normalised.find(o => !o.disabled) ?? normalised[0] ?? null)
        : (allOptValue !== undefined ? { value: allOptValue, label: allOptLabel } : null);
    const defaultOptValue = defaultOpt?.value;

    const filteredOptions = onSearchChange
        ? normalised
        : normalised.filter(opt =>
            !searchable || opt.label.toLowerCase().includes(searchTerm.toLowerCase())
        );

    // Resolve the visible selection.
    const selected = normalised.find((o) => o.value === value)
        || (value !== undefined && value !== null && value !== '' && !isAllOption(value) ? { value, label: formatOrderStatus(value) || String(value) } : defaultOpt);

    // Auto-select when the component mounts and no value is provided, or when isDefault=true and value is 'All'
    useEffect(() => {
        if (defaultOptValue === undefined) return;
        const isEmpty = value === undefined || value === null || value === '' || (isDefault && isAllOption(value));
        if (isEmpty && defaultOptValue !== value) {
            onChange?.(defaultOptValue);
        }
        // Use defaultOptValue (primitive) rather than defaultOpt (new object each render)
    }, [isDefault, value, defaultOptValue, onChange]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    const toggleDropdown = () => {
        if (disabled) return;

        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setOpenUpwards(spaceBelow < 250);
            if (onOpen) onOpen();
        }

        setIsOpen(!isOpen);
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`space-y-1.5 ${containerClassName}`} ref={ref}>
            {label && (
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div ref={dropdownRef} className={`relative ${isOpen ? 'z-50' : ''} ${className}`}>
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-10">
                        {typeof Icon === 'function' ? <Icon size={16} /> : Icon}
                    </div>
                )}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={toggleDropdown}
                    className={`w-full flex items-center justify-between px-3 py-2 border bg-white rounded-lg transition-colors focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'
                        } ${error
                            ? 'border-red-300 text-red-900'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${Icon ? 'pl-9' : ''}`}
                >
                    <span className={`text-sm truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
                        {selected ? selected.label : placeholder}
                    </span>
                    <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform ${isOpen ? (openUpwards ? 'rotate-0' : 'rotate-180') : ''}`}
                    />
                </button>

                {isOpen && (
                    <div
                        className={`absolute left-0 z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 flex flex-col ${openUpwards ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}
                    >
                        {searchable && (
                            <div className="p-2 border-b border-slate-100 shrink-0">
                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        autoFocus
                                        autoComplete="off"
                                        placeholder={searchPlaceholder}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            if (onSearchChange) onSearchChange(e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-3 text-sm text-slate-400 text-center font-medium">No results found</div>
                            ) : (
                                filteredOptions.map((opt) => {
                                    const isSelected = selected ? selected.value === opt.value : value === opt.value;
                                    const isDisabled = Boolean(opt.disabled);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => !isDisabled && handleSelect(opt.value)}
                                            className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                                                isDisabled
                                                    ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 select-none'
                                                    : isSelected
                                                        ? 'bg-slate-100 text-slate-900 font-medium cursor-pointer'
                                                        : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                                            }`}
                                        >
                                            <span className="truncate">{opt.label}</span>
                                            {isSelected && <Check size={14} className="text-slate-900 shrink-0" />}
                                        </button>
                                    );
                                })
                            )}

                            {onAddNew && (
                                <button
                                    type="button"
                                    onClick={() => { setIsOpen(false); onAddNew(); }}
                                    className="w-full cursor-pointer text-left px-3 py-2 text-sm text-slate-900 font-semibold border-t border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between mt-1"
                                >
                                    {addNewLabel}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>
    );
});

Dropdown.displayName = 'Dropdown';
export default Dropdown;