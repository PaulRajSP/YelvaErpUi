import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {
 const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
 const endItem = Math.min(currentPage * itemsPerPage, totalItems);

 // If there are many pages, we might want to truncate, but for now we'll just show all up to a reasonable limit, or just all since this is a simple app.
 const pages = [...Array(totalPages)].map((_, i) => i + 1);

 return (
 <div className="p-4 border-t border-slate-200 text-xs font-medium text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white mt-auto">
 <span>Showing {startItem}-{endItem} of {totalItems}</span>
 <div className="flex items-center gap-1.5">
 <button 
 onClick={() => onPageChange(Math.max(1, currentPage - 1))}
 disabled={currentPage === 1}
 className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
 >
 <ChevronLeft size={16} />
 </button>
 
 {pages.map((page) => (
 <button 
 key={page}
 onClick={() => onPageChange(page)}
 className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
 currentPage === page 
 ? 'bg-slate-900 text-white ' 
 : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
 }`}
 >
 {page}
 </button>
 ))}

 <button 
 onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
 disabled={currentPage === totalPages || totalPages === 0}
 className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
 >
 <ChevronRight size={16} />
 </button>
 </div>
 </div>
 );
}
