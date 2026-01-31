import React from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type ReadTagProps = {
  status: { connected: boolean; reader?: string };
  tagData: { payload: string; uid?: string } | null;
  message: string;
};

export const ReadTag = ({ status, tagData, message }: ReadTagProps) => {
  return (
    <PageLayout
      title="Read Tag"
      subtitle="Tap an NFC tag on the reader to see the data stored on it."
    >
      <Card>
        <div className="row">
          <div className="status">
            <span className={`status-dot ${status.connected ? 'connected' : ''}`} />
            NFC Reader {status.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        {!tagData ? (
          <p className="scan-prompt">
            Tap an NFC tag on the reader to see the data stored on it.
          </p>
        ) : (
          <div className="read-tag-result">
            <h4>Tag Data</h4>
            <dl className="tag-data-list">
              <dt>NDEF Payload</dt>
              <dd>
                <code>{tagData.payload || '(empty)'}</code>
              </dd>
              {tagData.uid && (
                <>
                  <dt>UID</dt>
                  <dd>
                    <code>{tagData.uid}</code>
                  </dd>
                </>
              )}
            </dl>
            <p className="muted">
              For vehicle keys, the payload is typically the stock number. Tap another tag to read
              again.
            </p>
          </div>
        )}
        {message && <p className="error">{message}</p>}
      </Card>
    </PageLayout>
  );
};
