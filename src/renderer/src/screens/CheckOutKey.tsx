import React from 'react';
import { ScanPanel } from './ScanPanel';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';
import { VehicleSearchPicker } from '../components/VehicleSearchPicker';

type CheckOutKeyProps = {
  keys: KeyRecord[];
  scanPayload: { key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null;
  currentUser: UserRecord | null;
  status: { connected: boolean; reader?: string };
  onCheckOut: (keyId: string) => void;
  onCheckIn: (keyId: string) => void;
  onLogout: () => void;
  onAnotherKey: () => void;
  onRefreshReader: () => void;
  message: string;
};

export const CheckOutKey = ({
  keys,
  scanPayload,
  currentUser,
  status,
  onCheckOut,
  onCheckIn,
  onLogout,
  onAnotherKey,
  onRefreshReader,
  message,
}: CheckOutKeyProps) => (
  <PageLayout title="Check Out Key" subtitle="Scan an NFC tag to check out or return a vehicle key.">
    <Card>
      <div className="row">
        <div className="status">
          <span className={`status-dot ${status.connected ? 'connected' : ''}`} />
          NFC Reader {status.connected ? 'Connected' : 'Disconnected'}
        </div>
        <div>{status.reader ?? ''}</div>
        <button onClick={onRefreshReader} className="btn-secondary">Refresh Reader</button>
      </div>
      {message && <p className="error">{message}</p>}
    </Card>
    <Card>
      <ScanPanel
        scanPayload={scanPayload}
        currentUser={currentUser}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        onLogout={onLogout}
        onAnotherKey={onAnotherKey}
      />
      {!scanPayload && keys.filter((k) => k.status === 'available').length > 0 && (
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <p className="muted" style={{ marginBottom: '12px' }}>
            Or search by year, make, or model to check out without scanning
          </p>
          <VehicleSearchPicker
            keys={keys}
            statusFilter="available"
            placeholder="Search by year, make, model, or stock number..."
            showHistory={true}
            actionLabel={currentUser ? 'Check Out' : undefined}
            onAction={currentUser ? onCheckOut : undefined}
          />
        </div>
      )}
    </Card>
  </PageLayout>
);
