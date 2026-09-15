export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  price: number | null;
  show_price: boolean;
  active: boolean;
  sort_order: number;
}

export interface Settings {
  business_name: string;
  address: string;
  whatsapp: string;
  welcome_text: string;
  share_text: string;
  instagram_url: string | null;
  min_advance_hours: number;
  max_days_ahead: number;
  cancel_hours_limit: number;
}

export interface Professional {
  id: string;
  name: string;
}

export interface BusinessHour {
  id: string;
  professional_id: string;
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_interval_min: number;
}

export type AppointmentStatus =
  "pendiente" | "confirmado" | "atendido" | "cancelado" | "no_asistio";

export interface Appointment {
  id: string;
  code: string;
  client_name: string;
  client_lastname: string;
  client_phone: string;
  notes: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  needs_approval: boolean;
  service_id: string;
  service_name?: string;
  professional_name?: string;
}

export interface TimeBlock {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export interface AvailabilityException {
  id: string;
  date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export const ESTADOS: Record<AppointmentStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
  no_asistio: "No asistió",
};
