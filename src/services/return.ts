import { DateTime } from 'luxon';
import { api } from '@common';
import {
  allDocs,
  buildRelatedDataDocumentPayload,
  defaultDataDocuments,
  normalizeReturnDoc,
  toNumberValue,
  toStringValue
} from './OrderService';
import type { ReturnItem, ReturnRecord, ReturnStatusChange } from '@/types/order';

export interface ReturnSearchParams {
  queryString?: string;
  status?: string;
  dateFrom?: string;
  dateThru?: string;
  productStoreId?: string;
  pageSize?: number;
  pageIndex?: number;
}

export interface ReturnSearchResult {
  returns: ReturnRecord[];
  total: number;
}

export function buildReturnLookupPayload(params: ReturnSearchParams = {}) {
  const customParametersMap: Record<string, string> = {};
  const searchTerm = params.queryString?.trim();

  if (searchTerm) {
    if (isReturnId(searchTerm)) {
      customParametersMap.returnId = searchTerm;
    } else if (searchTerm.startsWith('#')) {
      customParametersMap.orderId = searchTerm.slice(1);
    } else if (isOrderLikeId(searchTerm)) {
      customParametersMap.orderId = searchTerm;
    } else {
      customParametersMap.partyName = searchTerm;
    }
  }

  if (params.status && params.status !== 'All') customParametersMap.statusId = params.status;
  if (params.productStoreId && params.productStoreId !== 'All') customParametersMap.productStoreId = params.productStoreId;
  if (params.dateFrom) customParametersMap.entryDate_from = toStartOfDayMillis(params.dateFrom);
  if (params.dateThru) customParametersMap.entryDate_thru = toEndOfDayMillis(params.dateThru);

  return {
    dataDocumentId: defaultDataDocuments.returnLookup,
    format: 'json',
    customParametersMap,
    orderByField: '-entryDate',
    pageSize: Number(params.pageSize ?? 50),
    pageIndex: Number(params.pageIndex ?? 0)
  };
}

export async function searchReturns(params: ReturnSearchParams = {}): Promise<ReturnSearchResult> {
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildReturnLookupPayload(params)
  });

  const docs = allDocs(response.data);
  return {
    returns: docs.map((doc: any) => normalizeReturnDoc(doc)),
    total: Number(response.data?.count ?? response.data?.total ?? response.data?.response?.numFound ?? docs.length)
  };
}

export async function getReturn(returnId: string): Promise<ReturnRecord> {
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildRelatedDataDocumentPayload(
      defaultDataDocuments.returnLookup,
      'returnId',
      returnId
    )
  });

  return normalizeReturnDoc(allDocs(response.data)[0] || { returnId }, returnId);
}

export async function getReturnItems(returnId: string): Promise<ReturnItem[]> {
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildRelatedDataDocumentPayload(
      defaultDataDocuments.returnItemLookup,
      'returnId',
      returnId
    )
  });

  return allDocs(response.data).map(normalizeReturnItem);
}

export async function getReturnStatusHistory(returnId: string): Promise<ReturnStatusChange[]> {
  const response = await api({
    url: 'oms/returns',
    method: 'get',
    params: {
      returnId,
      dependentLevels: 2
    }
  });
  const returnRecord = responseList(response.data)[0] || {};

  return responseList(returnRecord.statuses ?? returnRecord.statusHistory).map((status) => normalizeReturnStatusChange(status, returnId));
}

function normalizeReturnItem(doc: any): ReturnItem {
  return {
    returnId: toStringValue(doc.returnId),
    returnItemSeqId: toStringValue(doc.returnItemSeqId),
    returnReasonId: toStringValue(doc.returnReasonId),
    returnTypeId: toStringValue(doc.returnTypeId),
    returnItemTypeId: toStringValue(doc.returnItemTypeId),
    productId: toStringValue(doc.productId),
    description: toStringValue(doc.description ?? doc.itemDescription ?? doc.productId),
    orderId: toStringValue(doc.orderId),
    orderItemSeqId: toStringValue(doc.orderItemSeqId),
    statusId: toStringValue(doc.statusId),
    returnQuantity: toNumberValue(doc.returnQuantity),
    receivedQuantity: toNumberValue(doc.receivedQuantity),
    returnPrice: toNumberValue(doc.returnPrice),
    returnItemResponseId: toStringValue(doc.returnItemResponseId)
  };
}

function normalizeReturnStatusChange(doc: any, fallbackReturnId: string): ReturnStatusChange {
  return {
    id: toStringValue(doc.returnStatusId ?? doc.orderStatusId ?? `${doc.statusId}-${doc.statusDatetime ?? doc.statusDate}`),
    returnId: toStringValue(doc.returnId, fallbackReturnId),
    statusId: toStringValue(doc.statusId),
    statusDate: toStringValue(doc.statusDatetime ?? doc.statusDate),
    changedBy: toStringValue(doc.statusUserLogin ?? doc.changeByUserLoginId)
  };
}

function responseList(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.list)) return data.list;
  return allDocs(data);
}

function toStartOfDayMillis(value: string) {
  return DateTime.fromISO(value).startOf('day').toMillis().toString();
}

function toEndOfDayMillis(value: string) {
  return DateTime.fromISO(value).endOf('day').toMillis().toString();
}

function isReturnId(value: string) {
  return /^(?:RET|RTN|R)[-_]?\d+$/i.test(value);
}

function isOrderLikeId(value: string) {
  return /^[A-Z]+[-_]?\d+$/i.test(value) || /^\d{5,}$/.test(value);
}
