import { useEffect, useRef } from 'react'
import uPlot from 'uplot'

// Sparkline de throughput en Canvas (uPlot) — real-time, nunca SVG/DOM (D-016).
export function Throughput({ t, bytes }: { t: number[]; bytes: number[] }): JSX.Element {
  const el = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)

  useEffect(() => {
    if (!el.current) return
    const opts: uPlot.Options = {
      width: el.current.clientWidth || 420,
      height: 64,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [{ show: false }, { show: false }],
      series: [
        {},
        {
          stroke: 'rgb(53, 224, 208)',
          fill: 'rgba(53, 224, 208, 0.18)',
          width: 1.8,
          points: { show: false }
        }
      ]
    }
    plot.current = new uPlot(opts, [t, bytes], el.current)
    const onResize = (): void => plot.current?.setSize({ width: el.current!.clientWidth, height: 64 })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      plot.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    plot.current?.setData([t, bytes])
  }, [t, bytes])

  return <div ref={el} style={{ width: '100%' }} />
}
