import React, { forwardRef } from 'react';
import { PAGE_SIZE } from '../../common/utils';

export const Table = forwardRef(({ className = '', children, ...props }, ref) => (
  <div className={`w-full overflow-x-auto ${className}`}>
    <table ref={ref} className="w-full text-left text-sm text-slate-600 whitespace-nowrap" {...props}>
      {children}
    </table>
  </div>
));
Table.displayName = 'Table';

export const TableHeader = forwardRef(({ className = '', children, ...props }, ref) => (
  <thead ref={ref} className={`bg-slate-50 sticky top-0 border-b border-slate-200 z-10 ${className}`} {...props}>
    {children}
  </thead>
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef(({ className = '', padRows = true, children, ...props }, ref) => {
  let childrenArray = React.Children.toArray(children);

  // Detect empty state row (single row with a colSpan cell)
  let isEmptyState = false;
  let emptyMessage = "No data found.";
  if (childrenArray.length === 1 && React.isValidElement(childrenArray[0])) {
    const row = childrenArray[0];
    const cell = React.Children.toArray(row.props.children)[0];
    if (React.isValidElement(cell) && cell.props.colSpan > 2) {
      isEmptyState = true;
      emptyMessage = cell.props.children;
    }
  }

  const padCount = padRows ? Math.max(0, PAGE_SIZE - childrenArray.length) : 0;

  return (
    <tbody ref={ref} className={`divide-y divide-slate-50 ${className}`} {...props}>
      {childrenArray}
      {padCount > 0 && Array.from({ length: padCount }).map((_, i) => (
        <tr key={`pad-${i}`} className="bg-transparent hover:bg-transparent pointer-events-none">
          <td colSpan={100} className="px-5 py-4 font-medium text-slate-700 text-sm align-middle text-transparent select-none">
            {'\u00A0'}
          </td>
        </tr>
      ))}
    </tbody>
  );
});
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef(({ className = '', children, ...props }, ref) => (
  <tr ref={ref} className={`hover:bg-slate-50/50 transition-colors ${className}`} {...props}>
    {children}
  </tr>
));
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef(({ className = '', align, children, ...props }, ref) => {
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : '';
  return (
    <th
      ref={ref}
      className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
});
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef(({ className = '', align, children, ...props }, ref) => {
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : '';
  return (
    <td
      ref={ref}
      className={`px-5 py-4 font-medium text-slate-700 text-sm align-middle ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
});
TableCell.displayName = 'TableCell';
