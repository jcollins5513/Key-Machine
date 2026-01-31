import React from 'react';
import { TagWriter } from './TagWriter';
import { InventoryImport } from './InventoryImport';
import { PageLayout } from '../components/PageLayout';
import { Card } from '../components/Card';

type AddVehicleProps = {
  keys: KeyRecord[];
  onKeyCreated: () => void;
  onImportComplete: () => void;
};

export const AddVehicle = ({ keys, onKeyCreated, onImportComplete }: AddVehicleProps) => (
  <PageLayout title="Add Vehicle" subtitle="Import inventory from CSV or write NFC tags to vehicles.">
    <Card>
      <InventoryImport onImportComplete={onImportComplete} />
    </Card>
    <Card>
      <TagWriter keys={keys} onKeyCreated={onKeyCreated} />
    </Card>
  </PageLayout>
);
