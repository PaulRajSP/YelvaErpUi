import { Info } from 'lucide-react';

export function Tooltip({ children, content }) {
    return (
        <div className="group relative inline-flex items-center justify-center">
            {children}
            <div className="absolute bottom-full mb-2 hidden group-hover:flex items-center justify-center flex-col z-50 pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0">
                <span className="bg-slate-900 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg whitespace-nowrap">
                    {content}
                </span>
                <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1"></div>
            </div>
        </div>
    );
}

export function InfoTooltip({ content, size = 13, className = '', width = 'w-52' }) {
    return (
        <div className={`group relative inline-flex items-center ${className}`}>
            <Info size={size} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
            <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block ${width} bg-slate-900 text-white text-[11px] font-normal normal-case p-2.5 rounded-xl z-30 shadow-xl pointer-events-none leading-relaxed text-center`}>
                {content}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
        </div>
    );
}
