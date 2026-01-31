import React from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type LicenseProps = {
  message?: string;
};

export const License = ({ message }: LicenseProps) => (
  <PageLayout title="License" subtitle="Manage your Key Machine subscription and license verification.">
    <Card>
      <div className="license-placeholder">
        <div className="license-icon">📜</div>
        <h3>License & Subscription</h3>
        <p>Verify your paid subscription status and manage license details.</p>
        <p className="muted">License verification will be available in a future update.</p>
        {message && <p className="error">{message}</p>}
      </div>
    </Card>
  </PageLayout>
);
