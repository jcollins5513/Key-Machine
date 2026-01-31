import React from 'react';

type KeyListProps = {
  title: string;
  keys: KeyRecord[];
};

export const KeyList = ({ title, keys }: KeyListProps) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="list">
        {keys.length === 0 && <p>No keys yet.</p>}
        {keys.map(key => {
          const label = [key.year, key.make, key.model].filter(Boolean).join(' ') || key.name;
          const meta = [key.stock_number && `Stock #${key.stock_number}`, key.vin_last8 && `VIN ...${key.vin_last8}`].filter(Boolean).join(' | ');
          return (
            <div key={key.id} className="list-item">
              <div className="row">
                <strong className="grow">{label}</strong>
                <span className={`badge ${key.status}`}>{key.status}</span>
              </div>
              {meta && <div className="muted">{meta}</div>}
              {key.last_holder_name && <div>Last user: {key.last_holder_name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
