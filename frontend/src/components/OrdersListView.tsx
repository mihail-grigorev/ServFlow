import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { ServiceOrder, User as UserType, SparePart, Equipment, ReservedPartItem } from '../types';
import { ClipboardList, MapPin, User, ShieldAlert, CheckCircle2, Clock, Wrench, Edit3, X, Plus, Minus, Trash2, Package } from 'lucide-react';

interface OrdersListViewProps {
  onRefreshTrigger?: number;
  currentUser?: UserType | null;
  allUsers?: UserType[];
  allParts?: SparePart[];
  allEquipment?: Equipment[];
  onRefreshData?: () => void;
}

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  onRefreshTrigger,
  currentUser,
  allUsers = [],
  allParts = [],
  allEquipment = [],
  onRefreshData,
}) => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [editStatus, setEditStatus] = useState<string>('Новая');
  const [editEngineerId, setEditEngineerId] = useState<number | null>(null);
  const [editSymptom, setEditSymptom] = useState<string>('');
  const [editClientAssumption, setEditClientAssumption] = useState<string>('');
  const [editIsWarranty, setEditIsWarranty] = useState<boolean>(false);
  const [editWarrantyReason, setEditWarrantyReason] = useState<string>('');
  const [editReservedParts, setEditReservedParts] = useState<ReservedPartItem[]>([]);
  const [selectedPartToAdd, setSelectedPartToAdd] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const isDispatcher = currentUser?.role === 'dispatcher';
  const engineers = allUsers.filter((u) => u.role === 'engineer');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getOrders();
      setOrders(res);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [onRefreshTrigger]);

  const filtered = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'warranty') return o.is_warranty;
    return o.status === statusFilter;
  });

  const handleOpenEdit = (o: ServiceOrder) => {
    setEditingOrder(o);
    setEditStatus(o.status);
    setEditEngineerId(o.engineer_id || null);
    setEditSymptom(o.symptom);
    setEditClientAssumption(o.client_assumption || '');
    setEditIsWarranty(o.is_warranty);
    setEditWarrantyReason(o.warranty_reason || '');
    setEditReservedParts(
      (o.reserved_parts || []).map((p: any) => ({
        code: p.code,
        name: p.name,
        quantity: p.quantity || 1,
        source_city: p.source_city || 'Москва',
        transfer_required: p.transfer_required || false,
      }))
    );
  };

  const handleUpdatePartQty = (code: string, delta: number) => {
    setEditReservedParts((prev) =>
      prev.map((p) => (p.code === code ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p))
    );
  };

  const handleRemovePart = (code: string) => {
    setEditReservedParts((prev) => prev.filter((p) => p.code !== code));
  };

  const handleAddPart = () => {
    if (!selectedPartToAdd) return;
    const part = allParts.find((p) => p.code === selectedPartToAdd);
    if (!part) return;

    if (editReservedParts.some((p) => p.code === part.code)) {
      handleUpdatePartQty(part.code, 1);
    } else {
      const city = editingOrder?.address?.includes('Тула') ? 'Тула' : 'Москва';
      setEditReservedParts((prev) => [
        ...prev,
        {
          code: part.code,
          name: part.name,
          quantity: 1,
          source_city: city,
          transfer_required: false,
        },
      ]);
    }
    setSelectedPartToAdd('');
  };

  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setSaving(true);
    try {
      await api.updateOrder(editingOrder.id, {
        status: editStatus,
        engineer_id: editEngineerId,
        symptom: editSymptom.trim(),
        client_assumption: editClientAssumption.trim() || null,
        is_warranty: editIsWarranty,
        warranty_reason: editWarrantyReason.trim() || null,
        reserved_parts: editReservedParts,
      });
      setEditingOrder(null);
      await loadOrders();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения заявки');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (orderId: number, orderNum?: string) => {
    const num = orderNum || editingOrder?.order_number || `#${orderId}`;
    if (!window.confirm(`Вы уверены, что хотите удалить заявку ${num}? Зарезервированные запчасти будут возвращены на склад.`)) {
      return;
    }
    try {
      await api.deleteOrder(orderId);
      if (editingOrder?.id === orderId) setEditingOrder(null);
      await loadOrders();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления заявки');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-[#F0F5F2]">
              Журнал заявок на выезд
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              {orders.length} оформлено
            </span>
          </div>
          <p className="text-xs text-[#8E9E94] mt-0.5">
            Контроль подготовки выездов, зарезервированных деталей и работы инженеров
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1 bg-white/[0.04] border border-white/[0.08] p-1 rounded-xl text-xs">
          {[
            { id: 'all', label: 'Все заявки' },
            { id: 'Назначен', label: 'Назначен' },
            { id: 'В пути', label: 'В пути' },
            { id: 'На месте', label: 'На месте' },
            { id: 'Выполнен', label: 'Выполнен' },
            { id: 'warranty', label: 'Гарантийные (П-9)' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === f.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-[#8E9E94] hover:text-[#F0F5F2]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#16171B] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-[#8E9E94] font-semibold uppercase tracking-wider border-b border-white/[0.08]">
              <tr>
                <th className="py-3 px-4">№ Заявки</th>
                <th className="py-3 px-4">Клиент и адрес</th>
                <th className="py-3 px-4">Кофемашина</th>
                <th className="py-3 px-4">Симптом (П-4)</th>
                <th className="py-3 px-4">Инженер</th>
                <th className="py-3 px-4">Детали (П-8)</th>
                <th className="py-3 px-4 text-center">Статус</th>
                {isDispatcher && <th className="py-3 px-4 text-right">Действия</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                    <div>{o.order_number}</div>
                    {o.is_warranty && (
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/20">
                        Гарантия (П-9)
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#F0F5F2]">{o.client_name}</div>
                    <div className="text-[11px] text-[#8E9E94] flex items-center space-x-1 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0 text-[#8E9E94]" />
                      <span className="truncate max-w-[200px]">{o.address}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-medium text-[#F0F5F2]">{o.model}</div>
                    <div className="text-[11px] text-[#8E9E94] font-mono">№{o.serial_number}</div>
                  </td>

                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="line-clamp-2 text-[#F0F5F2]">{o.symptom}</div>
                    {o.client_assumption && (
                      <div className="text-[10px] text-[#8E9E94] mt-0.5 truncate">
                        Догадка: {o.client_assumption}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {o.engineer ? (
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-white/60" />
                        <span className="font-medium text-[#F0F5F2]">{o.engineer.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-[#8E9E94]">Не назначен</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    {o.reserved_parts && o.reserved_parts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {o.reserved_parts.map((p: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[#F0F5F2] font-mono text-[10px]"
                          >
                            {p.code} ({p.quantity} шт.)
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#8E9E94] text-[11px]">Без запчастей</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`font-semibold px-2.5 py-1 rounded-full text-[11px] border ${
                        o.status === 'Выполнен'
                          ? 'bg-white/15 text-white border-white/20'
                          : o.status === 'На месте'
                          ? 'bg-[#FF9F0A]/15 text-[#FF9F0A] border-[#FF9F0A]/25'
                          : o.status === 'В пути'
                          ? 'bg-white/10 text-white border-white/15'
                          : 'bg-white/[0.06] text-[#8E9E94] border-white/[0.08]'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>

                  {isDispatcher && (
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(o)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Редактировать</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(o.id, o.order_number)}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#FF453A]/15 hover:bg-[#FF453A]/30 text-[#FF453A] border border-[#FF453A]/25 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer"
                        title="Удалить заявку на выезд"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Удалить</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isDispatcher ? 8 : 7} className="py-8 text-center text-xs text-[#8E9E94]">
                    Заявки не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= EDIT ORDER MODAL (DISPATCHER) ================= */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16171B] w-full max-w-xl rounded-2xl border border-white/[0.1] shadow-2xl p-6 text-[#F0F5F2] animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-white/70" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Редактирование заявки {editingOrder.order_number}
                  </h3>
                  <div className="text-xs text-[#8E9E94]">
                    {editingOrder.client_name} · {editingOrder.model} (№{editingOrder.serial_number})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-[#8E9E94] hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-4">
              {/* Status and Engineer Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Статус заявки
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  >
                    <option value="Новая">Новая</option>
                    <option value="Назначен">Назначен</option>
                    <option value="В пути">В пути</option>
                    <option value="На месте">На месте</option>
                    <option value="Выполнен">Выполнен</option>
                    <option value="Вне договора">Вне договора</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Назначенный инженер
                  </label>
                  <select
                    value={editEngineerId || ''}
                    onChange={(e) => setEditEngineerId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  >
                    <option value="">-- Не назначен --</option>
                    {engineers.map((eng) => (
                      <option key={eng.id} value={eng.id}>
                        {eng.full_name} ({eng.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Symptom */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Симптом неисправности (Правило П-4)
                </label>
                <textarea
                  rows={2}
                  required
                  value={editSymptom}
                  onChange={(e) => setEditSymptom(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/[0.1] bg-[#1F2026] text-white placeholder-[#9CA3AF] outline-none focus:border-white/20 resize-none"
                />
              </div>

              {/* Warranty Checkbox */}
              <div className="p-3 rounded-xl bg-black/25 border border-white/[0.06] space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsWarranty}
                    onChange={(e) => setEditIsWarranty(e.target.checked)}
                    className="rounded text-[#FF453A] focus:ring-[#FF453A] bg-[#1F2026]"
                  />
                  <span className={editIsWarranty ? 'text-[#FF453A]' : 'text-white'}>
                    Гарантийный случай (Правило П-9)
                  </span>
                </label>
                {editIsWarranty && (
                  <input
                    type="text"
                    value={editWarrantyReason}
                    onChange={(e) => setEditWarrantyReason(e.target.value)}
                    placeholder="Причина гарантии (например: повторный вызов до 30 дней)"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-[#FF453A]"
                  />
                )}
              </div>

              {/* Reserved Parts Editor */}
              <div className="p-3 rounded-xl bg-black/25 border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <Package className="w-3.5 h-3.5 text-white/70" />
                    <span>Зарезервированные запчасти (Правило П-7, П-8)</span>
                  </label>
                  <span className="text-[10px] text-[#8E9E94]">
                    {editReservedParts.length} позиций
                  </span>
                </div>

                {editReservedParts.length > 0 ? (
                  <div className="space-y-1.5">
                    {editReservedParts.map((p) => (
                      <div
                        key={p.code}
                        className="p-2 rounded-lg bg-[#1F2026] border border-white/[0.06] flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-white">{p.code}</span>
                          <span className="text-[#8E9E94] ml-1.5 truncate">
                            {p.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <div className="flex items-center space-x-1 bg-black/30 rounded-lg p-0.5 border border-white/[0.06]">
                            <button
                              type="button"
                              onClick={() => handleUpdatePartQty(p.code, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-[#8E9E94] hover:text-white hover:bg-white/10"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-white px-1 text-[11px]">
                              {p.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdatePartQty(p.code, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-[#8E9E94] hover:text-white hover:bg-white/10"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(p.code)}
                            className="p-1 rounded-md text-[#8E9E94] hover:text-[#FF453A] hover:bg-white/[0.05]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs text-[#8E9E94]">
                    Запчасти не добавлены к заявке
                  </div>
                )}

                {/* Add Part Dropdown */}
                <div className="flex items-center space-x-2 pt-1 border-t border-white/[0.04]">
                  <select
                    value={selectedPartToAdd}
                    onChange={(e) => setSelectedPartToAdd(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-white/[0.1] bg-[#1F2026] text-white outline-none focus:border-white/20"
                  >
                    <option value="">-- Добавить деталь со склада --</option>
                    {allParts.map((pt) => (
                      <option key={pt.code} value={pt.code}>
                        {pt.code} · {pt.name} ({pt.compatible_models.join(', ')})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPartToAdd}
                    onClick={handleAddPart}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 disabled:opacity-40 text-black text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(editingOrder.id, editingOrder.order_number)}
                  className="px-3 py-1.5 rounded-xl bg-[#FF453A]/15 hover:bg-[#FF453A]/30 text-[#FF453A] border border-[#FF453A]/25 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить заявку</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2 rounded-xl border border-white/[0.1] hover:bg-white/[0.05] text-[#8E9E94] text-xs font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-semibold text-xs shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
