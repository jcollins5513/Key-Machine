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
        {keys.map(key => (
          <div key={key.id} className="list-item">
            <div className="row">
              <strong className="grow">{key.name}</strong>
              <span className={`badge ${key.status}`}>{key.status}</span>
            </div>
            {key.last_holder_name && <div>Last user: {key.last_holder_name}</div>}
            <div className="row">
              <span>Tag: {key.tag_payload}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
