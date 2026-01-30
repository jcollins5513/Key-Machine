import React, { useEffect, useMemo, useState } from 'react';
import { TagWriter } from './screens/TagWriter';
import { ScanPanel } from './screens/ScanPanel';
import { KeyList } from './screens/KeyList';

type UserEdit = {
  allowed: number;
  isAdmin: boolean;
};

export const App = () => {
  const api = window.api;
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; reader?: string }>({ connected: false });
  const [scanPayload, setScanPayload] = useState<{ key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [logs, setLogs] = useState<{ level: string; message: string; at: string }[]>([]);

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

  const refreshKeys = async () => {
    if (!api) return;
    setKeys(await api.listKeys());
  };

  const refreshUsers = async () => {
    if (!api) return;
    const list = await api.listUsers();
    setUsers(list);
  };

  useEffect(() => {
    if (!api) {
      setMessage('Bridge not loaded. Preload script failed to expose the API.');
      return;
    }

    refreshKeys();
    refreshUsers();

    api.onNfcStatus(statusUpdate => setStatus(statusUpdate));
    api.onNfcLog(event => {
      setLogs(prev => [...prev.slice(-199), event]);
    });
    api.onNfcTag(payload => {
      setScanPayload(payload);
      setMessage('');
    });
    api.onNfcUnknown(event => {
      setMessage(`Unknown tag detected (${event.keyId ?? 'no NDEF payload'})`);
    });
    api.onNfcError(error => {
      setMessage(error.message);
    });
  }, []);

  useEffect(() => {
    setUserEdits(prev => {
      const next = { ...prev };
      users.forEach(user => {
        if (!next[user.id]) {
          next[user.id] = { allowed: user.allowed_checkout, isAdmin: user.is_admin === 1 };
        }
      });
      return next;
    });
  }, [users]);

  const availableKeys = useMemo(() => keys.filter(key => key.status === 'available'), [keys]);
  const checkedOutKeys = useMemo(() => keys.filter(key => key.status === 'checked_out'), [keys]);

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
    } catch (error) {
      setMessage(`Create user failed: ${String(error)}`);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (!api) return;
    const edit = userEdits[userId];
    if (!edit) return;
    try {
      await api.updateUser({
        id: userId,
        updates: {
          allowed_checkout: edit.allowed,
          is_admin: edit.isAdmin,
        },
      });
      refreshUsers();
    } catch (error) {
      setMessage(`Update user failed: ${String(error)}`);
    }
  };

  const handleCheckOut = async (keyId: string) => {
    if (!api) return;
    if (!currentUser) {
      setMessage('Please log in to check out a key.');
      return;
    }
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
    await api.checkIn(keyId);
    setMessage('Key checked in');
    setScanPayload(null);
    refreshKeys();
  };

  const handleRefreshReader = async () => {
    if (!api) return;
    await api.refreshReader();
    setMessage('Reader refresh requested');
  };

  if (!api) {
    return (
      <div className="app">
        <div className="card">
          <h3>Key Machine</h3>
          <p>Renderer loaded, but the preload bridge is missing.</p>
          <p>Check the main process console for preload path errors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="card">
        <div className="row">
          <div className="status">
            <span className={`status-dot ${status.connected ? 'connected' : ''}`} />
            NFC Reader {status.connected ? 'Connected' : 'Disconnected'}
          </div>
          <div>{status.reader ?? ''}</div>
          <button onClick={handleRefreshReader}>Refresh Reader</button>
        </div>
        {message && <p>{message}</p>}
      </div>

      <div className="card">
        <h3>Login</h3>
        {users.length === 0 && <p>No users yet. Create an admin account below.</p>}
        {currentUser ? (
          <div className="form">
            <div>
              Logged in as <strong>{currentUser.first_name} {currentUser.last_name}</strong>
            </div>
            <div>Department: {currentUser.department || '—'}</div>
            <div>Position: {currentUser.position || '—'}</div>
            <div>Allowed keys: {currentUser.allowed_checkout}</div>
            <div className="actions">
              <button onClick={handleLogout}>Log out</button>
            </div>
            <label>
              Current PIN
              <input
                type="password"
                value={currentPin}
                onChange={event => setCurrentPin(event.target.value)}
              />
            </label>
            <label>
              New PIN
              <input
                type="password"
                value={newPin}
                onChange={event => setNewPin(event.target.value)}
              />
            </label>
            <button onClick={handleUpdatePin} disabled={!currentPin || !newPin}>
              Update PIN
            </button>
          </div>
        ) : (
          <div className="form">
            <label>
              First initial
              <input value={loginInitial} onChange={event => setLoginInitial(event.target.value)} />
            </label>
            <label>
              Last name
              <input value={loginLast} onChange={event => setLoginLast(event.target.value)} />
            </label>
            <label>
              PIN
              <input type="password" value={loginPin} onChange={event => setLoginPin(event.target.value)} />
            </label>
            <button onClick={handleLogin} disabled={!loginInitial || !loginLast || !loginPin}>
              Log in
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <ScanPanel
          scanPayload={scanPayload}
          currentUser={currentUser}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      </div>

      <div className="card">
        <TagWriter onKeyCreated={refreshKeys} />
      </div>

      {canManageUsers && (
        <div className="card">
          <h3>{users.length === 0 ? 'Create Admin User' : 'Users'}</h3>
          <div className="form">
            <label>
              First name
              <input value={newUserFirst} onChange={event => setNewUserFirst(event.target.value)} />
            </label>
            <label>
              Last name
              <input value={newUserLast} onChange={event => setNewUserLast(event.target.value)} />
            </label>
            <label>
              Department
              <input value={newUserDept} onChange={event => setNewUserDept(event.target.value)} />
            </label>
            <label>
              Position
              <input value={newUserPos} onChange={event => setNewUserPos(event.target.value)} />
            </label>
            <label>
              PIN
              <input type="password" value={newUserPin} onChange={event => setNewUserPin(event.target.value)} />
            </label>
            <label>
              Allowed keys
              <input
                type="number"
                min={1}
                value={newUserAllowed}
                onChange={event => setNewUserAllowed(Number(event.target.value))}
              />
            </label>
            <label>
              Admin
              <select
                value={newUserAdmin ? 'yes' : 'no'}
                onChange={event => setNewUserAdmin(event.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <button onClick={handleCreateUser}>Create User</button>
          </div>
          <div className="list">
            {users.map(user => {
              const edit = userEdits[user.id] || { allowed: user.allowed_checkout, isAdmin: user.is_admin === 1 };
              return (
                <div key={user.id} className="list-item">
                  <div className="row">
                    <strong className="grow">
                      {user.first_name} {user.last_name}
                    </strong>
                    <span className={`badge ${user.is_admin === 1 ? 'checked_out' : ''}`}>
                      {user.is_admin === 1 ? 'admin' : 'user'}
                    </span>
                  </div>
                  <div>Department: {user.department || '—'}</div>
                  <div>Position: {user.position || '—'}</div>
                  <div className="row">
                    <label>
                      Allowed keys
                      <input
                        type="number"
                        min={1}
                        value={edit.allowed}
                        onChange={event =>
                          setUserEdits(prev => ({
                            ...prev,
                            [user.id]: { ...edit, allowed: Number(event.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Admin
                      <select
                        value={edit.isAdmin ? 'yes' : 'no'}
                        onChange={event =>
                          setUserEdits(prev => ({
                            ...prev,
                            [user.id]: { ...edit, isAdmin: event.target.value === 'yes' },
                          }))
                        }
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                    <button onClick={() => handleUpdateUser(user.id)}>Save</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <KeyList title="Available Keys" keys={availableKeys} />
      <KeyList title="Checked Out Keys" keys={checkedOutKeys} />

      <div className="card">
        <h3>Reader Log</h3>
        <div className="list">
          {logs.length === 0 && <p>No log entries yet.</p>}
          {[...logs].reverse().map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="list-item">
              <div className="row">
                <span className={`badge ${entry.level}`}>{entry.level}</span>
                <span>{new Date(entry.at).toLocaleTimeString()}</span>
              </div>
              <div>{entry.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
