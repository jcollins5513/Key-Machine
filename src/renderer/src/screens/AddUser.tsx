import React from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type AddUserProps = {
  newUserFirst: string;
  newUserLast: string;
  newUserDept: string;
  newUserPos: string;
  newUserPin: string;
  newUserAllowed: number;
  newUserAdmin: boolean;
  onFirstChange: (v: string) => void;
  onLastChange: (v: string) => void;
  onDeptChange: (v: string) => void;
  onPosChange: (v: string) => void;
  onPinChange: (v: string) => void;
  onAllowedChange: (v: number) => void;
  onAdminChange: (v: boolean) => void;
  onCreate: () => void;
  message: string;
};

export const AddUser = ({
  newUserFirst,
  newUserLast,
  newUserDept,
  newUserPos,
  newUserPin,
  newUserAllowed,
  newUserAdmin,
  onFirstChange,
  onLastChange,
  onDeptChange,
  onPosChange,
  onPinChange,
  onAllowedChange,
  onAdminChange,
  onCreate,
  message,
}: AddUserProps) => (
  <PageLayout title="Add User" subtitle="Create a new user account. Admins can manage inventory and users.">
    <Card>
      <div className="form">
        <label>First name <input value={newUserFirst} onChange={e => onFirstChange(e.target.value)} placeholder="John" /></label>
        <label>Last name <input value={newUserLast} onChange={e => onLastChange(e.target.value)} placeholder="Smith" /></label>
        <label>Department <input value={newUserDept} onChange={e => onDeptChange(e.target.value)} placeholder="Sales" /></label>
        <label>Position <input value={newUserPos} onChange={e => onPosChange(e.target.value)} placeholder="Consultant" /></label>
        <label>PIN <input type="password" value={newUserPin} onChange={e => onPinChange(e.target.value)} placeholder="••••" /></label>
        <label>Allowed keys <input type="number" min={1} value={newUserAllowed} onChange={e => onAllowedChange(Number(e.target.value))} /></label>
        <label>Admin <select value={newUserAdmin ? 'yes' : 'no'} onChange={e => onAdminChange(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></label>
        <button onClick={onCreate} disabled={!newUserFirst.trim() || !newUserLast.trim() || !newUserPin}>Create User</button>
      </div>
      {message && <p className="error">{message}</p>}
    </Card>
  </PageLayout>
);
