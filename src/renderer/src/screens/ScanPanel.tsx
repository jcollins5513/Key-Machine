import React from 'react';

type ScanPanelProps = {
  scanPayload: { key: KeyRecord; suggestedAction: 'check_out' | 'check_in' } | null;
  currentUser: UserRecord | null;
  onCheckOut: (keyId: string) => void;
  onCheckIn: (keyId: string) => void;
};

export const ScanPanel = ({ scanPayload, currentUser, onCheckOut, onCheckIn }: ScanPanelProps) => {
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
  );
};
