import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    parseISO,
    isValid
} from 'date-fns';

export default function DatePicker({
    value,
    onChange,
    placeholder = "Select date",
    className = "",
    label,
    error,
    required = false,
    disabled = false,
    align = 'auto',
    maxDate
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [openRight, setOpenRight] = useState(align === 'right');
    const [openUpwards, setOpenUpwards] = useState(false);

    // Safely parse the incoming date string
    const parsedDate = value ? (typeof value === 'string' ? parseISO(value) : new Date(value)) : null;
    const initialDate = parsedDate && isValid(parsedDate) ? parsedDate : new Date();
    const parsedMaxDate = maxDate ? (typeof maxDate === 'string' ? parseISO(maxDate) : new Date(maxDate)) : null;
    const validMaxDate = parsedMaxDate && isValid(parsedMaxDate) ? parsedMaxDate : null;

    const [currentMonth, setCurrentMonth] = useState(initialDate);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-black text-slate-900 tracking-tight pl-1">
                    {format(currentMonth, 'MMMM yyyy')}
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        const dateFormat = "eeeeee"; // Su, Mo, Tu...
        const startDate = startOfWeek(currentMonth);
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider py-1">
                    {format(addDays(startDate, i), dateFormat)}
                </div>
            );
        }
        return <div className="grid grid-cols-7 mb-2 gap-1">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, "d");
                const cloneDay = day;
                const isSelected = parsedDate && isValid(parsedDate) && isSameDay(day, parsedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isAfterMaxDate = validMaxDate && day > validMaxDate;
                const isDisabled = !isCurrentMonth || isAfterMaxDate;

                days.push(
                    <button
                        type="button"
                        key={day.toString()}
                        disabled={isDisabled}
                        onClick={() => {
                            if (isDisabled) return;
                            onChange(format(cloneDay, 'yyyy-MM-dd'));
                            setIsOpen(false);
                        }}
                                className={`
                                    aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all
                                    ${isDisabled ? "text-slate-300 cursor-not-allowed opacity-50" : "text-slate-700 hover:bg-slate-100 cursor-pointer"}
                                    ${isSelected ? "bg-slate-900 text-white hover:bg-slate-800" : ""}
                                `}
                    >
                        {formattedDate}
                    </button>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day.toString()} className="grid grid-cols-7 gap-1 mb-1">
                    {days}
                </div>
            );
            days = [];
        }
        return <div>{rows}</div>;
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div ref={wrapperRef} className="relative">
                <div
                    className={`w-full flex items-center justify-between px-3 py-2 border bg-white rounded-lg transition-colors focus:outline-none /50 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'
                        } ${error
                            ? 'border-red-300 focus:border-red-500 text-red-900'
                            : isOpen ? 'border-slate-400' : 'border-slate-200 hover:border-slate-300'
                        }`}
                    onClick={() => {
                        if (disabled) return;
                        if (!isOpen && wrapperRef.current) {
                            const rect = wrapperRef.current.getBoundingClientRect();
                            const spaceRight = window.innerWidth - rect.left;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const dialogOrModal = wrapperRef.current.closest('[role="dialog"], .max-w-lg, .max-w-md, .max-w-xl, .max-w-2xl');
                            const containerRight = dialogOrModal ? dialogOrModal.getBoundingClientRect().right : window.innerWidth;
                            const containerBottom = dialogOrModal ? dialogOrModal.getBoundingClientRect().bottom : window.innerHeight;
                            const spaceInContainerRight = containerRight - rect.left;
                            const spaceInContainerBelow = containerBottom - rect.bottom;

                            setOpenRight(align === 'right' || spaceRight < 300 || spaceInContainerRight < 300);
                            setOpenUpwards(spaceBelow < 320 || spaceInContainerBelow < 320);
                        }
                        setIsOpen(!isOpen);
                    }}
                >
                    <span className={`text-sm truncate ${parsedDate && isValid(parsedDate) ? 'text-slate-900' : 'text-slate-400'}`}>
                        {parsedDate && isValid(parsedDate) ? format(parsedDate, 'dd MMM yyyy') : placeholder}
                    </span>
                    <CalendarIcon size={16} className={`transition-colors ${isOpen ? 'text-slate-700' : 'text-slate-400'}`} />
                </div>

                {isOpen && !disabled && (
                    <div className={`absolute z-50 bg-white border border-slate-200 rounded-xl p-4 w-[280px] ${
                        openUpwards ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
                    } ${
                        openRight || align === 'right' ? 'right-0' : 'left-0 sm:left-0'
                    } animate-in fade-in zoom-in-95 duration-100 shadow-xl`}>
                        {renderHeader()}
                        {renderDays()}
                        {renderCells()}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                className="text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                                onClick={() => { onChange(''); setIsOpen(false); }}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                                onClick={() => {
                                    onChange(format(new Date(), 'yyyy-MM-dd'));
                                    setIsOpen(false);
                                    setCurrentMonth(new Date());
                                }}
                            >
                                Today
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>
    );
}
