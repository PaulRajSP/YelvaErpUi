import { useState, useEffect } from 'react';
import { X, Save, User, Globe, Building2, Tag, Check, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { productApi } from '../../api/productApi';

const TIERS = [
  { key: 'DIRECT', label: 'Direct Customer', short: 'Direct', Icon: User, colorTheme: 'blue' },
  { key: 'ONLINE', label: 'Online Customer', short: 'Online', Icon: Globe, colorTheme: 'teal' },
  { key: 'WHOLESALE', label: 'Wholesale Customer', short: 'Wholesale', Icon: Building2, colorTheme: 'indigo' },
];

const THEMES = {
  blue: { border: 'border-t-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-500' },
  teal: { border: 'border-t-[#20B2AA]', iconBg: 'bg-teal-50', iconText: 'text-[#20B2AA]' },
  indigo: { border: 'border-t-indigo-500', iconBg: 'bg-indigo-50', iconText: 'text-indigo-500' },
};

export default function EditPricingModal({ isOpen, onClose, product, currentPrices, currentMrps, onSave }) {
  const [formData, setFormData] = useState({
    DIRECT_price: '', DIRECT_mrp: '',
    ONLINE_price: '', ONLINE_mrp: '',
    WHOLESALE_price: '', WHOLESALE_mrp: ''
  });
  const [activeTiers, setActiveTiers] = useState(['DIRECT', 'ONLINE', 'WHOLESALE']);
  const [allowedTiers, setAllowedTiers] = useState(['DIRECT', 'ONLINE', 'WHOLESALE']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboSums, setComboSums] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const extractVal = (val, field) => {
        if (val == null) return '';
        if (typeof val === 'object') return val[field] ?? '';
        return val;
      };

      const dPrice = extractVal(currentPrices?.DIRECT, 'price');
      const dMrp = extractVal(currentMrps?.DIRECT, 'mrp') || extractVal(currentPrices?.DIRECT, 'mrp');
      const oPrice = extractVal(currentPrices?.ONLINE, 'price');
      const oMrp = extractVal(currentMrps?.ONLINE, 'mrp') || extractVal(currentPrices?.ONLINE, 'mrp');
      const wPrice = extractVal(currentPrices?.WHOLESALE, 'price');
      const wMrp = extractVal(currentMrps?.WHOLESALE, 'mrp') || extractVal(currentPrices?.WHOLESALE, 'mrp');

      setFormData({
        DIRECT_price: dPrice, DIRECT_mrp: dMrp,
        ONLINE_price: oPrice, ONLINE_mrp: oMrp,
        WHOLESALE_price: wPrice, WHOLESALE_mrp: wMrp
      });

      const initialActive = [];
      if (dPrice !== '' || dMrp !== '') initialActive.push('DIRECT');
      if (oPrice !== '' || oMrp !== '') initialActive.push('ONLINE');
      if (wPrice !== '' || wMrp !== '') initialActive.push('WHOLESALE');
      
      // Default to DIRECT if nothing is set
      if (initialActive.length === 0) initialActive.push('DIRECT');
      
      setActiveTiers(initialActive);

      if (product?.isCombo) {
        const pid = product.edid || product.id;
        productApi.getComboItems(pid).then(res => {
          const items = res?.data?.items || res?.items || [];
          const sums = {
            DIRECT_price: 0, DIRECT_mrp: 0,
            ONLINE_price: 0, ONLINE_mrp: 0,
            WHOLESALE_price: 0, WHOLESALE_mrp: 0
          };
          items.forEach(item => {
            const qty = parseFloat(item.unitCount) || parseFloat(item.quantity) || 1;
            const prizes = item.prize || item.pricing || [];
            prizes.forEach(p => {
              const cType = (p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim();
              if (sums[`${cType}_price`] !== undefined) {
                sums[`${cType}_price`] += (parseFloat(p.price) || 0) * qty;
                sums[`${cType}_mrp`] += (parseFloat(p.mrp) || 0) * qty;
              }
            });
          });
          setComboSums(sums);

          // Find common customer types across all combo items
          let commonTiers = [];
          if (items.length > 0) {
            commonTiers = ['DIRECT', 'ONLINE', 'WHOLESALE'].filter(tierKey => {
              // check if this tierKey exists in EVERY combo item
              return items.every(item => {
                const prizes = item.prize || item.pricing || item.prices || [];
                return prizes.some(p => ((p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim()) === tierKey && (p.price != null || p.mrp != null));
              });
            });
          }
          setAllowedTiers(commonTiers);
          setActiveTiers(prev => prev.filter(t => commonTiers.includes(t)));
        }).catch(err => console.error('Failed to fetch combo items for sum', err));
      } else {
        setComboSums(null);
        setAllowedTiers(['DIRECT', 'ONLINE', 'WHOLESALE']);
      }
    }
  }, [isOpen, currentPrices, currentMrps, product]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Construct payload
    const items = [];
    for (const tier of TIERS) {
      if (activeTiers.includes(tier.key)) {
        const price = formData[`${tier.key}_price`];
        const mrp = product?.isCombo ? (comboSums?.[`${tier.key}_mrp`] ?? 0) : formData[`${tier.key}_mrp`];
        items.push({
          customerType: tier.key,
          price: price !== '' && price != null ? Number(price) : null,
          mrp: mrp !== '' && mrp != null ? Number(mrp) : null
        });
      }
    }
    
    await onSave({ items });
    setIsSubmitting(false);
  };

  const toggleTier = (tierKey) => {
    setActiveTiers(prev => 
      prev.includes(tierKey) 
        ? prev.filter(k => k !== tierKey) 
        : [...prev, tierKey]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto border border-slate-200 flex flex-col">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h2 className="text-lg font-black text-slate-900">Update Pricing</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {/* CUSTOMER TYPES HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50 mt-0.5">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Allowed Customer Types</h3>
                <p className="text-sm text-slate-500 font-medium">Select available customer types.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {TIERS.map(t => {
                const isActive = activeTiers.includes(t.key);
                const isAllowed = allowedTiers.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => isAllowed && toggleTier(t.key)}
                    disabled={!isAllowed}
                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-full shadow-sm transition-colors ${
                      !isAllowed ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' :
                      isActive ? 'border-blue-100 bg-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                      !isAllowed ? 'bg-slate-300' :
                      isActive ? 'bg-blue-600' : 'bg-slate-300'
                    }`}>
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                    <span className={`text-sm font-bold transition-colors ${
                      !isAllowed ? 'text-slate-400' :
                      isActive ? 'text-blue-600' : 'text-slate-400'
                    }`}>{t.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px w-full bg-slate-100"></div>

          {/* PRICING HEADER */}
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 flex items-center justify-center mt-0.5">
              <Tag size={20} className="text-slate-400 -scale-x-100" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pricing</h3>
              <p className="text-sm text-slate-500 font-medium">Set MRP and selling rate for each customer type.</p>
            </div>
          </div>

          {/* 3 COLUMN GRID */}
          <div className="grid grid-cols-3 gap-5">
            {TIERS.map(({ key, label, Icon, colorTheme }) => {
              const theme = THEMES[colorTheme];
              const isActive = activeTiers.includes(key);
              const isAllowed = allowedTiers.includes(key);

              if (!isAllowed) {
                return (
                  <div key={key} className="border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center py-12 opacity-50">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mb-3">
                      <Icon size={18} className="text-slate-400" />
                    </div>
                    <h4 className="text-[13px] font-black text-slate-400 text-center px-4">Pricing Unavailable</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 text-center px-4 leading-relaxed">Not available on all combo items</p>
                  </div>
                );
              }

              if (!isActive) {
                return (
                  <div key={key} className="border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center py-12 opacity-60">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mb-3">
                      <Icon size={18} className="text-slate-400" />
                    </div>
                    <h4 className="text-[13px] font-black text-slate-400">{label} Disabled</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Enable to set pricing</p>
                  </div>
                );
              }

              return (
                <div key={key} className={`border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm flex flex-col border-t-[3px] ${theme.border}`}>
                  <div className="px-5 py-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${theme.iconBg} flex items-center justify-center`}>
                      <Icon size={16} className={theme.iconText} />
                    </div>
                    <h4 className="text-[13px] font-black text-slate-800">{label}</h4>
                  </div>
                  
                  <div className="px-5 pb-5 flex flex-col gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>MRP (₹) {!product?.isCombo && <span className="text-red-500">*</span>}</span>
                        {product?.isCombo && <span className="text-[9px] text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">Auto Sum</span>}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-400 font-medium text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          className={`w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium transition-all ${
                            product?.isCombo ? 'text-slate-400 bg-slate-50/50 cursor-not-allowed border-dashed' : 'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-500'
                          }`}
                          placeholder="0.00"
                          value={product?.isCombo ? (comboSums?.[`${key}_mrp`] ?? 0) : formData[`${key}_mrp`]}
                          onChange={e => !product?.isCombo && setFormData({ ...formData, [`${key}_mrp`]: e.target.value })}
                          readOnly={product?.isCombo}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        SELLING RATE (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-400 font-medium text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                          placeholder="0.00"
                          value={formData[`${key}_price`]}
                          onChange={e => setFormData({ ...formData, [`${key}_price`]: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-5 border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" icon={Save} disabled={isSubmitting}>Save Pricing</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
