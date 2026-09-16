/**
 * Contexto Global de Datos Financieros (React)
 * Proporciona acceso centralizado a datosFinancierosGlobales
 * Con ESCUCHA ACTIVA: Cualquier cambio en los datos fuerza recálculos en cascada
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import {
  DatosFinancierosGlobales,
  ESTADO_INICIAL,
  calcularIndicadores,
  crearEstadoDesdeOCR,
  validarConsistencia,
} from "./global-finance-state";

// Tipo para listeners/suscriptores
type FinanceChangeListener = (nuevoEstado: DatosFinancierosGlobales) => void;

interface OCRParsedPayload {
  totals?: Record<string, number>;
  lineItems?: Array<{ label: string; value: number }>;
}

interface FinanceContextType {
  // Estado actual
  datos: DatosFinancierosGlobales;
  
  // Acciones
  actualizarDesdeOCR: (parsed: OCRParsedPayload, docType?: "balance" | "pnl") => void;
  actualizarManual: (parcial: Partial<DatosFinancierosGlobales>) => void;
  limpiar: () => void;
  validar: () => { valido: boolean; errores: string[] };
  
  // Listeners para escucha activa
  suscribir: (listener: FinanceChangeListener) => () => void;
  
  // Información de cambios
  ultimoCambio?: {
    timestamp: Date;
    tipo: "ocr" | "manual" | "limpieza";
    docType?: "balance" | "pnl";
  };
}

export const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [datos, setDatos] = useState<DatosFinancierosGlobales>(ESTADO_INICIAL);
  const [ultimoCambio, setUltimoCambio] = useState<FinanceContextType["ultimoCambio"]>();
  
  // Listeners para escucha activa
  const listenersRef = useRef<Set<FinanceChangeListener>>(new Set());

  /**
   * Notifica a todos los suscriptores cuando cambian los datos
   */
  const notificarCambios = useCallback((nuevoEstado: DatosFinancierosGlobales) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener(nuevoEstado);
      } catch (error) {
        console.error("[FinanceContext] Error en listener:", error);
      }
    });
  }, []);

  /**
   * Actualiza desde OCR - Escucha Activa
   * Detecta automáticamente el tipo de documento y fuerza recálculos en cascada
   */
  const actualizarDesdeOCR = useCallback(
    (parsed: OCRParsedPayload, docType: "balance" | "pnl" = "pnl") => {
      const nuevoEstado = crearEstadoDesdeOCR(parsed, docType);
      setDatos(nuevoEstado);
      setUltimoCambio({
        timestamp: new Date(),
        tipo: "ocr",
        docType,
      });
      
      // Escucha activa: notificar a todos los suscriptores
      notificarCambios(nuevoEstado);
      
      console.log(
        `[FinanceContext] 🎯 ESCUCHA ACTIVA DISPARADA - OCR ${docType.toUpperCase()} actualizado`,
        nuevoEstado
      );
    },
    [notificarCambios]
  );

  /**
   * Actualización manual - Escucha Activa
   * Recalcula indicadores automáticamente
   */
  const actualizarManual = useCallback(
    (parcial: Partial<DatosFinancierosGlobales>) => {
      setDatos((anterior) => {
        const actualizado = { ...anterior, ...parcial, fechaExtraccion: new Date() };
        const conIndicadores = calcularIndicadores(actualizado);
        
        setUltimoCambio({
          timestamp: new Date(),
          tipo: "manual",
        });
        
        // Escucha activa: notificar a todos los suscriptores
        notificarCambios(conIndicadores);
        
        console.log(
          "[FinanceContext] 🎯 ESCUCHA ACTIVA DISPARADA - Actualización manual",
          conIndicadores
        );
        
        return conIndicadores;
      });
    },
    [notificarCambios]
  );

  /**
   * Limpiar estado - Escucha Activa
   */
  const limpiar = useCallback(() => {
    setDatos(ESTADO_INICIAL);
    setUltimoCambio({
      timestamp: new Date(),
      tipo: "limpieza",
    });
    
    // Escucha activa: notificar a todos los suscriptores
    notificarCambios(ESTADO_INICIAL);
    
    console.log("[FinanceContext] 🧹 ESCUCHA ACTIVA DISPARADA - Estado limpiado");
  }, [notificarCambios]);

  /**
   * Validar consistencia contable
   */
  const validar = useCallback(() => {
    return validarConsistencia(datos);
  }, [datos]);

  /**
   * Suscribirse a cambios (Escucha Activa)
   * Retorna función para desuscribirse
   */
  const suscribir = useCallback((listener: FinanceChangeListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value: FinanceContextType = {
    datos,
    actualizarDesdeOCR,
    actualizarManual,
    limpiar,
    validar,
    suscribir,
    ultimoCambio,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

/**
 * Hook para usar el contexto de finanzas
 */
export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance debe usarse dentro de FinanceProvider");
  }
  return context;
}

/**
 * Hook especializado para "Escucha Activa"
 * Ejecuta un callback automáticamente cuando los datos cambian
 * Perfecto para forzar recálculos en cascada
 */
export function useFinanceListener(
  callback: (datos: DatosFinancierosGlobales) => void,
  dependencies: React.DependencyList = []
) {
  const { suscribir } = useFinance();

  useEffect(() => {
    // Suscribirse a cambios
    const desuscribir = suscribir(callback);
    
    // Limpiar al desmontar
    return desuscribir;
  }, [suscribir, ...dependencies]);
}
