import { Info } from 'lucide-react';

export function Tooltip({ children, content, position = 'top' }) {
    const isBottom = position === 'bottom';
    return (
        <div className="group relative inline-flex items-center justify-center">
            {children}
            <div className={`absolute ${isBottom ? 'top-full mt-2' : 'bottom-full mb-2'} hidden group-hover:flex items-center justify-center flex-col z-[9999] pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 ${isBottom ? 'translate-y-[-2px] group-hover:translate-y-0' : 'translate-y-1 group-hover:translate-y-0'}`}>
                {isBottom && <div className="w-2 h-2 bg-slate-900 rotate-45 -mb-1 z-10"></div>}
                <span className="bg-slate-900 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-xl">
                    {content}
                </span>
                {!isBottom && <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1"></div>}
            </div>
        </div>
    );
}

export function InfoTooltip({ content, size = 13, className = '', width = 'w-52' }) {
    return (
        <div className={`group relative inline-flex items-center ${className}`}>
            <Info size={size} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
            <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block ${width} bg-slate-900 text-white text-[11px] font-normal normal-case p-2.5 rounded-xl z-[9999] shadow-xl pointer-events-none leading-relaxed text-center`}>
                {content}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
        </div>
    );
}

export function CompoundTooltip({ children, content, width = 'w-64', position = 'bottom' }) {
    const isBottom = position === 'bottom';
    const isLeft = position === 'left';
    const isRight = position === 'right';

    return (
        <div className="group relative inline-flex items-center justify-center">
            {children}
            <div className={`absolute z-[9999] pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 hidden group-hover:flex flex-col ${
                isBottom
                    ? 'top-full mt-2 right-0 items-end translate-y-[-2px] group-hover:translate-y-0'
                    : isLeft
                        ? 'right-full mr-2 top-1/2 -translate-y-1/2 items-end'
                        : isRight
                            ? 'left-full ml-2 top-1/2 -translate-y-1/2 items-start'
                            : 'bottom-full mb-2 right-0 items-end translate-y-1 group-hover:translate-y-0'
            }`}>
                {isBottom && <div className="w-2.5 h-2.5 bg-white border-t border-l border-slate-200 rotate-45 -mb-1.5 mr-3 z-10" />}
                <div className={`bg-white border border-slate-200 shadow-2xl ${width} rounded-xl p-3 text-left`}>
                    {content}
                </div>
                {!isBottom && !isLeft && !isRight && <div className="w-2.5 h-2.5 bg-white border-b border-r border-slate-200 rotate-45 -mt-1.5 mr-3" />}
            </div>
        </div>
    );
}
