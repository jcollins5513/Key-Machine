import React, { useState } from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type SellVehicleProps = {
  keys: KeyRecord[];
  scanPayload: { key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null;
  onSell: (keyId: string, options?: { attemptErase?: boolean }) => Promise<void>;
  onClearScan: () => void;
  status: { connected: boolean; reader?: string };
  message: string;
};

export const SellVehicle = ({ keys, scanPayload, onSell, onClearScan, status, message }: SellVehicleProps) => {
  const [busy, setBusy] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState('');

  const handleSellFromScan = async () => {
    if (!scanPayload) return;
    setBusy(true);
    try {
      await onSell(scanPayload.key.id, { attemptErase: true });
      onClearScan();
    } finally {
      setBusy(false);
    }
  };

  const handleSellFromDropdown = async () => {
    if (!selectedKeyId) return;
    setBusy(true);
    try {
      await onSell(selectedKeyId, { attemptErase: false });
      setSelectedKeyId('');
    } finally {
      setBusy(false);
    }
  };

  const vehicleLabel = scanPayload
    ? [scanPayload.key.year, scanPayload.key.make, scanPayload.key.model].filter(Boolean).join(' ') || scanPayload.key.name
    : '';

  return (
    <PageLayout title="Sell Vehicle" subtitle="Scan the vehicle's NFC tag to remove it from inventory and erase the tag.">
      <Card>
        <div className="row">
          <div className="status">
            <span className={`status-dot ${status.connected ? 'connected' : ''}`} />
            NFC Reader {status.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        {!scanPayload ? (
          <>
            <p className="scan-prompt">Tap the vehicle's NFC tag to sell and remove it from inventory.</p>
            {keys.filter((k) => k.status !== 'sold').length > 0 && (
              <div className="form" style={{ marginTop: '1rem' }}>
                <label>
                  Or select vehicle to sell (if scan fails)
                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">— Select vehicle —</option>
                    {keys.filter((k) => k.status !== 'sold').map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.stock_number ? `#${k.stock_number} ` : ''}
                        {[k.year, k.make, k.model].filter(Boolean).join(' ') || k.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="actions" style={{ marginTop: '0.5rem' }}>
                  <button
                    onClick={handleSellFromDropdown}
                    disabled={busy || !selectedKeyId}
                    className="btn-danger"
                  >
                    {busy ? 'Processing...' : 'Sell Selected Vehicle'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="sell-confirm">
            <h4>{vehicleLabel}</h4>
            <p className="vehicle-meta">
              {scanPayload.key.stock_number && `Stock #${scanPayload.key.stock_number}`}
              {scanPayload.key.vin_last8 && ` | VIN ...${scanPayload.key.vin_last8}`}
            </p>
            <p className="sell-warning">This will mark the vehicle as sold and erase the NFC tag.</p>
            <div className="actions">
              <button onClick={handleSellFromScan} disabled={busy} className="btn-danger">
                {busy ? 'Processing...' : 'Confirm Sell'}
              </button>
              <button onClick={onClearScan} disabled={busy} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
        {message && <p className="error">{message}</p>}
      </Card>
    </PageLayout>
  );
};
