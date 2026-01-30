import React, { useEffect, useState } from 'react';

type ScanPanelProps = {
  scanPayload: { key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null;
  holders: HolderRecord[];
  onCheckOut: (keyId: string, holderId: string) => void;
  onCheckIn: (keyId: string) => void;
};

export const ScanPanel = ({ scanPayload, holders, onCheckOut, onCheckIn }: ScanPanelProps) => {
  const [holderId, setHolderId] = useState('');

  useEffect(() => {
    setHolderId('');
  }, [scanPayload?.key.id]);

  if (!scanPayload) {
    return (
      <div>
        <h3>Scan Status</h3>
        <p>Tap a tag to begin a check-in or check-out.</p>
      </div>
    );
  }

  const { key, suggestedAction } = scanPayload;

  return (
    <div>
      <h3>Scan Status</h3>
      <p>
        Detected <strong>{key.name}</strong> ({key.id})
      </p>
      {suggestedAction === 'check_out' ? (
        <div className="form">
          <label>
            Assign to holder
            <select value={holderId} onChange={event => setHolderId(event.target.value)}>
              <option value="">Select holder</option>
              {holders.map(holder => (
                <option key={holder.id} value={holder.id}>
                  {holder.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => holderId && onCheckOut(key.id, holderId)} disabled={!holderId}>
            Confirm Check-Out
          </button>
        </div>
      ) : (
        <div className="actions">
          <button onClick={() => onCheckIn(key.id)}>Confirm Check-In</button>
        </div>
      )}
    </div>
  );
};
