'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from 'recharts'

interface Props { data: { name: string; number: number }[] }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl border border-gray-700 bg-gray-900 shadow-xl px-3 py-2 text-xs"
      style={{ pointerEvents: 'none' }}
    >
      <p className="text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-indigo-300 font-bold text-sm">{payload[0].value} tasks</p>
    </div>
  )
}

export default function WeeklyProgressChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-gray-600">No completions this week</p>
        <p className="text-xs text-gray-700">Tasks you complete will appear here</p>
      </div>
    )
  }

  const max = Math.max(...data.map(d => d.number), 1)
  const allZero = data.every(d => d.number === 0)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, left: -28, bottom: 0 }}
        barCategoryGap="32%"
        barSize={36}
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#818cf8" stopOpacity={1} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.75} />
          </linearGradient>
          <linearGradient id="barGradientPeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c4b5fd" stopOpacity={1} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="barGradientEmpty" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#374151" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#1f2937" stopOpacity={0.4} />
          </linearGradient>
        </defs>

        <CartesianGrid
          vertical={false}
          stroke="#1f2937"
          strokeOpacity={0.8}
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="name"
          tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }}
        />
        <Bar dataKey="number" radius={[6, 6, 2, 2]}>
          {data.map((entry, i) => {
            const isPeak  = entry.number === max && max > 0 && !allZero
            const isEmpty = entry.number === 0
            return (
              <Cell
                key={i}
                fill={
                  isEmpty ? 'url(#barGradientEmpty)' :
                  isPeak  ? 'url(#barGradientPeak)'  :
                             'url(#barGradient)'
                }
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
