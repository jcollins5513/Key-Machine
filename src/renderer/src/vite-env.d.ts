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

type UserRecord = {
  id: string;
  first_name: string;
  last_name: string;
  first_initial: string;
  department: string | null;
  position: string | null;
  allowed_checkout: number;
  is_admin: number;
  created_at: string;
  updated_at: string;
};

declare global {
  interface Window {
    api: {
      listKeys: () => Promise<KeyRecord[]>;
      listUsers: () => Promise<UserRecord[]>;
      createKey: (name: string) => Promise<KeyRecord>;
      createUser: (payload: {
        first_name: string;
        last_name: string;
        department?: string | null;
        position?: string | null;
        pin: string;
        allowed_checkout: number;
        is_admin: boolean;
      }) => Promise<UserRecord>;
      updateUser: (payload: {
        id: string;
        updates: Partial<{
          first_name: string;
          last_name: string;
          department: string | null;
          position: string | null;
          allowed_checkout: number;
          is_admin: boolean;
        }>;
      }) => Promise<UserRecord>;
      login: (payload: { initial: string; last_name: string; pin: string }) => Promise<UserRecord>;
      updatePin: (payload: { userId: string; currentPin: string; newPin: string }) => Promise<UserRecord>;
      checkOut: (keyId: string, userId: string) => Promise<KeyRecord>;
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
