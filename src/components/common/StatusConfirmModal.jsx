import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

export default function StatusConfirmModal({ isOpen, onClose, onConfirm, isActivating, productName }) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expectedWord = isActivating ? 'Active' : 'Inactive';

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputValue !== expectedWord) {
      setError(`Please type exactly "${expectedWord}" to confirm.`);
      return;
    }
    
    setIsSubmitting(true);
    await onConfirm();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden my-auto border border-slate-200">
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${isActivating ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
          <div className={`p-2 rounded-xl ${isActivating ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{isActivating ? 'Activate Product' : 'Deactivate Product'}</h2>
            <p className="text-xs text-slate-500 font-medium">Are you sure you want to proceed?</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            You are about to {isActivating ? 'activate' : 'deactivate'} <span className="font-bold text-slate-900">{productName}</span>. 
            {isActivating 
              ? ' This will make the product available for sale.' 
              : ' This will hide the product from sales and prevent new orders.'}
          </p>

          <div className="mb-6">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Type <span className="text-slate-900 font-black px-1.5 py-0.5 bg-slate-100 rounded">{expectedWord}</span> to confirm
            </label>
            <input
              type="text"
              autoComplete="off"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all font-medium text-slate-900"
              placeholder={expectedWord}
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                if (error) setError('');
              }}
            />
            {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button 
              type="submit" 
              className={`border-none ${isActivating ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
              disabled={isSubmitting || inputValue !== expectedWord}
            >
              {isActivating ? 'Activate' : 'Deactivate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
