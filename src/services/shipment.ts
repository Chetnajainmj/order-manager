import { api } from '@common';
import { DateTime } from 'luxon';
import {
  allDocs,
  buildRelatedDataDocumentPayload,
  defaultDataDocuments,
  normalizeShipmentDoc,
  orderShipmentLookupFields,
  toNumberValue,
  toStringValue,
  uniqueStrings
} from './OrderService';
import type {
  Shipment,
  ShipmentItem,
  ShipmentPackage,
  ShipmentPackageContent,
  ShipmentRouteSegment,
  ShipmentStatusChange
} from '@/types/order';

export interface ShipmentSearchParams {
  queryString?: string;
  status?: string;
  carrierPartyId?: string;
  dateFrom?: string;
  dateThru?: string;
  pageSize?: number;
  pageIndex?: number;
}

export interface ShipmentSearchResult {
  shipments: Shipment[];
  total: number;
}

export function buildShipmentLookupPayload(params: ShipmentSearchParams = {}, shipmentIds: string[] = []) {
  const customParametersMap: Record<string, string> = {};
  const searchTerm = params.queryString?.trim();

  if (shipmentIds.length) {
    customParametersMap.shipmentId_in = shipmentIds.join(',');
  } else if (searchTerm) {
    if (isShipmentId(searchTerm)) {
      customParametersMap.shipmentId = searchTerm;
    } else if (isOrderSearch(searchTerm)) {
      customParametersMap.primaryOrderId = searchTerm;
    } else {
      customParametersMap.trackingIdNumber = searchTerm;
    }
  }

  if (params.status && params.status !== 'All') customParametersMap.statusId = params.status;
  if (params.carrierPartyId && params.carrierPartyId !== 'All') customParametersMap.carrierPartyId = params.carrierPartyId;
  if (params.dateFrom) customParametersMap.estimatedShipDate_from = toStartOfDayMillis(params.dateFrom);
  if (params.dateThru) customParametersMap.estimatedShipDate_thru = toEndOfDayMillis(params.dateThru);

  return {
    dataDocumentId: defaultDataDocuments.shipmentLookup,
    format: 'json',
    customParametersMap,
    orderByField: '-createdDate',
    pageSize: Number(params.pageSize ?? 50),
    pageIndex: Number(params.pageIndex ?? 0)
  };
}

export async function searchShipments(params: ShipmentSearchParams = {}): Promise<ShipmentSearchResult> {
  const searchTerm = params.queryString?.trim();
  const trackingSearch = Boolean(searchTerm && !isShipmentId(searchTerm) && !isOrderSearch(searchTerm));
  const trackingRows = trackingSearch ? await resolveShipmentRowsByTracking(searchTerm as string) : [];
  const shipmentIds = uniqueStrings(trackingRows.map((row: any) => toStringValue(row.shipmentId)));

  if (trackingSearch && !shipmentIds.length) {
    return { shipments: [], total: 0 };
  }

  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildShipmentLookupPayload(trackingSearch ? { ...params, queryString: '' } : params, shipmentIds)
  });
  const trackingByShipmentId = new Map(trackingRows.map((row: any) => [
    toStringValue(row.shipmentId),
    toStringValue(row.trackingIdNumber ?? row.trackingCode)
  ]));
  const docs = allDocs(response.data);

  return {
    shipments: docs.map((doc: any) => {
      const shipment = normalizeShipmentDoc(doc);
      const trackingCode = trackingByShipmentId.get(shipment.id);
      return trackingCode && !shipment.trackingCode ? { ...shipment, trackingCode } : shipment;
    }),
    total: Number(response.data?.count ?? response.data?.total ?? response.data?.response?.numFound ?? docs.length)
  };
}

export async function getShipment(shipmentId: string): Promise<Shipment> {
  const [shipmentResponse, itemResponse] = await Promise.all([
    api({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: buildRelatedDataDocumentPayload(
        defaultDataDocuments.shipmentLookup,
        'shipmentId',
        shipmentId
      )
    }),
    api({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: buildRelatedDataDocumentPayload(
        defaultDataDocuments.orderShipmentLookup,
        'shipmentId',
        shipmentId,
        orderShipmentLookupFields
      )
    })
  ]);
  const header = allDocs(shipmentResponse.data)[0] || { shipmentId };
  const items = allDocs(itemResponse.data).map(normalizeShipmentItem);

  return {
    ...normalizeShipmentDoc(header, shipmentId),
    itemIds: uniqueStrings(items.flatMap((item) => [item.id, item.orderItemSeqId])),
    items
  };
}

export async function getShipmentPackages(shipmentId: string): Promise<ShipmentPackage[]> {
  const [packageResponse, contentResponse] = await Promise.all([
    api({
      url: `poorti/shipments/${shipmentId}/shipmentPackages`,
      method: 'get',
      params: { pageSize: 100 }
    }),
    api({
      url: `poorti/shipments/${shipmentId}/shipmentPackageContents`,
      method: 'get',
      params: { pageSize: 100 }
    })
  ]);
  const contentsByPackage = responseList(contentResponse.data).reduce((contents: Record<string, ShipmentPackageContent[]>, doc: any) => {
    const packageId = toStringValue(doc.shipmentPackageSeqId);
    if (!packageId) return contents;

    const currentContents = contents[packageId] || [];
    currentContents.push(normalizePackageContent(doc));
    contents[packageId] = currentContents;
    return contents;
  }, {});

  return responseList(packageResponse.data).map((doc) => normalizeShipmentPackage(doc, contentsByPackage));
}

export async function getShipmentRouteSegments(shipmentId: string): Promise<ShipmentRouteSegment[]> {
  const response = await api({
    url: 'poorti/orderShipmentAndRouteSegments',
    method: 'get',
    params: {
      shipmentId,
      pageSize: 100
    }
  });

  return responseList(response.data).map(normalizeShipmentRouteSegment);
}

export async function getShipmentStatusHistory(shipmentId: string): Promise<ShipmentStatusChange[]> {
  const response = await api({
    url: `poorti/shipments/${shipmentId}/statusHistory`,
    method: 'get',
    params: {
      pageSize: 100,
      orderByField: '-statusDate'
    }
  });

  return responseList(response.data).map(normalizeShipmentStatusChange);
}

function normalizeShipmentItem(doc: any): ShipmentItem {
  return {
    id: toStringValue(doc.shipmentItemSeqId ?? doc.orderItemSeqId),
    orderId: toStringValue(doc.orderId),
    orderItemSeqId: toStringValue(doc.orderItemSeqId),
    productId: toStringValue(doc.productId),
    description: toStringValue(doc.itemDescription ?? doc.productId),
    quantity: toNumberValue(doc.quantity),
    dimensions: toStringValue(doc.dimensions)
  };
}

function normalizePackageContent(doc: any): ShipmentPackageContent {
  return {
    shipmentItemSeqId: toStringValue(doc.shipmentItemSeqId),
    quantity: toNumberValue(doc.quantity),
    productId: toStringValue(doc.subProductId ?? doc.productId)
  };
}

function normalizeShipmentPackage(doc: any, contentsByPackage: Record<string, ShipmentPackageContent[]>): ShipmentPackage {
  const packageId = toStringValue(doc.shipmentPackageSeqId);

  return {
    id: packageId,
    shipmentId: toStringValue(doc.shipmentId),
    packageName: toStringValue(doc.packageName),
    boxTypeId: toStringValue(doc.shipmentBoxTypeId),
    dimensions: formatDimensions(doc),
    weight: toNumberValue(doc.weight),
    weightUomId: unitLabel(doc.weightUomId),
    trackingCode: toStringValue(doc.trackingCode ?? doc.trackingIdNumber),
    carrier: toStringValue(doc.carrierPartyId),
    routeSegmentId: toStringValue(doc.shipmentRouteSegmentId),
    contents: contentsByPackage[packageId] || []
  };
}

function normalizeShipmentRouteSegment(doc: any): ShipmentRouteSegment {
  return {
    id: toStringValue(doc.shipmentRouteSegmentId),
    shipmentId: toStringValue(doc.shipmentId),
    carrier: toStringValue(doc.routeSegCarrierPartyId ?? doc.carrierPartyId),
    method: toStringValue(doc.routeSegShipmentMethodDescription ?? doc.routeSegShipmentMethodTypeId ?? doc.shipmentMethodTypeId),
    trackingCode: toStringValue(doc.trackingIdNumber ?? doc.trackingCode),
    status: toStringValue(doc.carrierServiceStatusId ?? doc.shipmentStatusId ?? doc.statusId),
    actualCarrierCode: toStringValue(doc.actualCarrierCode),
    estimatedShipDate: toStringValue(doc.estimatedShipDate ?? doc.shipmentShippedDate),
    estimatedArrivalDate: toStringValue(doc.estimatedArrivalDate),
    statusDate: toStringValue(doc.statusDate)
  };
}

function normalizeShipmentStatusChange(doc: any): ShipmentStatusChange {
  return {
    id: toStringValue(doc.shipmentStatusId ?? `${doc.statusId}-${doc.statusDate}`),
    shipmentId: toStringValue(doc.shipmentId),
    statusId: toStringValue(doc.statusId),
    statusDate: toStringValue(doc.statusDate),
    changedBy: toStringValue(doc.changeByUserLoginId)
  };
}

function formatDimensions(doc: any) {
  const dimensions = [doc.boxLength, doc.boxWidth, doc.boxHeight].map((value) => toStringValue(value)).filter(Boolean);
  const unit = unitLabel(doc.dimensionUomId);
  return dimensions.length ? `${dimensions.join(' x ')}${unit ? ` ${unit}` : ''}` : '';
}

function unitLabel(value: any) {
  if (value && typeof value === 'object') {
    return toStringValue(value.abbreviation ?? value.description ?? value.uomId);
  }

  return toStringValue(value);
}

function responseList(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.documentData)) return data.documentData;
  return allDocs(data);
}

async function resolveShipmentRowsByTracking(trackingCode: string) {
  const response = await api({
    url: 'poorti/orderShipmentAndRouteSegments',
    method: 'get',
    params: {
      trackingIdNumber: trackingCode,
      pageSize: 100
    }
  });
  const docs = responseList(response.data);
  const exactMatches = docs.filter((doc: any) => {
    const value = toStringValue(doc.trackingIdNumber ?? doc.trackingCode);
    return !value || value === trackingCode;
  });

  return exactMatches.length ? exactMatches : docs;
}

function toStartOfDayMillis(value: string) {
  return DateTime.fromISO(value).startOf('day').toMillis().toString();
}

function toEndOfDayMillis(value: string) {
  return DateTime.fromISO(value).endOf('day').toMillis().toString();
}

function isShipmentId(value: string) {
  return /^SHIP[-_]/i.test(value);
}

function isOrderSearch(value: string) {
  return value.startsWith('#') || /^[A-Z]+[-_]?\d+$/i.test(value) || /^\d{5,}$/.test(value);
}
