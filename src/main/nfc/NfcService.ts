import { EventEmitter } from 'events';
import { NFC, KEY_TYPE_A, KEY_TYPE_B } from 'nfc-pcsc';
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
            const errStr = String(error);
            const isCardNotConnected =
              errStr.includes('card_not_connected') ||
              (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'card_not_connected');
            if (isCardNotConnected) {
              pending.reject(
                new Error(
                  'Connection lost. Hold the tag steady on the reader until pairing completes, then click Pair again.'
                )
              );
            } else {
              pending.reject(error instanceof Error ? error : new Error(errStr));
            }
            this.log('error', `${pending.type === 'write' ? 'Write' : 'Erase'} failed: ${errStr}`);
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

    // Try NTAG/Ultralight first (no auth) - most common for vehicle keys
    try {
      raw = await reader.read(4, 48, 4);
    } catch (error) {
      const text = String(error);
      if (text.includes('0x6300')) {
        throw new Error(
          'Tag may be locked or password-protected (0x6300). Use a fresh NTAG213/215/216 or MIFARE Ultralight tag.'
        );
      }
      if (text.includes('Invalid response length 0')) {
        this.log('warn', 'NTAG read failed, trying MIFARE Classic');
      } else {
        this.log('warn', `NTAG read failed, retrying: ${text}`);
      }
    }

    if (!raw) {
      try {
        await reader.authenticate(4, KEY_TYPE_A, defaultKey);
        raw = await reader.read(4, 48, 16);
      } catch (error) {
        const text = String(error);
        if (text.includes('0x6300')) {
          throw new Error(
            'Tag may be locked or password-protected (0x6300). Use a fresh NTAG213/215/216 or MIFARE Ultralight tag.'
          );
        }
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

    // Try NTAG/Ultralight first (most common for vehicle keys - faster, less connection loss)
    try {
      const tlv = buildNdefTlv(message, 4);
      await reader.write(4, tlv, 4);
      return;
    } catch (error) {
      const text = String(error);
      if (text.includes('card_not_connected')) {
        throw error;
      }
      if (text.includes('0x6300')) {
        throw new Error(
          'Write failed (0x6300). Tag may be locked or password-protected. ' +
            'Use a fresh NTAG213/215/216 or MIFARE Ultralight tag. Avoid pre-configured or locked tags.'
        );
      }
      this.log('warn', `NTAG/Ultralight write failed, trying MIFARE Classic: ${text}`);
    }

    // Try MIFARE Classic with Key A
    try {
      await reader.authenticate(4, KEY_TYPE_A, defaultKey);
      const classicTlv = buildNdefTlv(message, 16);
      await reader.write(4, classicTlv, 16);
      return;
    } catch (error) {
      this.log('warn', `Auth/write as MIFARE Classic (Key A) failed: ${String(error)}`);
    }

    // Try MIFARE Classic with Key B (some tags use Key B for writes)
    try {
      await reader.authenticate(4, KEY_TYPE_B, defaultKey);
      const classicTlv = buildNdefTlv(message, 16);
      await reader.write(4, classicTlv, 16);
      return;
    } catch (error) {
      this.log('warn', `Auth/write as MIFARE Classic (Key B) failed: ${String(error)}`);
    }

    // Try NTAG with PWD_AUTH (for password-protected tags)
    try {
      await this.ntagPasswordAuth(reader);
      const tlv = buildNdefTlv(message, 4);
      await reader.write(4, tlv, 4);
      return;
    } catch (error) {
      const text = String(error);
      if (text.includes('card_not_connected')) {
        throw error;
      }
      throw new Error(
        'Write failed. Use a fresh NTAG213/215/216 or MIFARE Ultralight tag. ' +
          'Hold the tag steady on the reader until pairing completes.'
      );
    }
  }

  /**
   * NTAG password auth with default credentials (ACR122U / PN533 readers only).
   * Use when tag has password protection enabled with factory defaults.
   */
  private async ntagPasswordAuth(reader: any): Promise<void> {
    if (typeof reader.transmit !== 'function') return;
    const password = Buffer.from('FFFFFFFF', 'hex');
    const cmd = Buffer.concat([
      Buffer.from([0xff, 0x00, 0x00, 0x00, 0x07, 0xd4, 0x42, 0x1b]),
      password,
    ]);
    const response = await reader.transmit(cmd, 7);
    if (response.length < 5 || response[2] !== 0x00) {
      throw new Error('PWD_AUTH failed');
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
