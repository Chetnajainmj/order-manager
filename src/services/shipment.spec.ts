import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  buildShipmentLookupPayload,
  getShipment,
  getShipmentPackages,
  getShipmentRouteSegments,
  getShipmentStatusHistory,
  searchShipments
} from './shipment';

vi.mock('@common', () => ({
  api: vi.fn(),
}));

describe('shipment service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('fetches shipment header and item rows from DataDocuments', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: {
          entityValueList: [{
            shipmentId: 'SHIP1',
            primaryOrderId: 'M100051',
            shipmentTypeId: 'SALES_SHIPMENT',
            statusId: 'SHIPMENT_SHIPPED',
            carrierPartyId: 'UPS',
            originFacilityId: 'BROOKLYN',
            destinationFacilityId: 'CUSTOMER',
            estimatedShipDate: '2026-05-22T10:00:00',
            latestCancelDate: '2026-05-21T10:00:00',
            createdDate: '2026-05-20T10:00:00',
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          entityValueList: [{
            shipmentId: 'SHIP1',
            shipmentItemSeqId: '00001',
            orderId: 'M100051',
            orderItemSeqId: '01',
            productId: 'SKU1',
            itemDescription: 'Pink shirt',
            quantity: 2,
          }],
        },
      });

    const shipment = await getShipment('SHIP1');

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        dataDocumentId: 'OrderManagerShipmentLookup',
        customParametersMap: { shipmentId: 'SHIP1' },
      }),
    });
    expect(vi.mocked(api).mock.calls[0][0].data.fieldsToSelect).toBeUndefined();
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        dataDocumentId: 'OrderManagerOrderShipmentLookup',
        customParametersMap: { shipmentId: 'SHIP1' },
      }),
    });
    expect(shipment).toMatchObject({
      id: 'SHIP1',
      orderId: 'M100051',
      shipmentTypeId: 'SALES_SHIPMENT',
      status: 'SHIPMENT_SHIPPED',
      carrier: 'UPS',
      originFacilityId: 'BROOKLYN',
      destinationFacilityId: 'CUSTOMER',
      itemIds: ['00001', '01'],
      items: [{
        id: '00001',
        orderItemSeqId: '01',
        productId: 'SKU1',
        description: 'Pink shirt',
        quantity: 2,
      }],
    });
  });

  it('loads packages, route segments, and status history from poorti endpoints', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [{
          shipmentId: 'SHIP1',
          shipmentPackageSeqId: '00001',
          boxLength: 10,
          boxWidth: 8,
          boxHeight: 4,
          dimensionUomId: 'in',
          weight: 3,
          weightUomId: 'lb',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          shipmentId: 'SHIP1',
          shipmentPackageSeqId: '00001',
          shipmentItemSeqId: '00001',
          quantity: 2,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          shipmentId: 'SHIP1',
          shipmentRouteSegmentId: '00001',
          routeSegCarrierPartyId: 'UPS',
          routeSegShipmentMethodDescription: 'Ground',
          trackingIdNumber: '1Z999',
          carrierServiceStatusId: 'SHRSCS_SHIPPED',
          statusDate: '2026-05-22T12:00:00',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          shipmentStatusId: '1000',
          shipmentId: 'SHIP1',
          statusId: 'SHIPMENT_SHIPPED',
          statusDate: '2026-05-22T12:00:00',
          changeByUserLoginId: 'system',
        }],
      });

    await expect(getShipmentPackages('SHIP1')).resolves.toMatchObject([{
      id: '00001',
      dimensions: '10 x 8 x 4 in',
      weight: 3,
      weightUomId: 'lb',
      contents: [{ shipmentItemSeqId: '00001', quantity: 2, productId: '' }],
    }]);
    await expect(getShipmentRouteSegments('SHIP1')).resolves.toMatchObject([{
      id: '00001',
      carrier: 'UPS',
      trackingCode: '1Z999',
    }]);
    await expect(getShipmentStatusHistory('SHIP1')).resolves.toMatchObject([{
      id: '1000',
      statusId: 'SHIPMENT_SHIPPED',
      changedBy: 'system',
    }]);

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'poorti/shipments/SHIP1/shipmentPackages',
      method: 'get',
      params: { pageSize: 100 },
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'poorti/shipments/SHIP1/shipmentPackageContents',
      method: 'get',
      params: { pageSize: 100 },
    });
    expect(api).toHaveBeenNthCalledWith(3, {
      url: 'poorti/orderShipmentAndRouteSegments',
      method: 'get',
      params: { shipmentId: 'SHIP1', pageSize: 100 },
    });
    expect(api).toHaveBeenNthCalledWith(4, {
      url: 'poorti/shipments/SHIP1/statusHistory',
      method: 'get',
      params: { pageSize: 100, orderByField: '-statusDate' },
    });
  });

  it('normalizes nested package unit objects from poorti entity-list responses', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [{
          shipmentId: 'SHIP1',
          shipmentPackageSeqId: '00001',
          boxLength: 15,
          boxWidth: 10,
          boxHeight: 5,
          dimensionUomId: { abbreviation: 'in', uomId: 'LEN_in' },
          weight: 12,
          weightUomId: { abbreviation: 'lb', uomId: 'WT_lb' },
        }],
      })
      .mockResolvedValueOnce({ data: [] });

    await expect(getShipmentPackages('SHIP1')).resolves.toMatchObject([{
      dimensions: '15 x 10 x 5 in',
      weight: 12,
      weightUomId: 'lb',
    }]);
  });

  it('builds a shipment search payload for order id filters and dates', () => {
    const payload = buildShipmentLookupPayload({
      queryString: 'M100051',
      status: 'SHIPMENT_APPROVED',
      carrierPartyId: 'UPS',
      dateFrom: '2026-05-22',
      dateThru: '2026-05-23',
      pageSize: 25,
      pageIndex: 2,
    });

    expect(payload).toMatchObject({
      dataDocumentId: 'OrderManagerShipmentLookup',
      orderByField: '-createdDate',
      pageSize: 25,
      pageIndex: 2,
      customParametersMap: {
        primaryOrderId: 'M100051',
        statusId: 'SHIPMENT_APPROVED',
        carrierPartyId: 'UPS',
      },
    });
    expect(payload.fieldsToSelect).toBeUndefined();
    expect(payload.customParametersMap.estimatedShipDate_from).toBe(String(new Date('2026-05-22T00:00:00.000').getTime()));
    expect(payload.customParametersMap.estimatedShipDate_thru).toBe(String(new Date('2026-05-23T23:59:59.999').getTime()));
  });

  it('builds a shipment search payload for shipment ids', () => {
    expect(buildShipmentLookupPayload({ queryString: 'SHIP_100' }).customParametersMap).toMatchObject({
      shipmentId: 'SHIP_100',
    });
  });

  it('uses route segment lookup before shipment header lookup for tracking searches', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [{
          shipmentId: 'SHIP1',
          trackingIdNumber: '1Z999',
        }],
      })
      .mockResolvedValueOnce({
        data: {
          count: 1,
          entityValueList: [{
            shipmentId: 'SHIP1',
            primaryOrderId: 'M100051',
            statusId: 'SHIPMENT_SHIPPED',
            carrierPartyId: 'UPS',
            trackingIdNumber: '1Z999',
          }],
        },
      });

    const result = await searchShipments({ queryString: '1Z999' });

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'poorti/orderShipmentAndRouteSegments',
      method: 'get',
      params: {
        trackingIdNumber: '1Z999',
        pageSize: 100,
      },
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        customParametersMap: { shipmentId_in: 'SHIP1' },
      }),
    });
    expect(result.shipments[0]).toMatchObject({
      id: 'SHIP1',
      orderId: 'M100051',
      trackingCode: '1Z999',
    });
  });
});
