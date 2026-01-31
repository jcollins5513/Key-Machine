import React, { useMemo, useState } from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type InventoryProps = {
  keys: KeyRecord[];
  onPairTag: (keyId: string) => Promise<void>;
  onRefresh: () => void;
};

export const Inventory = ({ keys, onPairTag, onRefresh }: InventoryProps) => {
  const [selectedKey, setSelectedKey] = useState<KeyRecord | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pairStatus, setPairStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filterBySearch = (list: KeyRecord[]) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((k) => {
      const year = (k.year ?? '').toLowerCase();
      const make = (k.make ?? '').toLowerCase();
      const model = (k.model ?? '').toLowerCase();
      const stock = (k.stock_number ?? '').toLowerCase();
      const name = (k.name ?? '').toLowerCase();
      return year.includes(q) || make.includes(q) || model.includes(q) || stock.includes(q) || name.includes(q);
    });
  };

  const available = useMemo(() => filterBySearch(keys.filter(k => k.status === 'available')), [keys, searchQuery]);
  const checkedOut = useMemo(() => filterBySearch(keys.filter(k => k.status === 'checked_out')), [keys, searchQuery]);
  const sold = useMemo(() => filterBySearch(keys.filter(k => k.status === 'sold')), [keys, searchQuery]);

  const handlePairTag = async () => {
    if (!selectedKey) return;
    setPairing(true);
    setPairStatus('Tap a blank NFC tag to pair...');
    try {
      await onPairTag(selectedKey.id);
      setPairStatus('Tag paired successfully!');
      setSelectedKey(null);
      onRefresh();
    } catch (err) {
      setPairStatus(`Pairing failed: ${String(err)}`);
    } finally {
      setPairing(false);
    }
  };

  const KeyCard = ({ item, onClick, disabled }: { item: KeyRecord; onClick: () => void; disabled?: boolean }) => {
    const k = item;
    const label = [k.year, k.make, k.model].filter(Boolean).join(' ') || k.name;
    const meta = [k.stock_number && `Stock #${k.stock_number}`, k.vin_last8 && `VIN ...${k.vin_last8}`].filter(Boolean).join(' | ');
    const isPaired = k.tag_paired === 1;
    const isSold = k.status === 'sold';
    return (
      <div
        className={`inventory-item ${selectedKey?.id === k.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={disabled ? undefined : (e) => e.key === 'Enter' && onClick()}
      >
        {k.photo_path && <div className="inventory-item-photo"><img src={k.photo_path} alt={label} /></div>}
        <div className="inventory-item-details">
          <strong>{label}</strong>
          {meta && <span className="muted">{meta}</span>}
          {k.last_holder_name && !isSold && <span>Out with: {k.last_holder_name}</span>}
        </div>
        <div className="inventory-badges">
          <span className={`badge ${isSold ? 'badge-sold' : k.status}`}>
            {k.status === 'available' ? 'Available' : k.status === 'checked_out' ? 'Checked Out' : 'Sold'}
          </span>
          {isPaired && !isSold && <span className="badge badge-paired">NFC Paired</span>}
        </div>
      </div>
    );
  };

  return (
    <PageLayout title="Inventory" subtitle="Click a vehicle to pair its NFC tag. View all vehicle keys and their status.">
      <div className="inventory-layout">
        <div className="inventory-list">
          <div className="form" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search by year, make, model, or stock number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Card title="Available">
            <div className="inventory-grid">
              {available.length === 0 && <p>No available keys.</p>}
              {available.map(k => <KeyCard key={k.id} item={k} onClick={() => setSelectedKey(k)} />)}
            </div>
          </Card>
          <Card title="Checked Out">
            <div className="inventory-grid">
              {checkedOut.length === 0 && <p>No keys checked out.</p>}
              {checkedOut.map(k => <KeyCard key={k.id} item={k} onClick={() => setSelectedKey(k)} />)}
            </div>
          </Card>
          <Card title="Sold">
            <div className="inventory-grid">
              {sold.length === 0 && <p>No sold vehicles. Removed when no longer in daily import.</p>}
              {sold.map(k => <KeyCard key={k.id} item={k} onClick={() => {}} disabled />)}
            </div>
          </Card>
        </div>
        {selectedKey && (
          <Card className="inventory-pair-panel">
            <h4>{[selectedKey.year, selectedKey.make, selectedKey.model].filter(Boolean).join(' ') || selectedKey.name}</h4>
            <p className="muted">{selectedKey.stock_number && `Stock #${selectedKey.stock_number}`}</p>
            {(selectedKey.tag_paired === 1 || selectedKey.tag_paired === true) ? (
              <p className="paired-status">✓ NFC tag already paired</p>
            ) : (
              <>
                <p>Pair an NFC tag to this vehicle for checkout scanning.</p>
                <p className="muted">Hold the tag flat and steady on the reader until pairing completes.</p>
                <div className="actions">
                  <button onClick={handlePairTag} disabled={pairing}>
                    {pairing ? 'Waiting for tag...' : 'Pair NFC Tag'}
                  </button>
                  <button onClick={() => { setSelectedKey(null); setPairStatus(''); }} className="btn-secondary" disabled={pairing}>
                    Cancel
                  </button>
                </div>
                {pairStatus && <p className={pairStatus.includes('failed') ? 'error' : ''}>{pairStatus}</p>}
              </>
            )}
          </Card>
        )}
      </div>
    </PageLayout>
  );
};
