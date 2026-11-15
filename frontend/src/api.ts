import {
  User,
  Equipment,
  SparePart,
  ClientThread,
  Message,
  ServiceOrder,
  AIAnalysisResult,
  ReservedPartItem,
  DemoCompanyItem
} from './types';

const API_BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('kofe_auth_token');
}

export function setToken(token: string) {
  localStorage.setItem('kofe_auth_token', token);
}

export function clearToken() {
  localStorage.removeItem('kofe_auth_token');
  localStorage.removeItem('kofe_current_user');
}

export function getSavedUser(): User | null {
  const u = localStorage.getItem('kofe_current_user');
  return u ? JSON.parse(u) : null;
}

export function saveUser(user: User) {
  localStorage.setItem('kofe_current_user', JSON.stringify(user));
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'Произошла ошибка при выполнении запроса';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<{ access_token: string; user: User }> => {
    const res = await request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.access_token);
    saveUser(res.user);
    return res;
  },

  switchUser: async (userId: number): Promise<{ access_token: string; user: User }> => {
    const res = await request<{ access_token: string; user: User }>(`/auth/switch-user/${userId}`, {
      method: 'POST',
    });
    setToken(res.access_token);
    saveUser(res.user);
    return res;
  },

  sendRegisterCode: async (email: string): Promise<{ status: string; message: string; dev_code?: string }> => {
    return await request<{ status: string; message: string; dev_code?: string }>('/auth/register/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  register: async (userData: {
    email: string;
    full_name: string;
    role: string;
    password: string;
    code?: string;
    city?: string;
    is_senior?: boolean;
    qualifications?: string[];
    avatar_url?: string;
  }): Promise<{ access_token: string; user: User }> => {
    const res = await request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    setToken(res.access_token);
    saveUser(res.user);
    return res;
  },

  sendDeleteCode: async (): Promise<{ status: string; message: string; dev_code?: string }> => {
    return await request<{ status: string; message: string; dev_code?: string }>('/auth/delete-account/send-code', {
      method: 'POST',
    });
  },

  confirmDeleteAccount: async (code: string): Promise<{ status: string; message: string }> => {
    const res = await request<{ status: string; message: string }>('/auth/delete-account/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    clearToken();
    return res;
  },

  getMe: async (): Promise<User> => {
    const user = await request<User>('/auth/me');
    saveUser(user);
    return user;
  },

  updateProfile: async (data: {
    full_name?: string;
    email?: string;
    city?: string;
    is_senior?: boolean;
    qualifications?: string[];
    avatar_url?: string;
    password?: string;
  }): Promise<User> => {
    const user = await request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    saveUser(user);
    return user;
  },

  deleteProfile: async (code?: string): Promise<{ status: string; message: string }> => {
    const url = code ? `/auth/profile?code=${encodeURIComponent(code)}` : '/auth/profile';
    const res = await request<{ status: string; message: string }>(url, {
      method: 'DELETE',
    });
    clearToken();
    return res;
  },

  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/auth/avatar`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Ошибка загрузки аватарки');
    return res.json();
  },

  getDemoUsers: async (): Promise<User[]> => {
    return request<User[]>('/auth/demo-users');
  },

  // Equipment & Parts
  getEquipment: async (): Promise<Equipment[]> => {
    return request<Equipment[]>('/equipment');
  },

  createEquipment: async (data: {
    code?: string;
    client_name?: string;
    address: string;
    city?: string;
    model: string;
    serial_number: string;
    installation_date?: string;
  }): Promise<Equipment> => {
    return request<Equipment>('/equipment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteEquipment: async (idOrCode: string | number): Promise<{ detail: string; equipment_code: string }> => {
    return request<{ detail: string; equipment_code: string }>(`/equipment/${idOrCode}`, {
      method: 'DELETE',
    });
  },

  getParts: async (): Promise<SparePart[]> => {
    return request<SparePart[]>('/parts');
  },

  // Threads & Messages
  getThreads: async (filterType: string = 'all', search?: string, clientName?: string): Promise<ClientThread[]> => {
    const params = new URLSearchParams();
    if (filterType !== 'all') params.append('filter_type', filterType);
    if (search) params.append('search', search);
    if (clientName) params.append('client_name', clientName);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ClientThread[]>(`/threads${qs}`);
  },

  getThread: async (threadId: number): Promise<ClientThread> => {
    return request<ClientThread>(`/threads/${threadId}`);
  },

  sendMessage: async (
    threadId: number,
    content: string,
    channel?: string,
    senderType: 'client' | 'dispatcher' | 'system' | 'engineer' = 'dispatcher',
    senderName?: string,
    chatType: string = 'client_dispatcher'
  ): Promise<Message> => {
    return request<Message>(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        channel,
        sender_type: senderType,
        sender_name: senderName || (senderType === 'client' ? 'Клиент' : senderType === 'engineer' ? 'Инженер' : 'Диспетчер'),
        chat_type: chatType,
      }),
    });
  },

  addMessage: async (
    threadId: number,
    data: {
      content: string;
      sender_type?: 'client' | 'dispatcher' | 'system' | 'engineer';
      sender_name?: string;
      channel?: string;
      chat_type?: string;
    }
  ): Promise<Message> => {
    return request<Message>(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createThread: async (data: {
    content: string;
    client_name?: string;
    equipment_code?: string;
    channel?: string;
  }): Promise<ClientThread> => {
    return request<ClientThread>('/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  simulateMessage: async (payload: {
    client_name: string;
    content: string;
    channel: string;
    request_code?: string;
  }): Promise<ClientThread> => {
    return request<ClientThread>('/threads/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // AI
  analyzeThread: async (threadId: number): Promise<AIAnalysisResult> => {
    return request<AIAnalysisResult>(`/ai/analyze-thread/${threadId}`, {
      method: 'POST',
    });
  },

  analyzeText: async (text: string, client_name?: string): Promise<AIAnalysisResult> => {
    return request<AIAnalysisResult>('/ai/analyze-text', {
      method: 'POST',
      body: JSON.stringify({ text, client_name }),
    });
  },

  generateReply: async (threadId: number): Promise<{ reply: string; rules_applied: string[] }> => {
    return request<{ reply: string; rules_applied: string[] }>('/ai/generate-reply', {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId }),
    });
  },

  // Orders
  getOrders: async (params?: { status?: string; engineer_id?: number; is_warranty?: boolean }): Promise<ServiceOrder[]> => {
    const sp = new URLSearchParams();
    if (params?.status) sp.append('status', params.status);
    if (params?.engineer_id !== undefined) sp.append('engineer_id', params.engineer_id.toString());
    if (params?.is_warranty !== undefined) sp.append('is_warranty', params.is_warranty.toString());
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return request<ServiceOrder[]>(`/orders${qs}`);
  },

  createOrder: async (orderData: {
    thread_id?: number | null;
    client_name: string;
    equipment_code?: string | null;
    address: string;
    model: string;
    serial_number: string;
    symptom: string;
    client_assumption?: string | null;
    is_warranty: boolean;
    warranty_reason?: string | null;
    is_sales_transfer: boolean;
    engineer_id?: number | null;
    reserved_parts: ReservedPartItem[];
    created_at?: string;
  }): Promise<ServiceOrder> => {
    return request<ServiceOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  updateOrderStatus: async (orderId: number, status: string): Promise<ServiceOrder> => {
    return request<ServiceOrder>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  updateOrder: async (orderId: number, data: any): Promise<ServiceOrder> => {
    return request<ServiceOrder>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  submitOrderReport: async (orderId: number, report: string, status?: string): Promise<ServiceOrder> => {
    return request<ServiceOrder>(`/orders/${orderId}/report`, {
      method: 'POST',
      body: JSON.stringify({ inspection_report: report, status: status || 'Выполнен' }),
    });
  },

  deleteOrder: async (orderId: number): Promise<{ detail: string; order_id: number }> => {
    return request<{ detail: string; order_id: number }>(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  },

  getOrderThread: async (orderId: number): Promise<ClientThread> => {
    return request<ClientThread>(`/orders/${orderId}/thread`);
  },

  getEngineerRecommendations: async (model: string, city: string, symptom?: string): Promise<any[]> => {
    const params = new URLSearchParams({ model, city });
    if (symptom) params.append('symptom', symptom);
    return request<any[]>(`/orders/engineer-recommendations?${params.toString()}`);
  },

  getAutoReplySetting: async (): Promise<{ auto_reply_enabled: boolean }> => {
    return request<{ auto_reply_enabled: boolean }>('/threads/settings/auto-reply');
  },

  setAutoReplySetting: async (enabled: boolean): Promise<{ auto_reply_enabled: boolean }> => {
    return request<{ auto_reply_enabled: boolean }>('/threads/settings/auto-reply', {
      method: 'POST',
      body: JSON.stringify({ auto_reply_enabled: enabled }),
    });
  },

  autoReplyAll: async (): Promise<{ success: boolean; replied_count: number; auto_reply_enabled: boolean }> => {
    return request<{ success: boolean; replied_count: number; auto_reply_enabled: boolean }>('/threads/auto-reply-all', {
      method: 'POST',
    });
  },

  // Seed / Reset / Upload
  resetData: async (): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/seed/reset', {
      method: 'POST',
    });
  },

  uploadExcel: async (file: File): Promise<{ status: string; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/seed/upload-excel`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Ошибка загрузки Excel файла');
    return res.json();
  },

  // Demo Mode & Audience QR
  getDemoConfig: async (): Promise<{ demo_mode: boolean; public_base_url: string }> => {
    return request<{ demo_mode: boolean; public_base_url: string }>('/demo/config');
  },

  getDemoCompanies: async (): Promise<DemoCompanyItem[]> => {
    return request<DemoCompanyItem[]>('/demo/companies');
  },

  issueAllDemoQr: async (): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/demo/qr/issue-all', {
      method: 'POST',
    });
  },

  revokeAllDemoQr: async (): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/demo/qr/revoke-all', {
      method: 'POST',
    });
  },

  exchangeDemoQr: async (token: string): Promise<{ access_token: string; user: User }> => {
    const res = await request<{ access_token: string; user: User }>('/demo/exchange', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    setToken(res.access_token);
    saveUser(res.user);
    return res;
  },

  verifyStaffPin: async (pin: string): Promise<{ valid: boolean }> => {
    return request<{ valid: boolean }>('/demo/verify-staff-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  resetDemoData: async (): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/demo/reset-data', {
      method: 'POST',
    });
  },
};

