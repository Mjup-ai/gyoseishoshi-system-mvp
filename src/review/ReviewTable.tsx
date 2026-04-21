import { useState } from 'react';
import type { StaffRuleResult } from '../domain/types';

interface Props {
  staffResults: StaffRuleResult[];
  onConfirm: (confirmed: Record<string, { weeklyHours: number; fte: number }>) => void;
}

const STATUS_ICON = { ok: '🟢', warn: '🟡', danger: '🔴' } as const;

export function ReviewTable({ staffResults, onConfirm }: Props) {
  const [draft, setDraft] = useState<Record<string, { weeklyHours: number; fte: number }>>(
    Object.fromEntries(staffResults.map((r) => [r.staffId, { weeklyHours: r.weeklyHours, fte: r.fte }]))
  );

  const handleChange = (staffId: string, key: 'weeklyHours' | 'fte', value: string) => {
    setDraft((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], [key]: Number(value) || 0 },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3">状態</th>
              <th className="py-2 pr-3">氏名</th>
              <th className="py-2 pr-3">職種</th>
              <th className="py-2 pr-3 w-24">週時間</th>
              <th className="py-2 pr-3 w-20">FTE</th>
              <th className="py-2">警告</th>
            </tr>
          </thead>
          <tbody>
            {staffResults.map((row) => (
              <tr key={row.staffId} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-lg">{STATUS_ICON[row.status]}</td>
                <td className="py-2 pr-3 font-medium text-slate-800">{row.name}</td>
                <td className="py-2 pr-3 text-slate-600">{row.position ?? '—'}</td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    step="0.5"
                    value={draft[row.staffId]?.weeklyHours ?? row.weeklyHours}
                    onChange={(e) => handleChange(row.staffId, 'weeklyHours', e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    step="0.01"
                    value={draft[row.staffId]?.fte ?? row.fte}
                    onChange={(e) => handleChange(row.staffId, 'fte', e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 text-xs text-amber-600">
                  {row.warnings.length > 0 ? row.warnings.join(' / ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => onConfirm(draft)}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
      >
        確定して出力へ進む
      </button>
    </div>
  );
}
