import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { FileDown, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export const AdminImportCenter: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    const res = await apiRequest('/api/imports/batches');
    if (res.success) setBatches(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleExpand = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }
    setExpandedBatchId(batchId);
    setRecordsLoading(true);
    const res = await apiRequest(`/api/imports/batches/${batchId}`);
    if (res.success) setRecords(res.data.records);
    setRecordsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileDown className="text-blue-600" />
          مرکز مدیریت و پایش داده‌های ورودی (Import Center)
        </h2>
        <button onClick={fetchBatches} className="p-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <RefreshCw size={18} /> به‌روزرسانی
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">در حال دریافت...</div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div 
                className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                onClick={() => handleExpand(batch.id)}
              >
                <div>
                  <h3 className="font-bold text-lg text-gray-800">بسته ورود داده {batch.id}</h3>
                  <div className="text-sm text-gray-500 mt-1 flex gap-4">
                    <span>منبع: {batch.source}</span>
                    <span>تاریخ: {new Date(batch.createdAt).toLocaleString('fa-IR')}</span>
                    <span>ترم: {batch.termId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <span className="block text-gray-500 text-xs">کل رکوردها</span>
                    <span className="font-bold text-gray-800 text-lg">{batch.totalRecords}</span>
                  </div>
                  <div className="text-center text-green-600">
                    <span className="block text-xs opacity-80">موفق (Matched)</span>
                    <span className="font-bold text-lg">{batch.matchedRecords}</span>
                  </div>
                  <div className="text-center text-amber-600">
                    <span className="block text-xs opacity-80">نیاز به بررسی</span>
                    <span className="font-bold text-lg">{batch.reviewRecords}</span>
                  </div>
                  <div className="text-center text-red-600">
                    <span className="block text-xs opacity-80">نامعتبر</span>
                    <span className="font-bold text-lg">{batch.invalidRecords}</span>
                  </div>
                  {expandedBatchId === batch.id ? <ChevronUp size={24} className="text-gray-400" /> : <ChevronDown size={24} className="text-gray-400" />}
                </div>
              </div>

              {expandedBatchId === batch.id && (
                <div className="p-5 border-t border-gray-100 bg-gray-50">
                  {recordsLoading ? (
                    <div className="text-center py-4 text-gray-500">در حال دریافت رکوردها...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 text-gray-600">
                          <tr>
                            <th className="p-3">وضعیت</th>
                            <th className="p-3">کد درس</th>
                            <th className="p-3">نام درس</th>
                            <th className="p-3">گروه</th>
                            <th className="p-3">استاد</th>
                            <th className="p-3">پیام سیستم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {records.map((r: any) => (
                            <tr key={r.id} className="bg-white">
                              <td className="p-3">
                                {r.status === 'MATCHED' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">موفق</span>}
                                {r.status === 'NEEDS_REVIEW' && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs">هشدار</span>}
                                {r.status === 'INVALID' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">خطا</span>}
                              </td>
                              <td className="p-3 font-mono text-gray-600">{r.rawData?.courseCode}</td>
                              <td className="p-3 font-medium">{r.rawData?.courseName}</td>
                              <td className="p-3 text-gray-500">{r.rawData?.group}</td>
                              <td className="p-3 text-gray-500">{r.rawData?.instructor}</td>
                              <td className="p-3 text-xs text-gray-500 max-w-xs truncate" title={r.reviewReason}>{r.reviewReason || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {batches.length === 0 && <div className="text-center py-12 text-gray-500">هیچ بسته‌ای یافت نشد.</div>}
        </div>
      )}
    </div>
  );
};
