import React, { useEffect, useMemo, useState } from 'react';
import { TagWriter } from './screens/TagWriter';
import { ScanPanel } from './screens/ScanPanel';
import { KeyList } from './screens/KeyList';

export const App = () => {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [holders, setHolders] = useState<HolderRecord[]>([]);
  const [status, setStatus] = useState<{ connected: boolean; reader?: string }>({ connected: false });
  const [scanPayload, setScanPayload] = useState<{ key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [holderName, setHolderName] = useState('');

  const refreshKeys = async () => {
    setKeys(await window.api.listKeys());
  };

  const refreshHolders = async () => {
    setHolders(await window.api.listHolders());
  };

  useEffect(() => {
    refreshKeys();
    refreshHolders();

    window.api.onNfcStatus(statusUpdate => setStatus(statusUpdate));
    window.api.onNfcTag(payload => {
      setScanPayload(payload);
      setMessage('');
    });
    window.api.onNfcUnknown(event => {
      setMessage(`Unknown tag detected (${event.keyId ?? 'no NDEF payload'})`);
    });
    window.api.onNfcError(error => {
      setMessage(error.message);
    });
  }, []);

  const availableKeys = useMemo(() => keys.filter(key => key.status === 'available'), [keys]);
  const checkedOutKeys = useMemo(() => keys.filter(key => key.status === 'checked_out'), [keys]);

  const handleCreateHolder = async () => {
    if (!holderName.trim()) return;
    await window.api.createHolder(holderName.trim());
    setHolderName('');
    refreshHolders();
  };

  const handleCheckOut = async (keyId: string, holderId: string) => {
    await window.api.checkOut(keyId, holderId);
    setMessage('Key checked out');
    setScanPayload(null);
    refreshKeys();
  };

  const handleCheckIn = async (keyId: string) => {
    await window.api.checkIn(keyId);
    setMessage('Key checked in');
    setScanPayload(null);
    refreshKeys();
  };

  return (
    <div className="app">
      <div className="card">
        <div className="row">
          <div className="status">
            <span className={`status-dot ${status.connected ? 'connected' : ''}`} />
            NFC Reader {status.connected ? 'Connected' : 'Disconnected'}
          </div>
          <div>{status.reader ?? ''}</div>
        </div>
        {message && <p>{message}</p>}
      </div>

      <div className="card">
        <ScanPanel
          scanPayload={scanPayload}
          holders={holders}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      </div>

      <div className="card">
        <TagWriter onKeyCreated={refreshKeys} />
      </div>

      <div className="card">
        <h3>Holders</h3>
        <div className="form">
          <input
            placeholder="New holder name"
            value={holderName}
            onChange={event => setHolderName(event.target.value)}
          />
          <button onClick={handleCreateHolder}>Add Holder</button>
        </div>
        <div className="list">
          {holders.map(holder => (
            <div key={holder.id} className="list-item">
              <strong>{holder.name}</strong>
            </div>
          ))}
        </div>
      </div>

      <KeyList title="Available Keys" keys={availableKeys} />
      <KeyList title="Checked Out Keys" keys={checkedOutKeys} />
    </div>
  );
};
