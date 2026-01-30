import React, { useState } from 'react';

type TagWriterProps = {
  onKeyCreated: () => void;
};

export const TagWriter = ({ onKeyCreated }: TagWriterProps) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const handleWrite = async () => {
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

  return (
    <div>
      <h3>Tag Writer</h3>
      <div className="form">
        <input
          placeholder="Key name"
          value={name}
          onChange={event => setName(event.target.value)}
          disabled={busy}
        />
        <div className="actions">
          <button onClick={handleWrite} disabled={busy}>
          {busy ? 'Waiting for tag...' : 'Write Tag'}
          </button>
          <button onClick={handleErase} disabled={busy}>
            {busy ? 'Waiting for tag...' : 'Erase Tag'}
          </button>
        </div>
      </div>
      {status && <p>{status}</p>}
    </div>
  );
};
