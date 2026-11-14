import React, { useState, useEffect } from 'react';
import { api, getSavedUser, clearToken } from './api';
import { User, ClientThread, Equipment, SparePart, AIAnalysisResult } from './types';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { DispatcherDashboard } from './components/DispatcherDashboard';
import { OrderModal } from './components/OrderModal';
import { SimulatorModal } from './components/SimulatorModal';
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

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalThread, setModalThread] = useState<ClientThread | null>(null);
  const [modalAiData, setModalAiData] = useState<AIAnalysisResult | null>(null);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
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
    loadGlobalData();
  }, []);

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
      const [eqList, pList] = await Promise.all([
        api.getEquipment(),
        api.getParts(),
      ]);
      setAllEquipment(eqList);
      setAllParts(pList);
      setOrdersRefreshCount((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to refresh parts and equipment:', err);
    }
  };

  const handleOpenOrderModal = (thread?: ClientThread, aiData?: AIAnalysisResult | null) => {
    setModalThread(thread || null);
    setModalAiData(aiData || null);
    setIsOrderModalOpen(true);
  };

  const handleOrderCreated = () => {
    handleRefreshThreads();
    handleRefreshPartsAndEq();
    handleSetActiveTab('orders');
  };

  const handleSwitchUser = async (user: User) => {
    try {
      localStorage.removeItem('kofe_explicit_logout');
      const res = await api.switchUser(user.id);
      setCurrentUser(res.user);
      const defaultTab = getValidTabForRole(res.user.role, null);
      handleSetActiveTab(defaultTab);
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.setItem('kofe_explicit_logout', 'true');
    localStorage.removeItem('kofe_active_tab');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          localStorage.removeItem('kofe_explicit_logout');
          setCurrentUser(user);
          const defaultTab = getValidTabForRole(user.role, null);
          handleSetActiveTab(defaultTab);
          loadGlobalData();
        }}
        demoUsers={demoUsers}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080A09] text-[#F0F5F2] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#4A6751]/30 selection:text-white">
      {/* Background ambient dark glows inspired by Web3 Dark aesthetic (Photo 1) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-left deep emerald/teal glow */}
        <div className="absolute -top-[120px] left-[5%] w-[580px] h-[580px] bg-gradient-to-br from-[#1C4332]/25 via-[#23533E]/15 to-transparent rounded-full blur-[140px]" />
        {/* Top-right warm amber/orange web3 glow */}
        <div className="absolute top-[5%] -right-[100px] w-[620px] h-[620px] bg-gradient-to-bl from-[#7D4A22]/20 via-[#5E381A]/15 to-transparent rounded-full blur-[150px]" />
        {/* Center-bottom cool indigo/cyan glow */}
        <div className="absolute -bottom-[180px] left-[30%] w-[720px] h-[720px] bg-gradient-to-tr from-[#1B3545]/20 via-[#1E2E25]/15 to-transparent rounded-full blur-[160px]" />
        {/* Middle-left ambient accent */}
        <div className="absolute top-[50%] -left-[120px] w-[480px] h-[480px] bg-gradient-to-r from-[#224536]/20 to-transparent rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          onOpenResetModal={() => setIsResetModalOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenSimulatorModal={() => setIsSimulatorModalOpen(true)}
          onSwitchUser={handleSwitchUser}
          allDemoUsers={demoUsers}
          onLogout={handleLogout}
          onOpenLogin={handleLogout}
        />

        <main className="flex-1">
          {activeTab === 'dispatcher' && currentUser.role === 'dispatcher' && (
            <DispatcherDashboard
              onOpenOrderModal={handleOpenOrderModal}
              onOpenSimulatorModal={() => setIsSimulatorModalOpen(true)}
              threads={threads}
              onRefreshThreads={handleRefreshThreads}
              allEquipment={allEquipment}
              allParts={allParts}
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

      {/* Simulator Modal */}
      <SimulatorModal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        onSimulationSuccess={() => {
          handleRefreshThreads();
          setActiveTab('dispatcher');
        }}
      />

      {/* Excel / Reset Modal */}
      <ExcelResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onDataReset={() => {
          loadGlobalData();
        }}
      />

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => {
          setCurrentUser(updated);
          setDemoUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        }}
        onProfileDeleted={() => {
          handleLogout();
          loadGlobalData();
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;
