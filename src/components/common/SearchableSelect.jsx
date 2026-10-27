import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const SearchableSelect = ({ value, onChange, options, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setActiveIndex(-1);
    }, [search, isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                onChange(filteredOptions[activeIndex]);
                setIsOpen(false);
                setSearch('');
            } else if (filteredOptions.length > 0) {
                onChange(filteredOptions[0]);
                setIsOpen(false);
                setSearch('');
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={wrapperRef} onKeyDown={handleKeyDown}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg flex justify-between items-center transition-colors ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-70' : 'cursor-pointer focus-within:ring-2 focus-within:ring-slate-500/50 focus-within:border-slate-500'}`}
                tabIndex={disabled ? -1 : 0}
            >
                <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value || placeholder}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg max-h-48 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-slate-200">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-slate-500 /50 transition-colors"
                        />
                    </div>
                    <div className="overflow-y-auto max-h-36">
                        {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                            <div
                                key={opt}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                onMouseEnter={() => setActiveIndex(idx)}
                                className={`px-3 py-2 text-sm cursor-pointer ${activeIndex === idx
                                    ? 'bg-slate-100 text-slate-900 font-medium'
                                    : value === opt
                                        ? 'bg-slate-50 text-slate-900 font-medium'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {opt}
                            </div>
                        )) : (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
