import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

export function CandleChart({ data, height = 360 }: { data: Candle[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#cbd5e1",
        fontFamily: "JetBrains Mono, monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,140,40,0.06)" },
        horzLines: { color: "rgba(255,140,40,0.06)" },
      },
      timeScale: {
        borderColor: "rgba(255,140,40,0.25)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(255,140,40,0.25)" },
      crosshair: { mode: 0 },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#34d399",
      downColor: "#fb923c",
      borderUpColor: "#10b981",
      borderDownColor: "#f97316",
      wickUpColor: "#34d399",
      wickDownColor: "#fb923c",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(
      data.map((c) => ({
        time: c.time as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
