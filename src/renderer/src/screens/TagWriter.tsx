import React, { useState } from 'react';

type TagWriterProps = {
  keys: KeyRecord[];
  onKeyCreated: () => void;
};

export const TagWriter = ({ keys, onKeyCreated }: TagWriterProps) => {
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const handleWriteExisting = async () => {
    if (!selectedKeyId) return;
    setBusy(true);
    setStatus('Tap a blank tag to write...');
    try {
      await window.api.writeTag(selectedKeyId);
      setStatus('Tag written successfully.');
      setSelectedKeyId('');
      onKeyCreated();
    } catch (error) {
      setStatus(`Write failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleWriteNew = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setStatus('Creating key...');
    try {
      const key = await window.api.createKey(name.trim());
      setStatus('Tap a blank tag to write...');
      await window.api.writeTag(key.id);
      setStatus('Tag written successfully.');
      setName('');
      onKeyCreated();
    } catch (error) {
      setStatus(`Write failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleErase = async () => {
    if (!window.confirm('Erase tag data so it can be reused?')) return;
    setBusy(true);
    setStatus('Tap a tag to erase...');
    try {
      await window.api.eraseTag();
      setStatus('Tag erased successfully.');
    } catch (error) {
      setStatus(`Erase failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const vehiclesWithStock = keys.filter((k) => k.stock_number && k.status !== 'sold');

  return (
    <div>
      <h3>Tag Writer (Admin)</h3>
      <p>Write stock number to NFC tag for vehicle checkout.</p>
      {vehiclesWithStock.length > 0 && (
        <div className="form">
          <label>
            Select vehicle
            <select
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              disabled={busy}
            >
              <option value="">— Select vehicle —</option>
              {vehiclesWithStock.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.stock_number} — {k.year} {k.make} {k.model}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button onClick={handleWriteExisting} disabled={busy || !selectedKeyId}>
              {busy ? 'Waiting for tag...' : 'Write Tag'}
            </button>
          </div>
        </div>
      )}
      <div className="form" style={{ marginTop: '1rem' }}>
        <label>
          Or create new key
          <input
            placeholder="Key name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="actions">
          <button onClick={handleWriteNew} disabled={busy || !name.trim()}>
            {busy ? 'Waiting for tag...' : 'Create & Write'}
          </button>
        </div>
      </div>
      <div className="actions" style={{ marginTop: '0.5rem' }}>
        <button onClick={handleErase} disabled={busy}>
          {busy ? 'Waiting for tag...' : 'Erase Tag'}
        </button>
      </div>
      {status && <p>{status}</p>}
    </div>
  );
};
