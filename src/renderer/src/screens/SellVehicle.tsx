import React, { useState } from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';
import { VehicleSearchPicker } from '../components/VehicleSearchPicker';

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

  const handleSellFromSearch = async (keyId: string) => {
    setBusy(true);
    try {
      await onSell(keyId, { attemptErase: false });
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
              <div style={{ marginTop: '1rem' }}>
                <p className="muted" style={{ marginBottom: '12px' }}>
                  Or search by year, make, or model to select a vehicle (if scan fails)
                </p>
                <VehicleSearchPicker
                  keys={keys}
                  statusFilter="unsold"
                  placeholder="Search by year, make, model, or stock number..."
                  showHistory={true}
                  actionLabel={busy ? 'Processing...' : 'Sell Selected Vehicle'}
                  onAction={handleSellFromSearch}
                  actionDisabled={busy}
                />
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
