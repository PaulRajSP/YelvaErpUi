import { forwardRef } from 'react';

export const Card = forwardRef(({ className = '', children, ...props }, ref) => (
 <div
 ref={ref}
 className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}
 {...props}
 >
 {children}
 </div>
));
Card.displayName = 'Card';

export const CardHeader = forwardRef(({ className = '', children, ...props }, ref) => (
 <div
 ref={ref}
 className={`px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between ${className}`}
 {...props}
 >
 {children}
 </div>
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ className = '', children, ...props }, ref) => (
 <h3
 ref={ref}
 className={`font-bold text-slate-900 text-sm ${className}`}
 {...props}
 >
 {children}
 </h3>
));
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef(({ className = '', children, ...props }, ref) => (
 <div ref={ref} className={`p-5 ${className}`} {...props}>
 {children}
 </div>
));
CardContent.displayName = 'CardContent';
