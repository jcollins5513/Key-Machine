import React, { useEffect, useState } from 'react';

type ScanPanelProps = {
  scanPayload: { key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null;
  currentUser: UserRecord | null;
  onCheckOut: (keyId: string) => void;
  onCheckIn: (keyId: string) => void;
  onLogout?: () => void;
  onAnotherKey?: () => void;
};

export const ScanPanel = ({ scanPayload, currentUser, onCheckOut, onCheckIn, onLogout, onAnotherKey }: ScanPanelProps) => {
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => {
    if (scanPayload?.key?.id && window.api) {
      window.api.listEventsByKey(scanPayload.key.id).then(setEvents);
    } else {
      setEvents([]);
    }
  }, [scanPayload?.key?.id]);

  if (!scanPayload) {
    return (
      <div>
        <h3>Ready to Scan</h3>
        <p>Tap a tag to begin a check-in or check-out.</p>
      </div>
    );
  }

  const { key, suggestedAction } = scanPayload;
  const vehicleLabel = [key.year, key.make, key.model].filter(Boolean).join(' ') || key.name;
  const stockLabel = key.stock_number ? `Stock #${key.stock_number}` : null;
  const vinLabel = key.vin_last8 ? `VIN ...${key.vin_last8}` : null;

  return (
    <div>
      <h3>Vehicle</h3>
      <div className="vehicle-card">
        {key.photo_path && (
          <div className="vehicle-photo">
            <img src={key.photo_path} alt={vehicleLabel} />
          </div>
        )}
        <div className="vehicle-details">
          <h4>{vehicleLabel}</h4>
          {(stockLabel || vinLabel) && (
            <p className="vehicle-meta">
              {[vinLabel, stockLabel].filter(Boolean).join(' | ')}
            </p>
          )}
          <div className="vehicle-status">
            <span className={`badge ${key.status === 'checked_out' ? 'checked_out' : 'info'}`}>
              {key.status === 'available' ? 'Available' : 'Checked Out'}
            </span>
          </div>
          {suggestedAction === 'check_out' ? (
            <div className="form">
              {currentUser ? (
                <p>
                  Checking out to <strong>{currentUser.first_name} {currentUser.last_name}</strong>
                </p>
              ) : (
                <p>Log in to check out this key.</p>
              )}
              <button onClick={() => currentUser && onCheckOut(key.id)} disabled={!currentUser}>
                Confirm Check-Out
              </button>
            </div>
          ) : (
            <div className="actions">
              <button onClick={() => onCheckIn(key.id)}>Confirm Check-In</button>
            </div>
          )}
        </div>
      </div>

      {events.length > 0 && (
        <div className="usage-history">
          <h4>Usage History</h4>
          <div className="list">
            {events.slice(0, 10).map((e) => (
              <div key={e.id} className="list-item">
                <div className="row">
                  <span>{e.action.replace(/_/g, ' ')}</span>
                  {e.holder_name && <span>{e.holder_name}</span>}
                </div>
                <span className="muted">{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(onLogout || onAnotherKey) && (
        <div className="scan-overlay">
          <p>What would you like to do?</p>
          <div className="actions">
            {onAnotherKey && (
              <button onClick={onAnotherKey}>Check out another key</button>
            )}
            {onLogout && (
              <button onClick={onLogout} className="secondary">Log off</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
