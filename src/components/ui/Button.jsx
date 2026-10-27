import { forwardRef } from 'react';

const variants = {
 primary: 'bg-slate-900 text-white hover:bg-slate-800 ',
 secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 ',
 danger: 'bg-red-600 text-white hover:bg-red-700 ',
 ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
 soft: 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200',
};

const sizes = {
 sm: 'px-3 py-1.5 text-xs',
 md: 'px-4 py-2 text-sm',
 lg: 'px-5 py-2.5 text-base',
 icon: 'p-2',
};

export const Button = forwardRef(({ 
 children, 
 variant = 'primary', 
 size = 'md', 
 className = '', 
 disabled = false,
 type = 'button',
 icon: Icon,
 ...props 
}, ref) => {
 return (
 <button
 ref={ref}
 type={type}
 disabled={disabled}
 className={`inline-flex items-center justify-center cursor-pointer font-bold rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
 {...props}
 >
 {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className={children ? 'mr-2' : ''} />}
 {children}
 </button>
 );
});

Button.displayName = 'Button';
