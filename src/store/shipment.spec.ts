import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  getShipment,
  getShipmentPackages,
  getShipmentRouteSegments,
  getShipmentStatusHistory
} from '@/services/shipment';
import { useShipmentStore } from './shipment';
import type { Shipment } from '@/types/order';

vi.mock('@/services/shipment', () => ({
  getShipment: vi.fn(),
  getShipmentPackages: vi.fn(),
  getShipmentRouteSegments: vi.fn(),
  getShipmentStatusHistory: vi.fn(),
}));

describe('shipment store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getShipment).mockReset();
    vi.mocked(getShipmentPackages).mockReset();
    vi.mocked(getShipmentRouteSegments).mockReset();
    vi.mocked(getShipmentStatusHistory).mockReset();
  });

  it('loads shipment detail sections into keyed state', async () => {
    vi.mocked(getShipment).mockResolvedValue(stubShipment('SHIP1'));
    vi.mocked(getShipmentPackages).mockResolvedValue([{ id: '00001' } as any]);
    vi.mocked(getShipmentRouteSegments).mockResolvedValue([{ id: '00002' } as any]);
    vi.mocked(getShipmentStatusHistory).mockResolvedValue([{ id: '1000' } as any]);

    const store = useShipmentStore();
    const shipment = await store.loadShipment('SHIP1');

    expect(shipment.id).toBe('SHIP1');
    expect(store.getShipment('SHIP1')?.id).toBe('SHIP1');
    expect(store.getShipmentPackages('SHIP1')).toEqual([{ id: '00001' }]);
    expect(store.getShipmentRouteSegments('SHIP1')).toEqual([{ id: '00002' }]);
    expect(store.getShipmentStatusHistory('SHIP1')).toEqual([{ id: '1000' }]);
    expect(store.fetchStatus.detail).toBe('success');
  });
});

function stubShipment(id: string): Shipment {
  return {
    id,
    orderId: 'M100051',
    status: 'SHIPMENT_SHIPPED',
    carrier: 'UPS',
    trackingCode: '1Z999',
    origin: 'BROOKLYN',
    destination: 'CUSTOMER',
    shipDate: '2026-05-22T10:00:00',
    itemIds: [],
    packages: [],
  };
}
