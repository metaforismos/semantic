export interface Kpi {
  id: number;
  name: string;
  type: "performance" | "strategic";
  description: string;
  target: string;
}

export const KPI_2026: Kpi[] = [
  { id: 1, name: "WhatsApp activado", type: "performance", description: "Hoteles enviando encuestas por WhatsApp", target: "1,500 hoteles" },
  { id: 2, name: "WhatsApp pagado", type: "performance", description: "Hoteles con al menos 1 bolsa de pago contratada", target: "750 hoteles" },
  { id: 3, name: "Penetración AUTH", type: "performance", description: "90% de las OTAs disponibles por hotel", target: "90%" },
  { id: 4, name: "Encuestas Respondidas", type: "performance", description: "Encuestas respondidas (OnSite + FollowUp)", target: "2,000,000" },
  { id: 5, name: "Logins totales", type: "performance", description: "Ingresos no únicos en el período", target: "3,000,000" },
  { id: 6, name: "Smart Replies", type: "performance", description: "Respuestas inteligentes generadas (On, Fu y On)", target: "1,400,000" },
  { id: 7, name: "Hoteles con Desk", type: "performance", description: "Hoteles con al menos 3 casos mensuales", target: "50% del total" },
  { id: 8, name: "Hoteles con Desk Pro", type: "performance", description: "Hoteles pagando suscripción de Desk", target: "40% de hoteles usando Desk" },
  { id: 9, name: "Casos resueltos", type: "performance", description: "Porcentaje de casos resueltos en el año", target: "85%" },
  { id: 10, name: "Conversión MRR (Onboarding)", type: "performance", description: "Porcentaje de hoteles que convierten en Onboarding", target: "85%" },
  { id: 11, name: "Hoteles con Concierge", type: "performance", description: "Hoteles con Concierge de pago", target: "400 hoteles" },
  { id: 12, name: "Nuevo MRR", type: "strategic", description: "Ventas totales de nuevos clientes", target: "$72,000 USD" },
  { id: 13, name: "Upselling", type: "strategic", description: "Ventas totales a clientes existentes", target: "$25,000 USD" },
  { id: 14, name: "Fuga", type: "strategic", description: "Downgrades o clientes que dejan de pagar (máximo)", target: "$14,400 USD" },
];

export const SCORE_THRESHOLDS = {
  GREEN: 70,
  YELLOW: 40,
} as const;
