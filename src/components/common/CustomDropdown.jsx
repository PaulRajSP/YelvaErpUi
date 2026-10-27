import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export default function CustomDropdown({ value, onChange, options, disabled, className, onAddNew, addNewLabel = "+ Create New" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const ref = useRef(null);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : value;

    useEffect(() => {
        if (isOpen && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            // close if clicked outside BOTH the button and the portal dropdown
            if (ref.current && !ref.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        // Close on scroll of any container to prevent detached dropdowns
        const handleScroll = (event) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true); // capture phase

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className || ''}`} ref={ref}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full h-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400 ${disabled ? 'bg-slate-50 cursor-not-allowed text-slate-500 font-medium' : 'bg-white cursor-pointer hover:border-slate-300'} transition-colors`}
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-lg py-1 max-h-48 overflow-y-auto mt-1"
                    style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                >
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors cursor-pointer ${value === opt.value ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    {onAddNew && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                onAddNew();
                            }}
                            className="w-full text-left px-3 py-2 text-[13px] font-bold text-indigo-600 hover:bg-indigo-50 border-t border-slate-200 transition-colors cursor-pointer mt-1"
                        >
                            {addNewLabel}
                        </button>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
