export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'dispatcher' | 'engineer' | 'company';
  city?: string | null;
  is_senior?: boolean;
  qualifications: string[];
  avatar_url?: string | null;
  created_at: string;
}

export interface Equipment {
  id: number;
  code: string;
  client_name: string;
  address: string;
  city: 'Москва' | 'Тула' | string;
  model: 'C100' | 'C200' | 'C300' | string;
  serial_number: string;
  installation_date: string;
  last_visit_date?: string | null;
  last_visit_result?: string | null;
}

export interface EquipmentCreate {
  code?: string;
  client_name?: string;
  address: string;
  city?: string;
  model: string;
  serial_number: string;
  installation_date?: string;
}

export interface SparePart {
  id: number;
  code: string;
  name: string;
  compatible_models: string[];
  moscow_stock: number;
  moscow_reserved: number;
  moscow_free: number;
  tula_stock: number;
  tula_reserved: number;
  tula_free: number;
}

export interface Message {
  id: number;
  thread_id: number;
  request_code?: string | null;
  channel: 'Почта' | 'Звонок' | 'Мессенджер' | string;
  chat_type?: 'client_dispatcher' | 'dispatcher_engineer' | 'client_engineer' | string;
  sender_type: 'client' | 'dispatcher' | 'system' | 'engineer';
  sender_name: string;
  content: string;
  created_at: string;
}

export interface ClientThread {
  id: number;
  thread_number: number;
  client_name: string;
  equipment_id?: number | null;
  equipment_code?: string | null;
  status: 'new' | 'needs_clarification' | 'ready_for_order' | 'order_created' | 'sales_transfer' | 'resolved';
  channel: 'Почта' | 'Звонок' | 'Мессенджер' | string;
  is_warranty: boolean;
  warranty_reason?: string | null;
  is_unregistered: boolean;
  last_activity: string;
  created_at: string;
  messages: Message[];
  equipment?: Equipment | null;
  linked_order_number?: string | null;
  assigned_engineer_name?: string | null;
  assigned_engineer_id?: number | null;
}

export interface RecommendedPartCandidate {
  code: string;
  name: string;
  is_compatible: boolean;
  local_stock: number;
  local_reserved: number;
  local_free: number;
  other_city_free: number;
  transfer_required: boolean;
  status_note: string;
  diagnostic_reason?: string | null;
}

export interface AIAnalysisResult {
  detected_equipment_code?: string | null;
  detected_model?: string | null;
  detected_serial?: string | null;
  equipment_reasoning?: string | null;
  is_unregistered_machine: boolean;
  is_ambiguous_machine: boolean;
  ambiguity_explanation?: string | null;
  is_warranty: boolean;
  warranty_reason?: string | null;
  error_code?: string | null;
  error_explanation?: string | null;
  draft_symptom: string;
  client_assumption?: string | null;
  reply_to_client: string;
  missing_questions: string[];
  recommended_parts: RecommendedPartCandidate[];
  rules_applied: string[];
}

export interface ReservedPartItem {
  code: string;
  name: string;
  quantity: number;
  source_city: string;
  transfer_required: boolean;
}

export interface ServiceOrder {
  id: number;
  order_number: string;
  thread_id?: number | null;
  client_name: string;
  equipment_id?: number | null;
  equipment_code?: string | null;
  address: string;
  model: string;
  serial_number: string;
  symptom: string;
  client_assumption?: string | null;
  is_warranty: boolean;
  warranty_reason?: string | null;
  is_sales_transfer: boolean;
  status: 'Назначен' | 'В пути' | 'На месте' | 'Выполнен' | 'Отменен' | string;
  engineer_id?: number | null;
  engineer?: User | null;
  reserved_parts: ReservedPartItem[];
  inspection_report?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoCompanyItem {
  company_id: string;
  company_name: string;
  city?: string | null;
  token: string;
  url: string;
  qr_svg: string;
  expires_at: string;
  uses: number;
  max_uses: number;
}


