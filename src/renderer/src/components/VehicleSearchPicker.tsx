import React, { useEffect, useMemo, useState } from 'react';

type VehicleSearchPickerProps = {
  keys: KeyRecord[];
  onSelect?: (key: KeyRecord) => void;
  /** Filter keys by status. 'all' = all vehicles including sold, 'unsold' = available + checked_out, 'available' = available only */
  statusFilter?: 'available' | 'unsold' | 'all';
  /** Placeholder for search input */
  placeholder?: string;
  /** Show history when vehicle is selected */
  showHistory?: boolean;
  /** Custom action button when vehicle selected (e.g., "Sell", "Check Out") */
  actionLabel?: string;
  onAction?: (keyId: string) => void;
  /** Disable action button (e.g., when busy) */
  actionDisabled?: boolean;
};

export const VehicleSearchPicker = ({
  keys,
  onSelect,
  statusFilter = 'all',
  placeholder = 'Search by year, make, model, or stock number...',
  showHistory = true,
  actionLabel,
  onAction,
  actionDisabled = false,
}: VehicleSearchPickerProps) => {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<KeyRecord | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);

  const filteredKeys = useMemo(() => {
    let base = keys;
    if (statusFilter === 'available') base = keys.filter((k) => k.status === 'available');
    else if (statusFilter === 'unsold') base = keys.filter((k) => k.status !== 'sold');

    const q = query.trim().toLowerCase();
    if (!q) return base;

    const filtered = base.filter((k) => {
      const year = (k.year ?? '').toLowerCase();
      const make = (k.make ?? '').toLowerCase();
      const model = (k.model ?? '').toLowerCase();
      const stock = (k.stock_number ?? '').toLowerCase();
      const name = (k.name ?? '').toLowerCase();
      const vin = (k.vin_last8 ?? '').toLowerCase();

      return (
        year.includes(q) ||
        make.includes(q) ||
        model.includes(q) ||
        stock.includes(q) ||
        name.includes(q) ||
        vin.includes(q)
      );
    });

    return filtered;
  }, [keys, query, statusFilter]);

  useEffect(() => {
    if (!selectedKey?.id || !window.api || !showHistory) {
      setEvents([]);
      return;
    }
    window.api.listEventsByKey(selectedKey.id).then(setEvents);
  }, [selectedKey?.id, showHistory]);

  const handleSelect = (key: KeyRecord) => {
    setSelectedKey(key);
    onSelect?.(key);
  };

  const handleClear = () => {
    setSelectedKey(null);
    setQuery('');
    setEvents([]);
  };

  return (
    <div className="vehicle-search-picker">
      <div className="form">
        <label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </label>
      </div>

      {selectedKey ? (
        <div className="vehicle-search-selected">
          <div className="vehicle-card">
            {selectedKey.photo_path && (
              <div className="vehicle-photo">
                <img src={selectedKey.photo_path} alt="" />
              </div>
            )}
            <div className="vehicle-details">
              <h4>
                {[selectedKey.year, selectedKey.make, selectedKey.model].filter(Boolean).join(' ') || selectedKey.name}
              </h4>
              <p className="vehicle-meta">
                {[selectedKey.stock_number && `Stock #${selectedKey.stock_number}`, selectedKey.vin_last8 && `VIN ...${selectedKey.vin_last8}`]
                  .filter(Boolean)
                  .join(' | ')}
              </p>
              <div className="vehicle-status">
                <span className={`badge ${selectedKey.status === 'checked_out' ? 'checked_out' : selectedKey.status === 'sold' ? 'badge-sold' : 'info'}`}>
                  {selectedKey.status === 'available' ? 'Available' : selectedKey.status === 'checked_out' ? 'Checked Out' : 'Sold'}
                </span>
              </div>
              <div className="actions" style={{ marginTop: '12px' }}>
                {actionLabel && onAction && (
                  <button onClick={() => onAction(selectedKey.id)} disabled={actionDisabled}>
                    {actionLabel}
                  </button>
                )}
                <button onClick={handleClear} className="btn-secondary">
                  Choose Different Vehicle
                </button>
              </div>
            </div>
          </div>

          {showHistory && events.length > 0 && (
            <div className="usage-history">
              <h4>History</h4>
              <div className="list">
                {events.map((e) => (
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
        </div>
      ) : (
        <div className="vehicle-search-results">
          {filteredKeys.length === 0 ? (
            <p className="muted">No vehicles match your search.</p>
          ) : (
            <div className="list">
              {filteredKeys.map((k) => {
                const label = [k.year, k.make, k.model].filter(Boolean).join(' ') || k.name;
                const meta = [k.stock_number && `Stock #${k.stock_number}`, k.vin_last8 && `VIN ...${k.vin_last8}`].filter(Boolean).join(' | ');
                return (
                  <div
                    key={k.id}
                    className="list-item list-item-hover"
                    onClick={() => handleSelect(k)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSelect(k)}
                  >
                    <div className="row">
                      <strong className="grow">{label}</strong>
                      <span className={`badge ${k.status === 'checked_out' ? 'checked_out' : k.status === 'sold' ? 'badge-sold' : 'info'}`}>
                        {k.status === 'available' ? 'Available' : k.status === 'checked_out' ? 'Checked Out' : 'Sold'}
                      </span>
                    </div>
                    {meta && <div className="muted">{meta}</div>}
                    {k.last_holder_name && k.status !== 'sold' && <div className="muted">Out with: {k.last_holder_name}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
