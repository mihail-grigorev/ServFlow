import React, { useState, useEffect } from 'react';
import { api, getSavedUser, clearToken } from './api';
import { User, ClientThread, Equipment, SparePart, AIAnalysisResult } from './types';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { DispatcherDashboard } from './components/DispatcherDashboard';
import { OrderModal } from './components/OrderModal';
import { ExcelResetModal } from './components/ExcelResetModal';
import { EngineerCabinet } from './components/EngineerCabinet';
import { OrdersListView } from './components/OrdersListView';
import { ProfileModal } from './components/ProfileModal';
import { SparePartsInventoryView } from './components/SparePartsInventoryView';
import { CompanyCabinet } from './components/CompanyCabinet';

type TabType = 'dispatcher' | 'orders' | 'engineer' | 'warehouse' | 'company';

function getValidTabForRole(role?: string, tab?: string | null): TabType {
  if (role === 'engineer') {
    return 'engineer';
  }
  if (role === 'company') {
    if (tab === 'orders') return 'orders';
    return 'company';
  }
  // dispatcher or default
  if (tab === 'orders' || tab === 'warehouse') return tab;
  return 'dispatcher';
}

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(getSavedUser());
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const savedUser = getSavedUser();
    const savedTab = localStorage.getItem('kofe_active_tab');
    return getValidTabForRole(savedUser?.role, savedTab);
  });
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [threads, setThreads] = useState<ClientThread[]>([]);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [allParts, setAllParts] = useState<SparePart[]>([]);
  const [ordersRefreshCount, setOrdersRefreshCount] = useState<number>(0);

  // Global Auto-Reply state
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [isAutoReplying, setIsAutoReplying] = useState(false);

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalThread, setModalThread] = useState<ClientThread | null>(null);
  const [modalAiData, setModalAiData] = useState<AIAnalysisResult | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleSetActiveTab = (tab: TabType) => {
    const valid = getValidTabForRole(currentUser?.role, tab);
    setActiveTab(valid);
    localStorage.setItem('kofe_active_tab', valid);
  };

  useEffect(() => {
    if (currentUser) {
      setActiveTab((prev) => {
        const valid = getValidTabForRole(currentUser.role, prev);
        localStorage.setItem('kofe_active_tab', valid);
        return valid;
      });
    }
  }, [currentUser?.role, currentUser?.id]);

  // Load auto-reply setting
  useEffect(() => {
    api.getAutoReplySetting()
      .then((res) => setAutoReplyEnabled(res.auto_reply_enabled))
      .catch((err) => console.error('Failed to load auto-reply setting:', err));
  }, []);

  const handleToggleAutoReply = async () => {
    const nextVal = !autoReplyEnabled;
    setAutoReplyEnabled(nextVal);
    try {
      await api.setAutoReplySetting(nextVal);
    } catch (err) {
      console.error('Failed to update auto-reply setting:', err);
    }
  };

  const handleAutoReplyAll = async () => {
    setIsAutoReplying(true);
    try {
      const res = await api.autoReplyAll();
      setAutoReplyEnabled(true);
      await handleRefreshThreads();
      alert(`ИИ ответил во всех чатах (обработано диалогов: ${res.replied_count})`);
    } catch (err: any) {
      alert(err.message || 'Ошибка автоответа');
    } finally {
      setIsAutoReplying(false);
    }
  };

  // Load initial global data
  const loadGlobalData = async () => {
    try {
      const [uList, eqList, pList, thList] = await Promise.all([
        api.getDemoUsers(),
        api.getEquipment(),
        api.getParts(),
        api.getThreads(),
      ]);
      setDemoUsers(uList);
      setAllEquipment(eqList);
      setAllParts(pList);
      setThreads(thList);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadGlobalData();
    }
  }, [currentUser]);

  const handleRefreshThreads = async () => {
    try {
      const thList = await api.getThreads();
      setThreads(thList);
    } catch (err) {
      console.error('Failed to refresh threads:', err);
    }
  };

  const handleRefreshPartsAndEq = async () => {
    try {
      const [pList, eqList] = await Promise.all([api.getParts(), api.getEquipment()]);
      setAllParts(pList);
      setAllEquipment(eqList);
      setOrdersRefreshCount((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to refresh parts and equipment:', err);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const valid = getValidTabForRole(user.role);
    setActiveTab(valid);
    localStorage.setItem('kofe_active_tab', valid);
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
  };

  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    const valid = getValidTabForRole(user.role);
    setActiveTab(valid);
    localStorage.setItem('kofe_active_tab', valid);
  };

  const handleOpenOrderModal = (thread?: ClientThread, aiData?: AIAnalysisResult | null) => {
    setModalThread(thread || null);
    setModalAiData(aiData || null);
    setIsOrderModalOpen(true);
  };

  const handleOrderCreated = () => {
    handleRefreshThreads();
    handleRefreshPartsAndEq();
    setActiveTab('orders');
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} demoUsers={demoUsers} />;
  }

  return (
    <div className="min-h-screen bg-[#0C0D0F] text-[#F3F4F6] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#30D158]/30 selection:text-white">
      {/* Background ambient dark glows in neutral graphite and subtle emerald */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[120px] left-[10%] w-[580px] h-[580px] bg-gradient-to-br from-[#30D158]/5 via-neutral-800/10 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[10%] -right-[100px] w-[620px] h-[620px] bg-gradient-to-bl from-neutral-800/15 via-slate-900/10 to-transparent rounded-full blur-[150px]" />
        <div className="absolute -bottom-[180px] left-[30%] w-[720px] h-[720px] bg-gradient-to-tr from-slate-950/20 via-neutral-900/15 to-transparent rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          onOpenResetModal={() => setIsResetModalOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          autoReplyEnabled={autoReplyEnabled}
          onToggleAutoReply={handleToggleAutoReply}
          onAutoReplyAll={handleAutoReplyAll}
          isAutoReplying={isAutoReplying}
          onSwitchUser={handleSwitchUser}
          allDemoUsers={demoUsers}
          onLogout={handleLogout}
          onOpenLogin={handleLogout}
        />

        <main className="flex-1">
          {activeTab === 'dispatcher' && currentUser.role === 'dispatcher' && (
            <DispatcherDashboard
              onOpenOrderModal={handleOpenOrderModal}
              threads={threads}
              onRefreshThreads={handleRefreshThreads}
              allEquipment={allEquipment}
              allParts={allParts}
              autoReplyEnabled={autoReplyEnabled}
            />
          )}

          {activeTab === 'engineer' && currentUser.role === 'engineer' && (
            <EngineerCabinet
              currentUser={currentUser}
              allEquipment={allEquipment}
            />
          )}

          {activeTab === 'company' && currentUser.role === 'company' && (
            <CompanyCabinet
              currentUser={currentUser}
              allEquipment={allEquipment}
              onRefreshData={() => {
                handleRefreshThreads();
                handleRefreshPartsAndEq();
              }}
            />
          )}

          {activeTab === 'warehouse' && currentUser.role === 'dispatcher' && (
            <SparePartsInventoryView partsList={allParts} />
          )}

          {activeTab === 'orders' && (currentUser.role === 'dispatcher' || currentUser.role === 'company') && (
            <OrdersListView
              onRefreshTrigger={ordersRefreshCount}
              currentUser={currentUser}
              allUsers={demoUsers}
              allParts={allParts}
              allEquipment={allEquipment}
              onRefreshData={handleRefreshPartsAndEq}
            />
          )}
        </main>
      </div>

      {/* Order Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        thread={modalThread}
        aiData={modalAiData}
        allEquipment={allEquipment}
        allParts={allParts}
        allUsers={demoUsers}
        onOrderCreated={handleOrderCreated}
      />

      {/* Excel / Reset Modal */}
      <ExcelResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onDataReset={() => {
          handleRefreshThreads();
          handleRefreshPartsAndEq();
        }}
      />

      {/* Profile Modal */}
      {currentUser && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onProfileUpdated={(updated) => setCurrentUser(updated)}
          onProfileDeleted={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
