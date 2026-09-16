import {
  Truck,
  Fuel,
  Wrench,
  ShoppingCart,
  Package,
  Receipt,
  Briefcase,
  HandCoins,
  Factory,
  Boxes,
  Hammer,
  Megaphone,
  Banknote,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type SectorKey = "transporte" | "comercio" | "servicios" | "manufactura";
export type EntityType = "natural" | "juridica";

export type CategoryDef = {
  key: string;
  label: string;
  kind: "income" | "expense";
  icon: LucideIcon;
};

export const SECTOR_LABEL: Record<SectorKey, string> = {
  transporte: "Transporte",
  comercio: "Comercio",
  servicios: "Servicios",
  manufactura: "Manufactura",
};

export const ENTITY_LABEL: Record<EntityType, string> = {
  natural: "Persona Natural",
  juridica: "Persona Jurídica",
};

export const CATEGORIES: Record<SectorKey, CategoryDef[]> = {
  transporte: [
    { key: "fletes", label: "Fletes", kind: "income", icon: Truck },
    { key: "carga_extra", label: "Carga Extra", kind: "income", icon: Package },
    { key: "acpm", label: "ACPM", kind: "expense", icon: Fuel },
    { key: "mantenimiento", label: "Mantenimiento", kind: "expense", icon: Wrench },
    { key: "peajes", label: "Peajes", kind: "expense", icon: Receipt },
  ],
  comercio: [
    { key: "ventas", label: "Ventas", kind: "income", icon: ShoppingCart },
    { key: "comisiones", label: "Comisiones", kind: "income", icon: Banknote },
    { key: "mercancia", label: "Mercancía", kind: "expense", icon: Package },
    { key: "publicidad", label: "Publicidad", kind: "expense", icon: Megaphone },
    { key: "arriendo", label: "Arriendo Local", kind: "expense", icon: Receipt },
  ],
  servicios: [
    { key: "honorarios", label: "Honorarios", kind: "income", icon: Briefcase },
    { key: "asesorias", label: "Asesorías", kind: "income", icon: HandCoins },
    { key: "software", label: "Software", kind: "expense", icon: Zap },
    { key: "personal", label: "Personal", kind: "expense", icon: Briefcase },
    { key: "servicios_pub", label: "Servicios Públicos", kind: "expense", icon: Receipt },
  ],
  manufactura: [
    { key: "ventas_prod", label: "Ventas Producto", kind: "income", icon: Factory },
    { key: "exportacion", label: "Exportación", kind: "income", icon: Boxes },
    { key: "materia_prima", label: "Materia Prima", kind: "expense", icon: Boxes },
    { key: "mano_obra", label: "Mano de Obra", kind: "expense", icon: Hammer },
    { key: "energia", label: "Energía", kind: "expense", icon: Zap },
  ],
};
