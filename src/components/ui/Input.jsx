import { forwardRef } from 'react';

export const Input = forwardRef(({
    label,
    error,
    className = '',
    containerClassName = '',
    id,
    type = 'text',
    icon: Icon,
    actionIcon: ActionIcon,
    onAction,
    ...props
}, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

    return (
        <div className={`space-y-1.5 ${containerClassName}`}>
            {label && (
                <label htmlFor={inputId} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    {label} {props.required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Icon size={16} />
                    </div>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    type={type}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors disabled:opacity-50 disabled:bg-slate-50 ${error
                        ? 'border-red-300 text-red-900 placeholder-red-300'
                        : 'border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400'
                        } ${Icon ? 'pl-9' : ''} ${ActionIcon ? 'pr-12 rounded-r-none' : ''} ${className}`}
                    {...props}
                />
                {ActionIcon && (
                    <button
                        type="button"
                        onClick={onAction}
                        className={`absolute inset-y-0 right-0 w-10 flex items-center justify-center bg-slate-50 border border-l-0 ${error ? 'border-red-300' : 'border-slate-200'
                            } text-slate-500 rounded-r-lg hover:bg-slate-100 transition-colors cursor-pointer`}
                    >
                        <ActionIcon size={16} />
                    </button>
                )}
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>
    );
});

Input.displayName = 'Input';
