import React from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type UserEdit = { allowed: number; isAdmin: boolean };

type CurrentUsersProps = {
  users: UserRecord[];
  userEdits: Record<string, UserEdit>;
  onEditChange: (userId: string, edit: UserEdit) => void;
  onSave: (userId: string) => void;
  message: string;
};

export const CurrentUsers = ({ users, userEdits, onEditChange, onSave, message }: CurrentUsersProps) => (
  <PageLayout title="Current Users" subtitle="Manage user accounts and permissions.">
    <Card>
      {message && <p className="error">{message}</p>}
      <div className="list">
        {users.length === 0 && <p>No users yet.</p>}
        {users.map(user => {
          const edit = userEdits[user.id] || { allowed: user.allowed_checkout, isAdmin: user.is_admin === 1 };
          return (
            <div key={user.id} className="list-item list-item-hover">
              <div className="row">
                <strong className="grow">{user.first_name} {user.last_name}</strong>
                <span className={`badge ${user.is_admin === 1 ? 'admin' : ''}`}>{user.is_admin === 1 ? 'admin' : 'user'}</span>
              </div>
              <div className="muted">Department: {user.department || '—'} | Position: {user.position || '—'}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <label>Allowed keys <input type="number" min={1} value={edit.allowed} onChange={e => onEditChange(user.id, { ...edit, allowed: Number(e.target.value) })} /></label>
                <label>Admin <select value={edit.isAdmin ? 'yes' : 'no'} onChange={e => onEditChange(user.id, { ...edit, isAdmin: e.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></select></label>
                <button onClick={() => onSave(user.id)} className="btn-secondary">Save</button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  </PageLayout>
);
