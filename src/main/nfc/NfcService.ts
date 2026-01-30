import { EventEmitter } from 'events';
import { NFC, KEY_TYPE_A } from 'nfc-pcsc';
import * as ndef from 'ndef';

type NfcStatus = {
  connected: boolean;
  reader?: string;
};

type TagEvent = {
  keyId: string;
  uid?: string;
};

type PendingWrite = {
  keyId: string;
  resolve: (value: { success: boolean; uid?: string }) => void;
  reject: (error: Error) => void;
};

type PendingAction =
  | {
      type: 'write';
      keyId: string;
      resolve: (value: { success: boolean; uid?: string }) => void;
      reject: (error: Error) => void;
    }
  | {
      type: 'erase';
      resolve: (value: { success: boolean; uid?: string }) => void;
      reject: (error: Error) => void;
    };

type LogEvent = {
  level: 'info' | 'warn' | 'error';
  message: string;
  at: string;
};

export class NfcService extends EventEmitter {
  private nfc = new NFC();
  private pendingAction: PendingAction | null = null;
  private readers = new Map<string, any>();

  constructor() {
    super();

    this.setupNfc();
  }

  async refresh() {
    this.log('info', 'Refreshing NFC reader service...');
    for (const reader of this.readers.values()) {
      try {
        reader.close?.();
      } catch (error) {
        this.log('warn', `Reader close failed: ${String(error)}`);
      }
    }
    this.readers.clear();
    this.nfc.removeAllListeners();
    this.nfc = new NFC();
    this.emit('status', { connected: false } satisfies NfcStatus);
    this.setupNfc();
  }

  private setupNfc() {
    this.nfc.on('reader', reader => {
      this.readers.set(reader.name, reader);
      this.log('info', `Reader connected: ${reader.name}`);
      this.emit('status', { connected: true, reader: reader.name } satisfies NfcStatus);

      reader.on('card', async card => {
        const uid = card.uid;
        this.log('info', `Card detected: ${uid ?? 'unknown UID'}`);

        if (this.pendingAction) {
          const pending = this.pendingAction;
          this.pendingAction = null;

          try {
            if (pending.type === 'write') {
              await this.writeNdef(reader, pending.keyId);
              pending.resolve({ success: true, uid });
              this.log('info', `Tag written for key ${pending.keyId}`);
            } else {
              await this.eraseNdef(reader);
              pending.resolve({ success: true, uid });
              this.log('info', 'Tag erased');
            }
          } catch (error) {
            pending.reject(error instanceof Error ? error : new Error(String(error)));
            this.log('error', `${pending.type === 'write' ? 'Write' : 'Erase'} failed: ${String(error)}`);
          }
          return;
        }

        try {
          const keyId = await this.readNdef(reader);
          if (keyId) {
            this.emit('tag', { keyId, uid } satisfies TagEvent);
            this.log('info', `NDEF payload read: ${keyId}`);
          } else {
            this.log('warn', 'No NDEF payload found on tag');
          }
        } catch (error) {
          this.emit('error', error);
          this.log('error', `Read failed: ${String(error)}`);
        }
      });

      reader.on('error', err => {
        this.emit('error', err);
        this.log('error', `Reader error: ${String(err)}`);
      });

      reader.on('end', () => {
        this.log('warn', `Reader removed: ${reader.name}`);
        this.readers.delete(reader.name);
        if (this.readers.size === 0) {
          this.emit('status', { connected: false } satisfies NfcStatus);
        }
      });
    });

    this.nfc.on('error', err => {
      this.emit('error', err);
      this.log('error', `NFC service error: ${String(err)}`);
    });
  }

  async writeTag(keyId: string) {
    if (this.pendingAction) {
      throw new Error('An NFC operation is already pending. Remove tag and try again.');
    }

    return new Promise<{ success: boolean; uid?: string }>((resolve, reject) => {
      this.pendingAction = { type: 'write', keyId, resolve, reject };
    });
  }

  async eraseTag() {
    if (this.pendingAction) {
      throw new Error('An NFC operation is already pending. Remove tag and try again.');
    }

    return new Promise<{ success: boolean; uid?: string }>((resolve, reject) => {
      this.pendingAction = { type: 'erase', resolve, reject };
    });
  }

  private async readNdef(reader: any): Promise<string | null> {
    const defaultKey = Buffer.from('FFFFFFFFFFFF', 'hex');
    let raw: Buffer | null = null;

    try {
      await reader.authenticate(4, KEY_TYPE_A, defaultKey);
      raw = await reader.read(4, 48, 16);
    } catch (error) {
      this.log('warn', `Classic read failed, retrying: ${String(error)}`);
    }

    if (!raw) {
      try {
        raw = await reader.read(4, 48, 4);
      } catch (error) {
        const text = String(error);
        if (text.includes('Invalid response length 0')) {
          this.log('warn', 'Read failed: tag requires auth or is not readable');
          return null;
        }
        throw error;
      }
    }

    const ndefBytes = extractNdefFromTlv(raw);
    if (!ndefBytes) {
      return null;
    }

    const records = ndef.decodeMessage(ndefBytes);
    const text = records.find(record => record.tnf === ndef.TNF_WELL_KNOWN);
    if (!text) {
      return null;
    }

    return ndef.text.decodePayload(text.payload);
  }

  private async writeNdef(reader: any, keyId: string) {
    const message = ndef.encodeMessage([ndef.textRecord(keyId)]);
    await this.writeMessage(reader, message);
  }

  private async eraseNdef(reader: any) {
    const message = new Uint8Array(0);
    await this.writeMessage(reader, message);
  }

  private async writeMessage(reader: any, message: Uint8Array) {
    const defaultKey = Buffer.from('FFFFFFFFFFFF', 'hex');

    try {
      await reader.authenticate(4, KEY_TYPE_A, defaultKey);
      const classicTlv = buildNdefTlv(message, 16);
      await reader.write(4, classicTlv, 16);
      return;
    } catch (error) {
      this.log('warn', `Auth/write as MIFARE Classic failed, retrying: ${String(error)}`);
    }

    try {
      const tlv = buildNdefTlv(message, 4);
      await reader.write(4, tlv, 4);
    } catch (error) {
      const text = String(error);
      if (text.includes('0x6300')) {
        throw new Error(
          'Write failed (0x6300). Tag may be locked or require authentication. Try an NTAG/Ultralight tag or a default-key MIFARE Classic.'
        );
      }
      throw error;
    }
  }

  private log(level: LogEvent['level'], message: string) {
    this.emit('log', { level, message, at: new Date().toISOString() } satisfies LogEvent);
  }
}

const buildNdefTlv = (message: Uint8Array, blockSize: number) => {
  const tlv = Buffer.concat([
    Buffer.from([0x03, message.length]),
    Buffer.from(message),
    Buffer.from([0xfe]),
  ]);

  const padding = tlv.length % blockSize === 0 ? 0 : blockSize - (tlv.length % blockSize);
  return padding === 0 ? tlv : Buffer.concat([tlv, Buffer.alloc(padding, 0x00)]);
};

const extractNdefFromTlv = (data: Buffer) => {
  const ndefIndex = data.indexOf(0x03);
  if (ndefIndex < 0 || ndefIndex + 1 >= data.length) {
    return null;
  }
  const length = data[ndefIndex + 1];
  const start = ndefIndex + 2;
  const end = start + length;
  if (end > data.length) {
    return null;
  }
  return data.slice(start, end);
};
