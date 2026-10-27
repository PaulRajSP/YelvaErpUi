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
    isValid,
    isAfter,
    isBefore
} from 'date-fns';

export default function DateRangePicker({
    startDate,
    endDate,
    onChange,
    placeholder = "Select date range",
    className = "",
    label,
    error,
    required = false,
    disabled = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Step 1: select start date. Step 2: select end date.
    const [selectionStep, setSelectionStep] = useState(0); 
    const [tempStart, setTempStart] = useState(null);
    const [hoverDate, setHoverDate] = useState(null);

    const parsedStart = startDate ? (typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate)) : null;
    const parsedEnd = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : new Date(endDate)) : null;
    
    const initialMonth = parsedStart && isValid(parsedStart) ? parsedStart : new Date();
    const [currentMonth, setCurrentMonth] = useState(initialMonth);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSelectionStep(0);
                setTempStart(null);
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
        const dateFormat = "eeeeee"; 
        const weekStart = startOfWeek(currentMonth);
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider py-1">
                    {format(addDays(weekStart, i), dateFormat)}
                </div>
            );
        }
        return <div className="grid grid-cols-7 mb-2 gap-y-1">{days}</div>;
    };

    const handleDateClick = (day) => {
        if (selectionStep === 0) {
            setTempStart(day);
            setSelectionStep(1);
        } else {
            let finalStart = tempStart;
            let finalEnd = day;
            if (isBefore(day, tempStart)) {
                finalStart = day;
                finalEnd = tempStart;
            }
            
            onChange({ 
                startDate: format(finalStart, 'yyyy-MM-dd'), 
                endDate: format(finalEnd, 'yyyy-MM-dd') 
            });
            
            setSelectionStep(0);
            setTempStart(null);
            setIsOpen(false);
        }
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const calendarStart = startOfWeek(monthStart);
        const calendarEnd = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = calendarStart;
        let formattedDate = "";

        const effectiveStart = selectionStep === 1 ? tempStart : parsedStart;
        const effectiveEnd = selectionStep === 1 ? hoverDate : parsedEnd;

        while (day <= calendarEnd) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, "d");
                const cloneDay = day;
                
                const isCurrentMonth = isSameMonth(day, monthStart);
                
                let isStart = false;
                let isEnd = false;
                let isInRange = false;

                if (effectiveStart && isValid(effectiveStart)) {
                    isStart = isSameDay(day, effectiveStart);
                }
                if (effectiveEnd && isValid(effectiveEnd)) {
                    isEnd = isSameDay(day, effectiveEnd);
                }
                
                if (effectiveStart && effectiveEnd && isValid(effectiveStart) && isValid(effectiveEnd)) {
                    const sortedStart = isBefore(effectiveEnd, effectiveStart) ? effectiveEnd : effectiveStart;
                    const sortedEnd = isBefore(effectiveEnd, effectiveStart) ? effectiveStart : effectiveEnd;
                    
                    if (isAfter(day, sortedStart) && isBefore(day, sortedEnd)) {
                        isInRange = true;
                    }
                    if (isSameDay(day, sortedStart)) isStart = true;
                    if (isSameDay(day, sortedEnd)) isEnd = true;
                }

                // Tailwind classes for the background striping
                let bgWrapperClass = "relative w-full h-full flex items-center justify-center py-1 ";
                if (isInRange) {
                    bgWrapperClass += " bg-blue-50";
                } else if (isStart && !isEnd && effectiveEnd) {
                    // Start of range, extend right
                    bgWrapperClass += isBefore(effectiveEnd, effectiveStart) ? " rounded-r-lg bg-blue-50" : " rounded-l-lg bg-blue-50";
                } else if (isEnd && !isStart && effectiveStart) {
                    // End of range, extend left
                    bgWrapperClass += isBefore(effectiveEnd, effectiveStart) ? " rounded-l-lg bg-blue-50" : " rounded-r-lg bg-blue-50";
                } else if (isStart && isEnd) {
                    bgWrapperClass += " rounded-lg";
                }

                days.push(
                    <div 
                        key={day.toString()} 
                        className={bgWrapperClass}
                        onMouseEnter={() => selectionStep === 1 && setHoverDate(cloneDay)}
                    >
                        <button
                            type="button"
                            onClick={() => handleDateClick(cloneDay)}
                            className={`
                                z-10 w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full transition-all cursor-pointer
                                ${!isCurrentMonth ? "text-slate-300 opacity-50" : "text-slate-700 hover:bg-slate-200"}
                                ${isStart || isEnd ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : ""}
                            `}
                        >
                            {formattedDate}
                        </button>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day.toString()} className="grid grid-cols-7">
                    {days}
                </div>
            );
            days = [];
        }
        return <div>{rows}</div>;
    };

    const displayValue = () => {
        if (parsedStart && isValid(parsedStart) && parsedEnd && isValid(parsedEnd)) {
            return `${format(parsedStart, 'dd MMM yyyy')} - ${format(parsedEnd, 'dd MMM yyyy')}`;
        }
        return placeholder;
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
                    className={`w-full flex items-center justify-between px-3 py-2 border bg-white rounded-lg transition-colors focus:outline-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'
                        } ${error
                            ? 'border-red-300 focus:border-red-500 text-red-900'
                            : isOpen ? 'border-slate-400' : 'border-slate-200 hover:border-slate-300'
                        }`}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(!isOpen);
                            setSelectionStep(0);
                            setTempStart(null);
                        }
                    }}
                >
                    <span className={`text-sm truncate ${parsedStart && isValid(parsedStart) ? 'text-slate-900' : 'text-slate-400'}`}>
                        {displayValue()}
                    </span>
                    <CalendarIcon size={16} className={`transition-colors ${isOpen ? 'text-slate-700' : 'text-slate-400'}`} />
                </div>

                {isOpen && !disabled && (
                    <div className="absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-xl p-4 w-[290px] top-full right-0 sm:left-0 sm:right-auto origin-top animate-in fade-in zoom-in-95 duration-100 shadow-xl">
                        {renderHeader()}
                        {renderDays()}
                        {renderCells()}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                className="text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                                onClick={() => { 
                                    onChange({ startDate: '', endDate: '' }); 
                                    setIsOpen(false);
                                    setSelectionStep(0);
                                    setTempStart(null);
                                }}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                                onClick={() => {
                                    const today = format(new Date(), 'yyyy-MM-dd');
                                    onChange({ startDate: today, endDate: today });
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
