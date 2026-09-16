import type { Candle } from "@/components/CandleChart";

type Record = { amount: number; kind: "income" | "expense"; recorded_at: string };

/** Agrupa registros por día y construye velas: open=balance previo, close=balance acumulado del día,
 * high/low según fluctuación intradía simulada por orden de inserción. */
export function buildCandles(records: Record[]): Candle[] {
  if (records.length === 0) return [];
  const sorted = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const byDay = new Map<string, Record[]>();
  for (const r of sorted) {
    const d = new Date(r.recorded_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const arr = byDay.get(key) ?? [];
    arr.push(r);
    byDay.set(key, arr);
  }
  const candles: Candle[] = [];
  let balance = 0;
  const days = Array.from(byDay.keys()).sort();
  for (const day of days) {
    const open = balance;
    let high = balance;
    let low = balance;
    for (const r of byDay.get(day)!) {
      balance += r.kind === "income" ? Number(r.amount) : -Number(r.amount);
      if (balance > high) high = balance;
      if (balance < low) low = balance;
    }
    const close = balance;
    const time = Math.floor(new Date(day + "T00:00:00Z").getTime() / 1000);
    candles.push({ time, open, high, low, close });
  }
  return candles;
}
