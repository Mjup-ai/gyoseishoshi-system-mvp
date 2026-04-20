import { useMemo, useState } from 'react'

import type { CommonModel } from '../domain/types'
import { buildReviewRows } from './buildReviewRows'

type Props = {
  model: CommonModel
  onConfirm: (payload: Record<string, { weeklyHours: number; fte: number }>) => void
}

export function ReviewTable({ model, onConfirm }: Props) {
  const rows = useMemo(() => buildReviewRows(model), [model])
  const [draft, setDraft] = useState<Record<string, { weeklyHours: number; fte: number }>>(
    Object.fromEntries(rows.map((row) => [row.staffId, { weeklyHours: row.weeklyHours, fte: row.fte }])),
  )

  const handleChange = (staffId: string, key: 'weeklyHours' | 'fte', value: string) => {
    setDraft((current) => ({
      ...current,
      [staffId]: {
        ...current[staffId],
        [key]: Number(value),
      },
    }))
  }

  return (
    <div className="review-table-wrap">
      <table className="review-table">
        <thead>
          <tr>
            <th>状態</th>
            <th>氏名</th>
            <th>職種</th>
            <th>週時間</th>
            <th>FTE</th>
            <th>warning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.staffId}>
              <td>
                {row.status === 'danger' ? '🔴' : row.status === 'warn' ? '🟡' : '🟢'}
              </td>
              <td>{row.name}</td>
              <td>{row.position ?? '-'}</td>
              <td>
                <input
                  value={draft[row.staffId]?.weeklyHours ?? row.weeklyHours}
                  onChange={(event) => handleChange(row.staffId, 'weeklyHours', event.target.value)}
                />
              </td>
              <td>
                <input
                  value={draft[row.staffId]?.fte ?? row.fte}
                  onChange={(event) => handleChange(row.staffId, 'fte', event.target.value)}
                />
              </td>
              <td>{row.warnings.join(' / ') || '問題なし'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="confirm-button" onClick={() => onConfirm(draft)}>
        確定
      </button>
    </div>
  )
}
