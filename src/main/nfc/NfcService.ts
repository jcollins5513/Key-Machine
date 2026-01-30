import { EventEmitter } from 'events';
import { NFC } from 'nfc-pcsc';
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

export class NfcService extends EventEmitter {
  private nfc = new NFC();
  private pendingWrite: PendingWrite | null = null;

  constructor() {
    super();

    this.nfc.on('reader', reader => {
      this.emit('status', { connected: true, reader: reader.name } satisfies NfcStatus);

      reader.on('card', async card => {
        const uid = card.uid;

        if (this.pendingWrite) {
          const pending = this.pendingWrite;
          this.pendingWrite = null;

          try {
            await this.writeNdef(reader, pending.keyId);
            pending.resolve({ success: true, uid });
          } catch (error) {
            pending.reject(error instanceof Error ? error : new Error(String(error)));
          }
          return;
        }

        try {
          const keyId = await this.readNdef(reader);
          if (keyId) {
            this.emit('tag', { keyId, uid } satisfies TagEvent);
          }
        } catch (error) {
          this.emit('error', error);
        }
      });

      reader.on('error', err => {
        this.emit('error', err);
      });

      reader.on('end', () => {
        this.emit('status', { connected: false } satisfies NfcStatus);
      });
    });

    this.nfc.on('error', err => {
      this.emit('error', err);
    });
  }

  async writeTag(keyId: string) {
    if (this.pendingWrite) {
      throw new Error('A write is already pending. Remove tag and try again.');
    }

    return new Promise<{ success: boolean; uid?: string }>((resolve, reject) => {
      this.pendingWrite = { keyId, resolve, reject };
    });
  }

  private async readNdef(reader: any): Promise<string | null> {
    const raw = await reader.read(4, 48, 4);
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
    const tlv = buildNdefTlv(message);
    await reader.write(4, tlv, 4);
  }
}

const buildNdefTlv = (message: Uint8Array) => {
  const tlv = Buffer.concat([
    Buffer.from([0x03, message.length]),
    Buffer.from(message),
    Buffer.from([0xfe]),
  ]);

  const blockSize = 4;
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
