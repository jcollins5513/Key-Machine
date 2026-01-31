import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { CheckOutKey } from './screens/CheckOutKey';
import { AddUser } from './screens/AddUser';
import { AddVehicle } from './screens/AddVehicle';
import { SellVehicle } from './screens/SellVehicle';
import { CurrentUsers } from './screens/CurrentUsers';
import { Inventory } from './screens/Inventory';
import { License } from './screens/License';
import { ReadTag } from './screens/ReadTag';

type UserEdit = { allowed: number; isAdmin: boolean };

export const App = () => {
  const api = window.api;
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('checkout');
  const [status, setStatus] = useState<{ connected: boolean; reader?: string }>({ connected: false });
  const [scanPayload, setScanPayload] = useState<{ key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null>(null);
  const [tagDataRaw, setTagDataRaw] = useState<{ payload: string; uid?: string } | null>(null);
  const [message, setMessage] = useState<string>('');

  const [loginInitial, setLoginInitial] = useState('');
  const [loginLast, setLoginLast] = useState('');
  const [loginPin, setLoginPin] = useState('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const [newUserFirst, setNewUserFirst] = useState('');
  const [newUserLast, setNewUserLast] = useState('');
  const [newUserDept, setNewUserDept] = useState('');
  const [newUserPos, setNewUserPos] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserAllowed, setNewUserAllowed] = useState(1);
  const [newUserAdmin, setNewUserAdmin] = useState(false);
  const [userEdits, setUserEdits] = useState<Record<string, UserEdit>>({});
  const canManageUsers = currentUser?.is_admin === 1 || users.length === 0;
  const isAdmin = currentUser?.is_admin === 1;

  const refreshKeys = async () => {
    if (!api) return;
    setKeys(await api.listKeys());
  };

  const refreshUsers = async () => {
    if (!api) return;
    setUsers(await api.listUsers());
  };

  useEffect(() => {
    if (!api) return;
    refreshKeys();
    refreshUsers();
    api.onNfcStatus(statusUpdate => setStatus(statusUpdate));
    api.onNfcTag(payload => {
      setScanPayload(payload);
      setMessage('');
    });
    api.onNfcUnknown(() => {
      setMessage('Unknown tag. No vehicle found for this tag.');
    });
    api.onNfcError(error => setMessage(error.message));
  }, []);

  useEffect(() => {
    setUserEdits(prev => {
      const next = { ...prev };
      users.forEach(user => {
        if (!next[user.id]) next[user.id] = { allowed: user.allowed_checkout, isAdmin: user.is_admin === 1 };
      });
      return next;
    });
  }, [users]);

  const handleLogin = async () => {
    if (!api) return;
    try {
      const user = await api.login({ initial: loginInitial.trim(), last_name: loginLast.trim(), pin: loginPin });
      setCurrentUser(user);
      setMessage('');
      setLoginPin('');
    } catch (error) {
      setMessage(`Login failed: ${String(error)}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setScanPayload(null);
    setActiveTab('checkout');
  };

  const handleUpdatePin = async () => {
    if (!api || !currentUser) return;
    try {
      const user = await api.updatePin({ userId: currentUser.id, currentPin, newPin });
      setCurrentUser(user);
      setCurrentPin('');
      setNewPin('');
      setMessage('PIN updated.');
    } catch (error) {
      setMessage(`PIN update failed: ${String(error)}`);
    }
  };

  const handleCreateUser = async () => {
    if (!api) return;
    if (!newUserFirst.trim() || !newUserLast.trim() || !newUserPin) return;
    try {
      await api.createUser({
        first_name: newUserFirst.trim(),
        last_name: newUserLast.trim(),
        department: newUserDept.trim() || null,
        position: newUserPos.trim() || null,
        pin: newUserPin,
        allowed_checkout: newUserAllowed,
        is_admin: newUserAdmin,
      });
      setNewUserFirst('');
      setNewUserLast('');
      setNewUserDept('');
      setNewUserPos('');
      setNewUserPin('');
      setNewUserAllowed(1);
      setNewUserAdmin(false);
      refreshUsers();
      setMessage('User created.');
    } catch (error) {
      setMessage(`Create user failed: ${String(error)}`);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (!api) return;
    const edit = userEdits[userId];
    if (!edit) return;
    try {
      await api.updateUser({ id: userId, updates: { allowed_checkout: edit.allowed, is_admin: edit.isAdmin } });
      refreshUsers();
      setMessage('User updated.');
    } catch (error) {
      setMessage(`Update user failed: ${String(error)}`);
    }
  };

  const handleCheckOut = async (keyId: string) => {
    if (!api || !currentUser) return;
    try {
      await api.checkOut(keyId, currentUser.id);
      setMessage('Key checked out');
      setScanPayload(null);
      refreshKeys();
    } catch (error) {
      setMessage(`Checkout failed: ${String(error)}`);
    }
  };

  const handleCheckIn = async (keyId: string) => {
    if (!api) return;
    try {
      await api.checkIn(keyId);
      setMessage('Key checked in');
      setScanPayload(null);
      refreshKeys();
    } catch (error) {
      setMessage(`Check-in failed: ${String(error)}`);
    }
  };

  const handleSell = async (keyId: string, options?: { attemptErase?: boolean }) => {
    if (!api) return;
    const attemptErase = options?.attemptErase ?? true;
    try {
      await api.sellKey(keyId);
      setScanPayload(null);
      refreshKeys();
      if (!attemptErase) {
        setMessage('Vehicle sold.');
        return;
      }
      setMessage('Vehicle sold. Tap the tag again to erase it.');
      try {
        await api.eraseTag();
        setMessage('Vehicle sold. Tag erased.');
      } catch (eraseErr) {
        setMessage(
          'Vehicle sold. Tag could not be erased—hold the tag steady on the reader and use Erase Tag in Add Vehicle to retry.'
        );
      }
    } catch (error) {
      setMessage(`Sell failed: ${String(error)}`);
    }
  };

  const handleRefreshReader = async () => {
    if (!api) return;
    await api.refreshReader();
    setMessage('Reader refresh requested');
  };

  const handleTabChange = (tab: TabId) => {
    if (tab === 'logout') {
      handleLogout();
      return;
    }
    setActiveTab(tab);
    setMessage('');
  };

  if (!api) {
    return (
      <div className="app login-only">
        <div className="card login-card">
          <h3>Key Machine</h3>
          <p>Renderer loaded, but the preload bridge is missing.</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app login-only">
        <div className="card login-card">
          <h2>Key Machine</h2>
          <h3>Log In</h3>
          {users.length === 0 && <p className="login-hint">No users yet. Create an admin account below.</p>}
          <div className="form">
            <label>First initial <input placeholder="e.g. J" value={loginInitial} onChange={e => setLoginInitial(e.target.value)} autoFocus /></label>
            <label>Last name <input placeholder="e.g. Smith" value={loginLast} onChange={e => setLoginLast(e.target.value)} /></label>
            <label>PIN <input type="password" placeholder="••••" value={loginPin} onChange={e => setLoginPin(e.target.value)} /></label>
            <button onClick={handleLogin} disabled={!loginInitial || !loginLast || !loginPin}>Log in</button>
          </div>
          {message && <p className="error">{message}</p>}
          {canManageUsers && (
            <div className="create-admin">
              <h4>Create Admin User</h4>
              <div className="form">
                <label>First name <input value={newUserFirst} onChange={e => setNewUserFirst(e.target.value)} /></label>
                <label>Last name <input value={newUserLast} onChange={e => setNewUserLast(e.target.value)} /></label>
                <label>Department <input value={newUserDept} onChange={e => setNewUserDept(e.target.value)} /></label>
                <label>Position <input value={newUserPos} onChange={e => setNewUserPos(e.target.value)} /></label>
                <label>PIN <input type="password" value={newUserPin} onChange={e => setNewUserPin(e.target.value)} /></label>
                <label>Allowed keys <input type="number" min={1} value={newUserAllowed} onChange={e => setNewUserAllowed(Number(e.target.value))} /></label>
                <label>Admin <select value={newUserAdmin ? 'yes' : 'no'} onChange={e => setNewUserAdmin(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></label>
                <button onClick={handleCreateUser} disabled={!newUserFirst.trim() || !newUserLast.trim() || !newUserPin}>Create Admin</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userName = `${currentUser.first_name} ${currentUser.last_name}`;

  const renderContent = () => {
    switch (activeTab) {
      case 'checkout':
        return (
          <CheckOutKey
            keys={keys}
            scanPayload={activeTab === 'checkout' ? scanPayload : null}
            currentUser={currentUser}
            status={status}
            onCheckOut={handleCheckOut}
            onCheckIn={handleCheckIn}
            onLogout={handleLogout}
            onAnotherKey={() => setScanPayload(null)}
            onRefreshReader={handleRefreshReader}
            message={message}
          />
        );
      case 'add-user':
        return (
          <AddUser
            newUserFirst={newUserFirst}
            newUserLast={newUserLast}
            newUserDept={newUserDept}
            newUserPos={newUserPos}
            newUserPin={newUserPin}
            newUserAllowed={newUserAllowed}
            newUserAdmin={newUserAdmin}
            onFirstChange={setNewUserFirst}
            onLastChange={setNewUserLast}
            onDeptChange={setNewUserDept}
            onPosChange={setNewUserPos}
            onPinChange={setNewUserPin}
            onAllowedChange={setNewUserAllowed}
            onAdminChange={setNewUserAdmin}
            onCreate={handleCreateUser}
            message={message}
          />
        );
      case 'add-vehicle':
        return <AddVehicle keys={keys} onKeyCreated={refreshKeys} onImportComplete={refreshKeys} />;
      case 'sell-vehicle':
        return (
          <SellVehicle
            keys={keys}
            scanPayload={activeTab === 'sell-vehicle' ? scanPayload : null}
            onSell={handleSell}
            onClearScan={() => setScanPayload(null)}
            status={status}
            message={message}
          />
        );
      case 'users':
        return (
          <CurrentUsers
            users={users}
            userEdits={userEdits}
            onEditChange={(userId, edit) => setUserEdits(prev => ({ ...prev, [userId]: edit }))}
            onSave={handleUpdateUser}
            message={message}
          />
        );
      case 'read-tag':
        return <ReadTag status={status} tagData={tagDataRaw} message={message} />;
      case 'inventory':
        return (
          <Inventory
            keys={keys}
            onPairTag={async (keyId) => api.writeTag(keyId)}
            onRefresh={refreshKeys}
          />
        );
      case 'license':
        return <License message={message} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-with-sidebar">
      <div className="app-backdrop" />
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isAdmin={isAdmin}
        userName={userName}
      />
      <main className="app-main">
        {renderContent()}
      </main>
    </div>
  );
};
