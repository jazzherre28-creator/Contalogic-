export type TransportCargoItem = {
  id: string;
  description: string;
  document: string;
  packages: number;
  weightKg: number;
  declaredValueCop: number;
  delivered: boolean;
};

export type TransportExpense = {
  id: string;
  category: string;
  amountCop: number;
  note: string;
  paidFromDriverCash: boolean;
};

export type TransportTrip = {
  id: string;
  tripDate: string;
  origin: string;
  destination: string;
  vehiclePlate: string;
  driverName: string;
  loadedKm: number;
  emptyKm: number;
  capacityKg: number;
  fuelLiters: number;
  cargoItems: TransportCargoItem[];
  freightCop: number;
  surchargeCop: number;
  customerAdvanceCop: number;
  customerFinalPaymentCop: number;
  otherCustomerCollectionCop: number;
  customerWithheldCop: number;
  driverAdvanceCop: number;
  driverCashReturnedCop: number;
  expenses: TransportExpense[];
};

export type TransportTripMetrics = {
  contractRevenueCop: number;
  customerCollectedCop: number;
  customerWithheldCop: number;
  customerBalanceCop: number;
  tripCostsCop: number;
  operatingProfitCop: number;
  operatingMarginPct: number | null;
  breakEvenFreightCop: number | null;
  requiredFreightAtTargetCop: number | null;
  loadWeightKg: number;
  deliveredWeightKg: number;
  loadUtilizationPct: number | null;
  deliveryProgressPct: number | null;
  totalKm: number;
  costPerKmCop: number | null;
  revenuePerLoadedTonKmCop: number | null;
  fuelEfficiencyKmPerLiter: number | null;
  fuelCostPerLiterCop: number | null;
  fuelExpenseCop: number;
  cashExpensesCop: number;
  driverCashDifferenceCop: number;
  expenseBreakdown: Array<{ category: string; amountCop: number }>;
};

const sum = (values: number[]) =>
  values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);

export function computeTransportTripMetrics(
  trip: TransportTrip,
  targetMarginPct = 10,
): TransportTripMetrics {
  const contractRevenueCop = trip.freightCop + trip.surchargeCop;
  const tripCostsCop = sum(trip.expenses.map((expense) => expense.amountCop));
  const operatingProfitCop = contractRevenueCop - tripCostsCop;
  const loadWeightKg = sum(trip.cargoItems.map((item) => item.weightKg));
  const deliveredWeightKg = sum(
    trip.cargoItems.filter((item) => item.delivered).map((item) => item.weightKg),
  );
  const totalPackages = sum(trip.cargoItems.map((item) => item.packages));
  const deliveredPackages = sum(
    trip.cargoItems.filter((item) => item.delivered).map((item) => item.packages),
  );
  const totalKm = trip.loadedKm + trip.emptyKm;
  const customerCollectedCop =
    trip.customerAdvanceCop +
    trip.customerFinalPaymentCop +
    trip.otherCustomerCollectionCop;
  const cashExpensesCop = sum(
    trip.expenses
      .filter((expense) => expense.paidFromDriverCash)
      .map((expense) => expense.amountCop),
  );
  const fuelExpenseCop = sum(
    trip.expenses
      .filter((expense) => expense.category === "ACPM / combustible")
      .map((expense) => expense.amountCop),
  );
  const expenseGroups = new Map<string, number>();
  for (const expense of trip.expenses) {
    expenseGroups.set(
      expense.category,
      (expenseGroups.get(expense.category) ?? 0) + expense.amountCop,
    );
  }
  const margin = Math.min(99.99, Math.max(0, targetMarginPct));

  return {
    contractRevenueCop,
    customerCollectedCop,
    customerWithheldCop: trip.customerWithheldCop,
    customerBalanceCop:
      contractRevenueCop - customerCollectedCop - trip.customerWithheldCop,
    tripCostsCop,
    operatingProfitCop,
    operatingMarginPct:
      contractRevenueCop > 0 ? (operatingProfitCop / contractRevenueCop) * 100 : null,
    breakEvenFreightCop:
      tripCostsCop > 0 ? Math.max(0, tripCostsCop - trip.surchargeCop) : null,
    requiredFreightAtTargetCop:
      tripCostsCop > 0
        ? Math.ceil(Math.max(0, tripCostsCop / (1 - margin / 100) - trip.surchargeCop))
        : null,
    loadWeightKg,
    deliveredWeightKg,
    loadUtilizationPct:
      trip.capacityKg > 0 ? (loadWeightKg / trip.capacityKg) * 100 : null,
    deliveryProgressPct:
      totalPackages > 0 ? (deliveredPackages / totalPackages) * 100 : null,
    totalKm,
    costPerKmCop: totalKm > 0 ? tripCostsCop / totalKm : null,
    revenuePerLoadedTonKmCop:
      trip.loadedKm > 0 && loadWeightKg > 0
        ? trip.freightCop / ((loadWeightKg / 1000) * trip.loadedKm)
        : null,
    fuelEfficiencyKmPerLiter:
      totalKm > 0 && trip.fuelLiters > 0 ? totalKm / trip.fuelLiters : null,
    fuelCostPerLiterCop:
      fuelExpenseCop > 0 && trip.fuelLiters > 0
        ? fuelExpenseCop / trip.fuelLiters
        : null,
    fuelExpenseCop,
    cashExpensesCop,
    driverCashDifferenceCop:
      trip.driverAdvanceCop - cashExpensesCop - trip.driverCashReturnedCop,
    expenseBreakdown: [...expenseGroups.entries()]
      .map(([category, amountCop]) => ({ category, amountCop }))
      .sort((a, b) => b.amountCop - a.amountCop),
  };
}

export function validateTransportTrip(trip: TransportTrip): string | null {
  if (!trip.tripDate || !trip.origin.trim() || !trip.destination.trim()) {
    return "Completa la fecha y la ruta de origen y destino.";
  }
  if (!trip.vehiclePlate.trim()) return "Ingresa la placa del vehículo.";
  if (!Number.isFinite(trip.capacityKg) || trip.capacityKg <= 0) {
    return "La capacidad de carga debe ser mayor que cero.";
  }
  if (trip.cargoItems.length === 0) return "Agrega al menos una línea al manifiesto de carga.";
  for (const item of trip.cargoItems) {
    if (
      !item.description.trim() ||
      !Number.isFinite(item.packages) ||
      !Number.isInteger(item.packages) ||
      item.packages < 0 ||
      !Number.isFinite(item.weightKg) ||
      item.weightKg <= 0 ||
      !Number.isFinite(item.declaredValueCop) ||
      !Number.isInteger(item.declaredValueCop) ||
      item.declaredValueCop < 0
    ) {
      return "Revisa la descripción, unidades, peso y valor declarado de cada carga.";
    }
  }
  const measurements = [
    trip.loadedKm,
    trip.emptyKm,
    trip.fuelLiters,
  ];
  if (measurements.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    return "Los kilómetros y litros deben ser números válidos no negativos.";
  }
  const copAmounts = [
    trip.freightCop,
    trip.surchargeCop,
    trip.customerAdvanceCop,
    trip.customerFinalPaymentCop,
    trip.otherCustomerCollectionCop,
    trip.customerWithheldCop,
    trip.driverAdvanceCop,
    trip.driverCashReturnedCop,
  ];
  if (copAmounts.some((amount) => !Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0)) {
    return "Los valores monetarios en COP deben ser números enteros no negativos.";
  }
  if (
    trip.expenses.some(
      (expense) =>
        !expense.category.trim() ||
        !Number.isFinite(expense.amountCop) ||
        !Number.isInteger(expense.amountCop) ||
        expense.amountCop < 0,
    )
  ) {
    return "Revisa la categoría y el valor entero en COP de cada gasto del viaje.";
  }
  return null;
}
