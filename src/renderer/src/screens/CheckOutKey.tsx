import React from 'react';
import { ScanPanel } from './ScanPanel';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type CheckOutKeyProps = {
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
    </Card>
  </PageLayout>
);
