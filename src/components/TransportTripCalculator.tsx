import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ClipboardList,
  FileDown,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Receipt,
  Route,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  computeTransportTripMetrics,
  validateTransportTrip,
  type TransportCargoItem,
  type TransportExpense,
  type TransportTrip,
} from "@/lib/transport-analytics";
import { toast } from "sonner";
import { generateTransportTripReport, type ReportProfile } from "@/lib/pdf-report";

const EXPENSE_CATEGORIES = [
  "ACPM / combustible",
  "Peajes",
  "Cargue y descargue",
  "Viáticos y alimentación",
  "Nómina / conductor",
  "Mantenimiento y llantas",
  "Parqueadero",
  "Seguro / escolta",
  "Comisión / despacho",
  "Otros costos del viaje",
];
const CHART_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#2dd4bf"];
const tooltipStyle = {
  background: "#0a0a14",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  color: "#f8fafc",
};

function localToday() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function newCargoItem(): TransportCargoItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    document: "",
    packages: 0,
    weightKg: 0,
    declaredValueCop: 0,
    delivered: false,
  };
}

function newExpense(): TransportExpense {
  return {
    id: crypto.randomUUID(),
    category: EXPENSE_CATEGORIES[0],
    amountCop: 0,
    note: "",
    paidFromDriverCash: true,
  };
}

function blankTrip(): TransportTrip {
  return {
    id: "",
    tripDate: localToday(),
    origin: "",
    destination: "",
    vehiclePlate: "",
    driverName: "",
    loadedKm: 0,
    emptyKm: 0,
    capacityKg: 0,
    fuelLiters: 0,
    cargoItems: [],
    freightCop: 0,
    surchargeCop: 0,
    customerAdvanceCop: 0,
    customerFinalPaymentCop: 0,
    otherCustomerCollectionCop: 0,
    customerWithheldCop: 0,
    driverAdvanceCop: 0,
    driverCashReturnedCop: 0,
    expenses: [],
  };
}

function formatCOP(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/D";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUnitCOP(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/D";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value)
    ? "N/D"
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(value);
}

function asJsonObject(value: Json, label: string): { [key: string]: Json | undefined } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Hay datos inválidos en ${label}.`);
  }
  return value;
}

function jsonNumber(value: Json | undefined, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`El valor numérico de ${label} no es válido.`);
  }
  return value;
}

function jsonString(value: Json | undefined, label: string) {
  if (typeof value !== "string") throw new Error(`El texto de ${label} no es válido.`);
  return value;
}

function parseCargoItems(value: Json): TransportCargoItem[] {
  if (!Array.isArray(value)) throw new Error("El manifiesto guardado no tiene un formato válido.");
  return value.map((entry, index) => {
    const item = asJsonObject(entry, `la carga ${index + 1}`);
    if (typeof item.delivered !== "boolean") {
      throw new Error(`El estado de entrega de la carga ${index + 1} no es válido.`);
    }
    return {
      id: jsonString(item.id, `la carga ${index + 1}`),
      description: jsonString(item.description, `la carga ${index + 1}`),
      document: jsonString(item.document, `la referencia de carga ${index + 1}`),
      packages: jsonNumber(item.packages, `los bultos de la carga ${index + 1}`),
      weightKg: jsonNumber(item.weightKg, `el peso de la carga ${index + 1}`),
      declaredValueCop: jsonNumber(item.declaredValueCop, `el valor de la carga ${index + 1}`),
      delivered: item.delivered,
    };
  });
}

function parseExpenses(value: Json): TransportExpense[] {
  if (!Array.isArray(value)) throw new Error("Los gastos del viaje no tienen un formato válido.");
  return value.map((entry, index) => {
    const expense = asJsonObject(entry, `el gasto ${index + 1}`);
    if (typeof expense.paidFromDriverCash !== "boolean") {
      throw new Error(`El tipo de pago del gasto ${index + 1} no es válido.`);
    }
    return {
      id: jsonString(expense.id, `el gasto ${index + 1}`),
      category: jsonString(expense.category, `el gasto ${index + 1}`),
      amountCop: jsonNumber(expense.amountCop, `el valor del gasto ${index + 1}`),
      note: jsonString(expense.note, `el detalle del gasto ${index + 1}`),
      paidFromDriverCash: expense.paidFromDriverCash,
    };
  });
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step = "any",
  required = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-slate-300">{label}</span>
      <span className="relative block">
        <input
          type="number"
          min={min}
          step={step}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          className="input-neon w-full pr-14"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="input-neon w-full"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono text-lg font-semibold ${emphasis ? "text-neon" : "text-foreground"}`}
      >
        {value}
      </div>
      {detail && <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function TransportTripCalculator({
  userId,
  profile,
}: {
  userId: string;
  profile: ReportProfile;
}) {
  const [trip, setTrip] = useState<TransportTrip>(blankTrip);
  const [targetMarginPct, setTargetMarginPct] = useState(10);
  const [trips, setTrips] = useState<TransportTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeTransportTripMetrics(trip, targetMarginPct),
    [trip, targetMarginPct],
  );
  const cargoOverCapacity = metrics.loadUtilizationPct !== null && metrics.loadUtilizationPct > 100;
  const expenseChart = metrics.expenseBreakdown.filter((item) => item.amountCop > 0);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const pageSize = 1000;
      const rows: TransportTrip[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("transport_trips")
          .select("*")
          .eq("user_id", userId)
          .order("trip_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []).map((row) => ({
          id: row.id,
          tripDate: row.trip_date,
          origin: row.origin,
          destination: row.destination,
          vehiclePlate: row.vehicle_plate ?? "",
          driverName: row.driver_name ?? "",
          loadedKm: Number(row.loaded_km),
          emptyKm: Number(row.empty_km),
          capacityKg: Number(row.capacity_kg ?? 0),
          fuelLiters: Number(row.fuel_liters),
          cargoItems: parseCargoItems(row.cargo_items),
          freightCop: Number(row.freight_cop),
          surchargeCop: Number(row.surcharge_cop),
          customerAdvanceCop: Number(row.customer_advance_cop),
          customerFinalPaymentCop: Number(row.customer_final_payment_cop),
          otherCustomerCollectionCop: Number(row.other_customer_collection_cop),
          customerWithheldCop: Number(row.customer_withheld_cop),
          driverAdvanceCop: Number(row.driver_advance_cop),
          driverCashReturnedCop: Number(row.driver_cash_returned_cop),
          expenses: parseExpenses(row.expenses),
        }));
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      setTrips(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cargar el historial de viajes.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const changeTrip = <K extends keyof TransportTrip>(key: K, value: TransportTrip[K]) =>
    setTrip((current) => ({ ...current, [key]: value }));

  const changeCargo = (
    itemId: string,
    key: keyof TransportCargoItem,
    value: string | number | boolean,
  ) =>
    setTrip((current) => ({
      ...current,
      cargoItems: current.cargoItems.map((item) =>
        item.id === itemId ? { ...item, [key]: value } : item,
      ),
    }));

  const changeExpense = (
    expenseId: string,
    key: keyof TransportExpense,
    value: string | number | boolean,
  ) =>
    setTrip((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === expenseId ? { ...expense, [key]: value } : expense,
      ),
    }));

  const saveTrip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateTransportTrip(trip);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const tripPayload = {
        trip_date: trip.tripDate,
        origin: trip.origin.trim(),
        destination: trip.destination.trim(),
        vehicle_plate: trip.vehiclePlate.trim() ? trip.vehiclePlate.trim().toUpperCase() : null,
        driver_name: trip.driverName.trim() || null,
        loaded_km: trip.loadedKm,
        empty_km: trip.emptyKm,
        capacity_kg: trip.capacityKg > 0 ? trip.capacityKg : null,
        fuel_liters: trip.fuelLiters,
        cargo_items: trip.cargoItems.filter(
          (item) =>
            item.description.trim() ||
            item.document.trim() ||
            item.packages > 0 ||
            item.weightKg > 0 ||
            item.declaredValueCop > 0,
        ),
        freight_cop: trip.freightCop,
        surcharge_cop: trip.surchargeCop,
        customer_advance_cop: trip.customerAdvanceCop,
        customer_final_payment_cop: trip.customerFinalPaymentCop,
        other_customer_collection_cop: trip.otherCustomerCollectionCop,
        customer_withheld_cop: trip.customerWithheldCop,
        driver_advance_cop: trip.driverAdvanceCop,
        driver_cash_returned_cop: trip.driverCashReturnedCop,
        expenses: trip.expenses,
      };
      const result = trip.id
        ? await supabase
            .from("transport_trips")
            .update(tripPayload)
            .eq("id", trip.id)
            .eq("user_id", userId)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("transport_trips")
            .insert({ ...tripPayload, user_id: userId })
            .select("id")
            .maybeSingle();
      const { data, error } = result;
      if (error) throw error;
      if (!data)
        throw new Error(
          "El viaje no se guardó; verifica que el perfil siga en el sector Transporte.",
        );
      toast.success(
        trip.id
          ? "Viaje actualizado."
          : "Viaje guardado en el control independiente de transporte.",
      );
      setTrip(blankTrip());
      await loadTrips();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el viaje.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTrip = async (tripId: string) => {
    if (
      !window.confirm(
        "¿Eliminar este viaje y su manifiesto de carga? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase
        .from("transport_trips")
        .delete()
        .eq("id", tripId)
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("Viaje eliminado.");
      await loadTrips();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el viaje.");
    }
  };

  const exportTripPdf = (tripToExport: TransportTrip, validate = true) => {
    if (validate) {
      const validationError = validateTransportTrip(tripToExport);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }
    try {
      generateTransportTripReport({ profile, trip: tripToExport, targetMarginPct });
      toast.success("Reporte PDF de CalcuTrans generado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte PDF.");
    }
  };

  const historyChart = useMemo(
    () =>
      trips
        .slice(0, 12)
        .reverse()
        .map((savedTrip) => {
          const savedMetrics = computeTransportTripMetrics(savedTrip, targetMarginPct);
          return {
            label: `${savedTrip.tripDate.slice(5)} ${savedTrip.origin.slice(0, 8)}–${savedTrip.destination.slice(0, 8)}`,
            "Flete + recargos": savedMetrics.contractRevenueCop,
            "Costo directo": savedMetrics.tripCostsCop,
            "Utilidad operativa": savedMetrics.operatingProfitCop,
          };
        }),
    [trips, targetMarginPct],
  );

  return (
    <section className="glass space-y-5 p-5 lg:col-span-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="rounded-lg border border-neon/25 bg-neon/10 p-2 text-neon">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Control operativo y financiero de carga</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Módulo exclusivo de Transporte. Los viajes y manifiestos se guardan en una tabla
              propia; no se mezclan con movimientos manuales, análisis OCR ni otros sectores.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadTrips()}
          disabled={loading}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar viajes"}
        </button>
      </header>

      <div className="rounded-md border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
        Análisis gerencial en COP: no liquida ni estima IVA, retenciones, ICA, renta, costos
        financieros, depreciación o costos fijos. Registra retenciones solo según certificados
        recibidos e incluye los costos que ingreses. El manifiesto es auxiliar y no reemplaza
        remesa, manifiesto ni documentos exigidos.
      </div>
      {metrics.tripCostsCop === 0 && (
        <p className="rounded-md border border-sky-400/20 bg-sky-400/[0.04] px-3 py-2 text-[11px] leading-relaxed text-sky-100/80">
          Aún no registras costos: la utilidad mostrada equivale al flete ingresado y no representa
          la rentabilidad completa del viaje.
        </p>
      )}

      <form onSubmit={saveTrip} className="space-y-5">
        <section className="space-y-3 rounded-lg border border-neon/20 bg-neon/[0.03] p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neon">
              <Route className="h-4 w-4" /> 1. Resumen del viaje
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Para empezar solo necesitas fecha, ruta y valor del flete. Los demás datos son
              opcionales.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-slate-300">Fecha del viaje</span>
              <input
                type="date"
                value={trip.tripDate}
                onChange={(event) => changeTrip("tripDate", event.target.value)}
                className="input-neon w-full"
                required
              />
            </label>
            <TextField
              label="Origen"
              value={trip.origin}
              onChange={(value) => changeTrip("origin", value)}
              placeholder="Ciudad / departamento"
              required
            />
            <TextField
              label="Destino"
              value={trip.destination}
              onChange={(value) => changeTrip("destination", value)}
              placeholder="Ciudad / departamento"
              required
            />
            <NumberField
              label="Flete pactado"
              value={trip.freightCop}
              onChange={(value) => changeTrip("freightCop", value)}
              suffix="COP"
              step="1"
              min={1}
              required
            />
          </div>
          <details className="rounded-md border border-white/10 bg-black/10 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-200">
              Datos del vehículo y recorrido (opcionales)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                label="Placa"
                value={trip.vehiclePlate}
                onChange={(value) => changeTrip("vehiclePlate", value)}
                placeholder="ABC123"
              />
              <TextField
                label="Conductor (opcional)"
                value={trip.driverName}
                onChange={(value) => changeTrip("driverName", value)}
              />
              <NumberField
                label="Capacidad útil del vehículo"
                value={trip.capacityKg}
                onChange={(value) => changeTrip("capacityKg", value)}
                suffix="kg"
              />
              <NumberField
                label="Kilómetros cargado"
                value={trip.loadedKm}
                onChange={(value) => changeTrip("loadedKm", value)}
                suffix="km"
              />
              <NumberField
                label="Kilómetros vacío"
                value={trip.emptyKm}
                onChange={(value) => changeTrip("emptyKm", value)}
                suffix="km"
              />
              <NumberField
                label="Combustible consumido"
                value={trip.fuelLiters}
                onChange={(value) => changeTrip("fuelLiters", value)}
                suffix="litros"
              />
            </div>
          </details>
        </section>

        <details className="rounded-lg border border-white/10 bg-black/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neon">
            2. Manifiesto auxiliar y control de entrega (opcional)
          </summary>
          <section className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neon">
                  <ClipboardList className="h-4 w-4" /> Manifiesto auxiliar y entrega
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  El valor declarado es informativo: no se suma al flete ni a los ingresos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => changeTrip("cargoItems", [...trip.cargoItems, newCargoItem()])}
                className="inline-flex items-center gap-1 rounded-md border border-neon/30 px-2.5 py-1.5 text-xs text-neon hover:bg-neon/10"
              >
                <Plus className="h-3 w-3" /> Añadir carga
              </button>
            </div>
            {trip.cargoItems.length === 0 ? (
              <p className="rounded-md border border-dashed border-white/15 p-3 text-xs text-muted-foreground">
                Agrega al menos una línea para controlar documentos, bultos, peso y entrega.
              </p>
            ) : (
              <div className="space-y-2">
                {trip.cargoItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-md border border-white/10 bg-black/15 p-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_0.7fr_0.8fr_1fr_auto_auto] lg:items-end"
                  >
                    <TextField
                      label={`Carga ${index + 1}`}
                      value={item.description}
                      onChange={(value) => changeCargo(item.id, "description", value)}
                      placeholder="Descripción"
                    />
                    <TextField
                      label="Remesa / referencia"
                      value={item.document}
                      onChange={(value) => changeCargo(item.id, "document", value)}
                    />
                    <NumberField
                      label="Bultos"
                      value={item.packages}
                      onChange={(value) => changeCargo(item.id, "packages", value)}
                      suffix="und."
                      step="1"
                    />
                    <NumberField
                      label="Peso"
                      value={item.weightKg}
                      onChange={(value) => changeCargo(item.id, "weightKg", value)}
                      suffix="kg"
                    />
                    <NumberField
                      label="Valor declarado"
                      value={item.declaredValueCop}
                      onChange={(value) => changeCargo(item.id, "declaredValueCop", value)}
                      suffix="COP"
                      step="1"
                    />
                    <button
                      type="button"
                      onClick={() => changeCargo(item.id, "delivered", !item.delivered)}
                      className={`inline-flex h-10 items-center justify-center gap-1 rounded-md border px-2 text-[10px] ${item.delivered ? "border-emerald-400/40 text-emerald-300" : "border-white/15 text-slate-300"}`}
                    >
                      <Check className="h-3 w-3" /> {item.delivered ? "Entregado" : "Pendiente"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar carga ${index + 1}`}
                      onClick={() =>
                        changeTrip(
                          "cargoItems",
                          trip.cargoItems.filter((cargo) => cargo.id !== item.id),
                        )
                      }
                      className="h-10 rounded-md border border-rose-500/20 px-2 text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {cargoOverCapacity && (
              <p className="flex items-center gap-2 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" /> El peso registrado excede la
                capacidad útil informada. Verifica los datos y el límite autorizado del vehículo.
              </p>
            )}
          </section>
        </details>

        <section className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neon">
              <Receipt className="h-4 w-4" /> 3. Flete y recaudos
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              El flete basta para estimar ingresos. Registra recaudos solo cuando necesites
              controlar el saldo del cliente.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label="Recargos / servicios adicionales"
              value={trip.surchargeCop}
              onChange={(value) => changeTrip("surchargeCop", value)}
              suffix="COP"
              step="1"
            />
          </div>
          <details className="rounded-md border border-white/10 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-200">
              Anticipos, pagos y retenciones certificadas
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField
                label="Anticipo del cliente"
                value={trip.customerAdvanceCop}
                onChange={(value) => changeTrip("customerAdvanceCop", value)}
                suffix="COP"
                step="1"
              />
              <NumberField
                label="Pago final del cliente"
                value={trip.customerFinalPaymentCop}
                onChange={(value) => changeTrip("customerFinalPaymentCop", value)}
                suffix="COP"
                step="1"
              />
              <NumberField
                label="Otros recaudos del cliente"
                value={trip.otherCustomerCollectionCop}
                onChange={(value) => changeTrip("otherCustomerCollectionCop", value)}
                suffix="COP"
                step="1"
              />
              <NumberField
                label="Retenciones certificadas"
                value={trip.customerWithheldCop}
                onChange={(value) => changeTrip("customerWithheldCop", value)}
                suffix="COP"
                step="1"
              />
            </div>
          </details>
          <details className="rounded-md border border-white/10 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-200">
              Anticipo y reintegro de caja del conductor
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Anticipo de caja al conductor"
                value={trip.driverAdvanceCop}
                onChange={(value) => changeTrip("driverAdvanceCop", value)}
                suffix="COP"
                step="1"
              />
              <NumberField
                label="Efectivo reintegrado por conductor"
                value={trip.driverCashReturnedCop}
                onChange={(value) => changeTrip("driverCashReturnedCop", value)}
                suffix="COP"
                step="1"
              />
            </div>
          </details>
          <p className="text-[10px] text-muted-foreground">
            El anticipo del cliente hace parte del recaudo del flete, no es un ingreso adicional. El
            anticipo al conductor es caja entregada, no un gasto; los gastos se registran por
            separado.
          </p>
        </section>

        <details className="rounded-lg border border-white/10 bg-black/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neon">
            4. Costos del viaje y arqueo de caja (opcionales)
          </summary>
          <section className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neon">
                  <Fuel className="h-4 w-4" /> Costos y arqueo de caja
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Todo gasto afecta la rentabilidad; solo los marcados como pagados con anticipo de
                  caja afectan el arqueo del conductor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => changeTrip("expenses", [...trip.expenses, newExpense()])}
                className="inline-flex items-center gap-1 rounded-md border border-neon/30 px-2.5 py-1.5 text-xs text-neon hover:bg-neon/10"
              >
                <Plus className="h-3 w-3" /> Añadir gasto
              </button>
            </div>
            {trip.expenses.length === 0 ? (
              <p className="rounded-md border border-dashed border-white/15 p-3 text-xs text-muted-foreground">
                Registra combustible, peajes y demás costos asociados a este viaje.
              </p>
            ) : (
              <div className="space-y-2">
                {trip.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="grid gap-2 rounded-md border border-white/10 bg-black/15 p-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.8fr_1.2fr_1fr_auto_auto] lg:items-end"
                  >
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-slate-300">
                        Categoría del costo
                      </span>
                      <select
                        value={expense.category}
                        onChange={(event) =>
                          changeExpense(expense.id, "category", event.target.value)
                        }
                        className="input-neon w-full"
                      >
                        {EXPENSE_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <NumberField
                      label="Valor"
                      value={expense.amountCop}
                      onChange={(value) => changeExpense(expense.id, "amountCop", value)}
                      suffix="COP"
                      step="1"
                    />
                    <TextField
                      label="Soporte / detalle"
                      value={expense.note}
                      onChange={(value) => changeExpense(expense.id, "note", value)}
                      placeholder="Recibo, observación"
                    />
                    <label className="flex h-10 items-center gap-2 rounded-md border border-white/10 px-2 text-[10px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={expense.paidFromDriverCash}
                        onChange={(event) =>
                          changeExpense(expense.id, "paidFromDriverCash", event.target.checked)
                        }
                      />
                      Sale del anticipo
                    </label>
                    <span />
                    <button
                      type="button"
                      aria-label="Quitar gasto"
                      onClick={() =>
                        changeTrip(
                          "expenses",
                          trip.expenses.filter((item) => item.id !== expense.id),
                        )
                      }
                      className="h-10 rounded-md border border-rose-500/20 px-2 text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </details>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-neon">
                <Gauge className="h-4 w-4" /> 5. Resultado del viaje
              </h3>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Rentabilidad operativa antes de costos fijos e impuestos, según los valores
                capturados.
              </p>
            </div>
            <NumberField
              label="Margen objetivo para cotizar"
              value={targetMarginPct}
              onChange={(value) => setTargetMarginPct(Math.min(99.99, Math.max(0, value)))}
              suffix="%"
              step="0.5"
              min={0}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Flete + recargos pactados"
              value={formatCOP(metrics.contractRevenueCop)}
            />
            <Metric label="Costos directos del viaje" value={formatCOP(metrics.tripCostsCop)} />
            <Metric
              label="Utilidad operativa estimada"
              value={formatCOP(metrics.operatingProfitCop)}
              detail={
                metrics.operatingMarginPct === null
                  ? "Margen: N/D"
                  : `Margen: ${formatNumber(metrics.operatingMarginPct)}%`
              }
              emphasis
            />
            <Metric
              label="Flete base de equilibrio"
              value={formatCOP(metrics.breakEvenFreightCop)}
              detail="Recargos restados de los costos directos del viaje"
            />
            <Metric
              label="Flete base para margen objetivo"
              value={formatCOP(metrics.requiredFreightAtTargetCop)}
              detail={`Objetivo: ${formatNumber(targetMarginPct)}% · incluye recargos registrados, antes de costos fijos e impuestos`}
            />
            <Metric
              label="Recaudo cliente"
              value={formatCOP(metrics.customerCollectedCop)}
              detail={`Saldo después de retenciones: ${formatCOP(metrics.customerBalanceCop)} · retenciones certificadas: ${formatCOP(metrics.customerWithheldCop)}`}
            />
            <Metric
              label="Uso de capacidad por peso"
              value={
                metrics.loadUtilizationPct === null
                  ? "N/D"
                  : `${formatNumber(metrics.loadUtilizationPct)}%`
              }
              detail={
                metrics.loadUtilizationPct === null
                  ? "Ingresa capacidad y manifiesto para calcularlo; no mide volumen."
                  : `${formatNumber(metrics.loadWeightKg, 0)} kg de ${formatNumber(trip.capacityKg, 0)} kg · no mide volumen`
              }
            />
            <Metric
              label="Avance de entrega por bultos"
              value={
                metrics.deliveryProgressPct === null
                  ? "N/D"
                  : `${formatNumber(metrics.deliveryProgressPct)}%`
              }
              detail={
                metrics.deliveryProgressPct === null
                  ? "Agrega bultos al manifiesto y marca los entregados."
                  : `${formatNumber(metrics.deliveredWeightKg, 0)} kg entregados`
              }
            />
            <Metric
              label="Costo por km total"
              value={formatUnitCOP(metrics.costPerKmCop)}
              detail={`${formatNumber(metrics.totalKm, 0)} km cargado + vacío`}
            />
            <Metric
              label="Flete por tonelada-km cargada"
              value={formatUnitCOP(metrics.revenuePerLoadedTonKmCop)}
              detail="Usa solo flete base, peso manifestado y km cargados"
            />
            <Metric
              label="Rendimiento de combustible"
              value={
                metrics.fuelEfficiencyKmPerLiter === null
                  ? "N/D"
                  : `${formatNumber(metrics.fuelEfficiencyKmPerLiter, 2)} km/l`
              }
              detail={`ACPM: ${formatCOP(metrics.fuelExpenseCop)} · ${formatUnitCOP(metrics.fuelCostPerLiterCop)}/litro`}
            />
            <Metric
              label="Diferencia de arqueo del conductor"
              value={
                trip.driverAdvanceCop + metrics.cashExpensesCop + trip.driverCashReturnedCop === 0
                  ? "N/D"
                  : formatCOP(metrics.driverCashDifferenceCop)
              }
              detail={
                trip.driverAdvanceCop + metrics.cashExpensesCop + trip.driverCashReturnedCop === 0
                  ? "Registra anticipo, gastos de caja o reintegro para hacer el arqueo."
                  : Math.abs(metrics.driverCashDifferenceCop) < 0.01
                    ? "Cuadrado con los gastos pagados de caja y el reintegro"
                    : metrics.driverCashDifferenceCop > 0
                      ? "Efectivo pendiente de reintegrar o soportar"
                      : "Gastos pagados por el conductor por encima del anticipo"
              }
            />
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="btn-emerald inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />{" "}
            {saving
              ? "Guardando viaje…"
              : trip.id
                ? "Actualizar viaje y manifiesto"
                : "Guardar viaje y manifiesto"}
          </button>
          <button
            type="button"
            onClick={() => exportTripPdf(trip)}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-neon/30 px-3 py-2 text-sm text-neon transition hover:bg-neon/10 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" /> Descargar reporte PDF
          </button>
        </div>
        {trip.id && (
          <button
            type="button"
            onClick={() => setTrip(blankTrip())}
            className="w-full rounded-md border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            Cancelar edición
          </button>
        )}
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-neon" /> Flete, costos y utilidad por viaje
          </h3>
          <p className="mb-2 text-[10px] text-muted-foreground">
            Comparativo de los últimos 12 viajes guardados; el flete incluye los recargos pactados.
          </p>
          {historyChart.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Guarda viajes para comparar sus resultados.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={historyChart} margin={{ top: 8, right: 8, left: 4, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("es-CO", { notation: "compact" }).format(value)
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => formatCOP(value)}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Flete + recargos" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Costo directo" fill="#fbbf24" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Utilidad operativa" fill="#34d399" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
        <section className="rounded-lg border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-semibold">Composición de costos del viaje en edición</h3>
          {expenseChart.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Agrega gastos para ver su composición.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseChart}
                  dataKey="amountCop"
                  nameKey="category"
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  labelLine={false}
                >
                  {expenseChart.map((entry, index) => (
                    <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => formatCOP(value)}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Historial independiente de viajes</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {trips.length} viaje(s) · datos paginados y filtrados por el usuario autenticado.
            </p>
          </div>
          {loadError && <span className="text-xs text-rose-300">{loadError}</span>}
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Cargando viajes…</p>
        ) : trips.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/15 p-4 text-xs text-muted-foreground">
            Aún no hay viajes registrados. Completa el formulario para comenzar el control.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-white/10">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-white/[0.04] text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Fecha / ruta</th>
                  <th className="p-3">Vehículo</th>
                  <th className="p-3 text-right">Flete + recargos</th>
                  <th className="p-3 text-right">Costos</th>
                  <th className="p-3 text-right">Utilidad</th>
                  <th className="p-3 text-right">Carga</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((savedTrip) => {
                  const savedMetrics = computeTransportTripMetrics(savedTrip, targetMarginPct);
                  return (
                    <tr key={savedTrip.id} className="border-t border-white/5">
                      <td className="p-3">
                        <div className="font-medium">
                          {savedTrip.origin} → {savedTrip.destination}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {savedTrip.tripDate} · {savedTrip.driverName || "Sin conductor asignado"}
                        </div>
                      </td>
                      <td className="p-3 font-mono">{savedTrip.vehiclePlate}</td>
                      <td className="p-3 text-right font-mono">
                        {formatCOP(savedMetrics.contractRevenueCop)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatCOP(savedMetrics.tripCostsCop)}
                      </td>
                      <td
                        className={`p-3 text-right font-mono ${savedMetrics.operatingProfitCop < 0 ? "text-rose-300" : "text-emerald-300"}`}
                      >
                        {formatCOP(savedMetrics.operatingProfitCop)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {savedMetrics.loadUtilizationPct === null
                          ? "N/D"
                          : `${formatNumber(savedMetrics.loadUtilizationPct)}%`}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => exportTripPdf(savedTrip, false)}
                          aria-label={`Descargar reporte PDF del viaje ${savedTrip.origin} a ${savedTrip.destination}`}
                          title="Descargar reporte PDF"
                          className="mr-1 rounded p-1.5 text-muted-foreground hover:bg-neon/10 hover:text-neon"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTrip(savedTrip);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          aria-label={`Editar viaje ${savedTrip.origin} a ${savedTrip.destination}`}
                          className="mr-1 rounded p-1.5 text-muted-foreground hover:bg-neon/10 hover:text-neon"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTrip(savedTrip.id)}
                          aria-label={`Eliminar viaje ${savedTrip.origin} a ${savedTrip.destination}`}
                          className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
