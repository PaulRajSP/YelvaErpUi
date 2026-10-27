import { useState, useEffect } from 'react';
import { productApi } from '../../api/productApi';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Package, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ComboProductView({ product }) {
  const [comboItems, setComboItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (product?.id || product?.edid) {
      const pid = product.id || product.edid;
      productApi.getComboItems(pid)
        .then(res => {
          setComboItems(res?.data?.items || res?.items || []);
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    }
  }, [product]);

  return (
    <Card className="flex flex-col h-full border border-slate-200">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Gift size={16} className="text-purple-600" />
          Combo Package Contents
        </h3>
        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[10px] font-bold">
          {comboItems.length} Items
        </span>
      </div>

      <div className="p-4 bg-slate-50/30 overflow-x-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 mt-4 text-sm font-medium">Loading contents...</p>
          </div>
        ) : comboItems.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-left py-3 font-semibold text-slate-600">Product</TableHead>
                  <TableHead className="text-left py-3 font-semibold text-slate-600">SKU</TableHead>
                  <TableHead className="text-center py-3 font-semibold text-slate-600">Quantity</TableHead>
                  <TableHead className="text-center py-3 font-semibold text-slate-600">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody padRows={false}>
                {comboItems.map((item, idx) => (
                  <TableRow
                    key={idx}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/products/${item.productEdid}`)}
                  >
                    <TableCell className="font-medium text-slate-800">
                      {item.productName || item.productEdid}
                    </TableCell>
                    <TableCell className="text-slate-500 font-medium">
                      {item.sku || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-slate-700">{item.unitCount} × </span>
                      <span className="font-bold text-slate-700">{item.quantity}</span>
                      <span className="text-slate-500 ml-1 text-xs">{item.unitSymbol}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.active ? (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-bold">Inactive</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 border-dashed rounded-2xl flex flex-col items-center justify-center h-48">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">No Items Found</h3>
            <p className="text-slate-500 text-xs">This combo does not have any items assigned.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
