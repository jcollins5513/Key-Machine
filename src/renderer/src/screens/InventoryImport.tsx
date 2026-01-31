import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

type ImportResult = {
  created: number;
  skipped: number;
  removed: number;
};

type InventoryImportProps = {
  onImportComplete: () => void;
};

const COLUMN_MAP: Record<string, string> = {
  stock_number: 'stock_number',
  'stock number': 'stock_number',
  stock: 'stock_number',
  stocknumber: 'stock_number',
  'stock#': 'stock_number',
  body: 'stock_number',
  vin: 'vin',
  vin_last8: 'vin_last8',
  'vin last 8': 'vin_last8',
  year: 'year',
  make: 'make',
  model: 'model',
  vehicle: 'vehicle',
  photo: 'photo_path',
  photo_path: 'photo_path',
  image: 'photo_path',
};

/** Parse "2018 Nissan Rogue SV" into year, make, model */
const parseVehicle = (vehicle: string): { year: string | null; make: string | null; model: string | null } => {
  const s = vehicle.trim();
  if (!s) return { year: null, make: null, model: null };
  const match = s.match(/^(\d{4})\s+(.+)$/);
  if (match) {
    const [, year, rest] = match;
    const parts = rest.split(/\s+/);
    const make = parts[0] ?? null;
    const model = parts.slice(1).join(' ') || null;
    return { year, make, model };
  }
  return { year: null, make: null, model: s };
};

/** Detect Bentley Hyundai format: Age,Body,Age,Vehicle,Body,VIN,Color */
const isBentleyFormat = (headers: string[]): boolean => {
  const h = headers.map((x) => x.trim().toLowerCase());
  return h[1] === 'body' && h[3] === 'vehicle' && h[5] === 'vin';
};

export const InventoryImport = ({ onImportComplete }: InventoryImportProps) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapRow = (row: Record<string, string>) => {
    const mapped: Record<string, string | null> = {};
    for (const [key, val] of Object.entries(row)) {
      const normalized = key.trim().toLowerCase().replace(/\s+/g, '_');
      const field = COLUMN_MAP[normalized] ?? COLUMN_MAP[key.trim().toLowerCase()];
      if (field && val?.trim()) {
        mapped[field] = val.trim();
      }
    }
    return mapped;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !window.api) return;
    setBusy(true);
    setStatus('');
    setResult(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
      });
      const rows = parsed.data as string[][];
      if (rows.length < 2) {
        setStatus('No data rows found in CSV.');
        return;
      }
      const headers = rows[0];
      const dataRows = rows.slice(1);
      let vehicles: Array<{
        stock_number: string;
        vin?: string | null;
        vin_last8?: string | null;
        year?: string | null;
        make?: string | null;
        model?: string | null;
        photo_path?: string | null;
      }> = [];

      if (isBentleyFormat(headers)) {
        vehicles = dataRows
          .map((row) => {
            const stockNumber = (row[1] ?? '').trim();
            if (!stockNumber) return null;
            const vehicleStr = (row[3] ?? '').trim();
            const vin = (row[5] ?? '').trim() || null;
            const { year, make, model } = parseVehicle(vehicleStr);
            return {
              stock_number: stockNumber,
              vin,
              vin_last8: vin ? vin.slice(-8) : null,
              year,
              make,
              model,
              photo_path: null,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null && !!v.stock_number);
      } else {
        const withHeaders = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h, i) => (h ? `${h.trim()}_${i}` : `col_${i}`),
        });
        vehicles = (withHeaders.data ?? [])
          .map((row) => {
            const m = mapRow(row);
            const sn =
              m.stock_number ??
              row['Stock Number_0'] ??
              row['Stock#_0'] ??
              row['Body_1'] ??
              Object.values(row).find((v, i) => headers[i]?.toLowerCase().includes('stock') && v?.trim()) ??
              '';
            const s = sn.toString().trim();
            if (!s) return null;
            const vin = (m.vin ?? row['VIN_5'] ?? row['vin_5'] ?? '').toString().trim() || null;
            const vehicleStr = (m.vehicle ?? row['Vehicle_3'] ?? row['vehicle_3'] ?? '').toString().trim();
            const { year, make, model } = vehicleStr ? parseVehicle(vehicleStr) : { year: m.year, make: m.make, model: m.model };
            return {
              stock_number: s,
              vin: vin || null,
              vin_last8: vin ? vin.slice(-8) : null,
              year: year ?? m.year ?? null,
              make: make ?? m.make ?? null,
              model: model ?? m.model ?? null,
              photo_path: m.photo_path ?? null,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null && !!v.stock_number);
      }

      if (vehicles.length === 0) {
        setStatus('No valid vehicles found. Expected columns: Stock/Body (stock #), Vehicle (year make model), VIN.');
        return;
      }

      const res = await window.api.importInventory(vehicles);
      setResult(res);
      setStatus(`Imported ${res.created} vehicles. Skipped ${res.skipped} (already exist).`);
      onImportComplete();
    } catch (err) {
      setStatus(`Import failed: ${String(err)}`);
    } finally {
      setBusy(false);
      fileInputRef.current && (fileInputRef.current.value = '');
    }
  };

  return (
    <div>
      <h3>Import Inventory</h3>
      <p>Upload a CSV with columns: Stock Number, VIN (or VIN Last 8), Year, Make, Model, Photo (optional).</p>
      <div className="actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={busy}
          style={{ display: 'none' }}
        />
        <button onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? 'Importing...' : 'Choose CSV File'}
        </button>
      </div>
      {status && <p>{status}</p>}
      {result && (
        <p className="muted">
          Created: {result.created} | Skipped: {result.skipped}
          {result.removed > 0 && ` | Removed: ${result.removed}`}
        </p>
      )}
    </div>
  );
};
