import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import { buildReturnLookupPayload, getReturn, getReturnItems, getReturnStatusHistory, searchReturns } from './return';

vi.mock('@common', () => ({
  api: vi.fn(),
}));

describe('return service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('fetches return header from the return DataDocument', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        entityValueList: [{
          returnId: 'RET1000',
          returnHeaderTypeId: 'CUSTOMER_RETURN',
          statusId: 'RETURN_ACCEPTED',
          fromPartyId: 'CUST_1',
          toPartyId: 'COMPANY',
          entryDate: '2026-05-22T10:00:00',
          currencyUomId: 'USD',
          createdBy: 'system',
          returnTotal: 27,
          orderId: 'M100051',
        }],
      },
    });

    const returnRecord = await getReturn('RET1000');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        dataDocumentId: 'OrderManagerReturnLookup',
        customParametersMap: { returnId: 'RET1000' },
      }),
    });
    expect(returnRecord).toMatchObject({
      id: 'RET1000',
      orderId: 'M100051',
      status: 'RETURN_ACCEPTED',
      returnHeaderTypeId: 'CUSTOMER_RETURN',
      fromPartyId: 'CUST_1',
      toPartyId: 'COMPANY',
      currencyUomId: 'USD',
      createdBy: 'system',
      refundTotal: 27,
    });
  });

  it('fetches return items from the return item DataDocument', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        entityValueList: [{
          returnId: 'RET1000',
          returnItemSeqId: '00001',
          returnReasonId: 'RTN_NOT_WANT',
          returnTypeId: 'RTN_REFUND',
          returnItemTypeId: 'RET_FPROD_ITEM',
          productId: 'SKU1',
          description: 'Pink shirt',
          orderId: 'M100051',
          orderItemSeqId: '01',
          statusId: 'RETURN_ACCEPTED',
          returnQuantity: 2,
          receivedQuantity: 1,
          returnPrice: 12,
          returnItemResponseId: 'RESP1',
        }],
      },
    });

    await expect(getReturnItems('RET1000')).resolves.toEqual([expect.objectContaining({
      returnId: 'RET1000',
      returnItemSeqId: '00001',
      productId: 'SKU1',
      orderId: 'M100051',
      orderItemSeqId: '01',
      returnQuantity: 2,
      receivedQuantity: 1,
      returnPrice: 12,
    })]);
    expect(api).toHaveBeenCalledWith({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        dataDocumentId: 'OrderManagerReturnItemLookup',
        customParametersMap: { returnId: 'RET1000' },
      }),
    });
  });

  describe('buildReturnLookupPayload', () => {
    it('omits customParameters when no query or filters are set', () => {
      const payload = buildReturnLookupPayload({});
      expect(payload.customParametersMap).toEqual({});
      expect(payload.dataDocumentId).toBe('OrderManagerReturnLookup');
      expect(payload.orderByField).toBe('-entryDate');
      expect(payload.pageSize).toBe(50);
      expect(payload.pageIndex).toBe(0);
    });

    it('routes a return-ID-shaped query to returnId', () => {
      expect(buildReturnLookupPayload({ queryString: 'RET1000' }).customParametersMap).toEqual({ returnId: 'RET1000' });
      expect(buildReturnLookupPayload({ queryString: 'R12345' }).customParametersMap).toEqual({ returnId: 'R12345' });
    });

    it('strips the leading # and routes to orderId', () => {
      expect(buildReturnLookupPayload({ queryString: '#M1001' }).customParametersMap).toEqual({ orderId: 'M1001' });
    });

    it('routes an order-like ID to orderId', () => {
      expect(buildReturnLookupPayload({ queryString: 'M100051' }).customParametersMap).toEqual({ orderId: 'M100051' });
      expect(buildReturnLookupPayload({ queryString: '123456' }).customParametersMap).toEqual({ orderId: '123456' });
    });

    it('routes free-text to partyName', () => {
      expect(buildReturnLookupPayload({ queryString: 'Jane Smith' }).customParametersMap).toEqual({ partyName: 'Jane Smith' });
    });

    it('applies status and product-store filters when not All', () => {
      const payload = buildReturnLookupPayload({ status: 'RETURN_ACCEPTED', productStoreId: 'STORE_1' });
      expect(payload.customParametersMap).toEqual({ statusId: 'RETURN_ACCEPTED', productStoreId: 'STORE_1' });
    });

    it('drops All-valued filters', () => {
      const payload = buildReturnLookupPayload({ status: 'All', productStoreId: 'All' });
      expect(payload.customParametersMap).toEqual({});
    });

    it('converts date range to epoch millis', () => {
      const payload = buildReturnLookupPayload({ dateFrom: '2026-05-01', dateThru: '2026-05-31' });
      expect(payload.customParametersMap.entryDate_from).toMatch(/^\d+$/);
      expect(payload.customParametersMap.entryDate_thru).toMatch(/^\d+$/);
      expect(Number(payload.customParametersMap.entryDate_thru)).toBeGreaterThan(Number(payload.customParametersMap.entryDate_from));
    });
  });

  describe('searchReturns', () => {
    it('normalizes returns and reads total from count', async () => {
      vi.mocked(api).mockResolvedValue({
        data: {
          count: 7,
          entityValueList: [{
            returnId: 'RET1000',
            statusId: 'RETURN_ACCEPTED',
            fromPartyId: 'CUST_1',
            orderId: 'M100051',
            entryDate: '2026-05-22',
            returnTotal: 27,
          }],
        },
      });

      const result = await searchReturns({ queryString: 'RET1000' });

      expect(api).toHaveBeenCalledWith({
        url: 'oms/dataDocumentView',
        method: 'post',
        data: expect.objectContaining({
          dataDocumentId: 'OrderManagerReturnLookup',
          customParametersMap: { returnId: 'RET1000' },
        }),
      });
      expect(result.total).toBe(7);
      expect(result.returns).toHaveLength(1);
      expect(result.returns[0]).toMatchObject({ id: 'RET1000', orderId: 'M100051', refundTotal: 27 });
    });

    it('falls back to row count when total is missing', async () => {
      vi.mocked(api).mockResolvedValue({ data: { entityValueList: [{ returnId: 'RET1' }, { returnId: 'RET2' }] } });
      const result = await searchReturns({});
      expect(result.total).toBe(2);
    });
  });

  it('reads nested return status history from the returns entity-list endpoint', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [{
        returnId: 'RET1000',
        statuses: [{
          returnStatusId: '1000',
          statusId: 'RETURN_ACCEPTED',
          statusDatetime: '2026-05-22T12:00:00',
          statusUserLogin: 'system',
        }],
      }],
    });

    await expect(getReturnStatusHistory('RET1000')).resolves.toEqual([{
      id: '1000',
      returnId: 'RET1000',
      statusId: 'RETURN_ACCEPTED',
      statusDate: '2026-05-22T12:00:00',
      changedBy: 'system',
    }]);
    expect(api).toHaveBeenCalledWith({
      url: 'oms/returns',
      method: 'get',
      params: {
        returnId: 'RET1000',
        dependentLevels: 2,
      },
    });
  });
});
