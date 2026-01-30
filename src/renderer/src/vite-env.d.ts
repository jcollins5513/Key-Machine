/// <reference types="vite/client" />

type KeyRecord = {
  id: string;
  name: string;
  tag_payload: string;
  status: 'available' | 'checked_out';
  last_holder_id: string | null;
  created_at: string;
  updated_at: string;
  last_holder_name?: string | null;
};

type HolderRecord = {
  id: string;
  name: string;
  created_at: string;
};

declare global {
  interface Window {
    api: {
      listKeys: () => Promise<KeyRecord[]>;
      listHolders: () => Promise<HolderRecord[]>;
      createKey: (name: string) => Promise<KeyRecord>;
      createHolder: (name: string) => Promise<HolderRecord>;
      checkOut: (keyId: string, holderId: string) => Promise<KeyRecord>;
      checkIn: (keyId: string) => Promise<KeyRecord>;
      writeTag: (keyId: string) => Promise<{ success: boolean; uid?: string }>;
      eraseTag: () => Promise<{ success: boolean; uid?: string }>;
      refreshReader: () => Promise<{ success: boolean }>;
      onNfcStatus: (listener: (status: { connected: boolean; reader?: string }) => void) => void;
      onNfcLog: (listener: (payload: { level: string; message: string; at: string }) => void) => void;
      onNfcTag: (listener: (payload: { key: KeyRecord; suggestedAction: 'check_out' | 'check_in' }) => void) => void;
      onNfcUnknown: (listener: (payload: { keyId: string }) => void) => void;
      onNfcError: (listener: (payload: { message: string }) => void) => void;
    };
  }
}
