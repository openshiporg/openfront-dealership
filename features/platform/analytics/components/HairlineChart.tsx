'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

/**
 * Dense hairline bar chart: square bars no wider than 10px, a 1px solid baseline, faint 1px gridlines,
 * 11px tabular ticks. One bar can be set in full ink (the current month or the bucket that needs attention);
 * the rest sit in a lighter ink, so the chart never relies on hue.
 */
export function HairlineChart<T extends object>({
  data,
  xKey,
  yKey,
  label,
  format = value => String(value),
  highlight,
  height = 168,
  yWidth = 36,
  className,
}: {
  data: T[]
  xKey: keyof T & string
  yKey: keyof T & string
  label: string
  format?: (value: number) => string
  highlight?: (row: T) => boolean
  height?: number
  yWidth?: number
  className?: string
}) {
  const config = { [yKey]: { label, color: 'var(--foreground)' } }
  return (
    <ChartContainer config={config} className={cn('aspect-auto w-full', className)} style={{ height }}>
      <BarChart data={data} margin={{ left: 0, right: 4, top: 6, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={{ stroke: 'var(--foreground)', strokeOpacity: 0.45, strokeWidth: 1 }}
          tick={{ fontSize: 11 }}
          tickMargin={6}
          minTickGap={10}
          interval="preserveStartEnd"
        />
        <YAxis
          width={yWidth}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickCount={4}
          allowDecimals={false}
          tickFormatter={value => format(Number(value))}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={value => (
                <span className="flex w-full items-baseline justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums text-foreground">{format(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey={yKey} radius={0} maxBarSize={10} isAnimationActive={false}>
          {data.map((row, index) => (
            <Cell
              key={index}
              fill={highlight?.(row) ? 'var(--foreground)' : 'color-mix(in oklab, var(--foreground) 32%, transparent)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
