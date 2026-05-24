export type OrderStatus = string;

export type OrderActionGroup =
  | 'order-status'
  | 'order-info'
  | 'items'
  | 'ship-groups'
  | 'payments'
  | 'communications'
  | 'notes'
  | 'returns'
  | 'metadata'
  | 'adjustments'
  | 'downloads'
  | 'fulfillment'
  | 'appeasement';

export type OrderActionImplementationStatus = 'callable' | 'backend-gap';

export interface OrderActionDefinition {
  id: string;
  label: string;
  group: OrderActionGroup;
  legacySource: string;
  permission: string;
  endpoint?: string;
  endpointStatus: 'documented-endpoint' | 'backend-gap' | 'documented-backend-gap';
  implementationStatus: OrderActionImplementationStatus;
  hiddenForStatuses?: string[];
}

export interface OrderActionContext {
  permissions: string[];
  orderStatus?: string;
}

export interface Address {
  label: string;
  lines: string[];
}

export interface PostalAddress {
  address1: string;
  address2: string;
  city: string;
  stateProvinceGeoId: string;
  postalCode: string;
  countryGeoId: string;
}

export interface ContactMech {
  contactMechId: string;
  contactMechTypeId: string;
  contactMechPurposeTypeId: string;
  infoString: string;
  postalAddress?: PostalAddress;
  expireDate: string;
}

export interface PaymentPreference {
  id: string;
  method: string;
  status: string;
  amount: number;
  gatewayResponse: string;
}

export interface OrderTerm {
  id: string;
  type: string;
  value: string;
  description: string;
}

export interface OrderRole {
  partyId: string;
  roleTypeId: string;
  name: string;
}

export interface OrderAttribute {
  name: string;
  value: string;
}

export interface CommunicationEvent {
  id: string;
  subject: string;
  entryDate: string;
  statusId: string;
  typeId: string;
}

export interface OrderStatusChange {
  id: string;
  at: string;
  label: string;
  detail: string;
  itemSeqId?: string;
}

export interface OrderNote {
  id: string;
  author: string;
  createdAt: string;
  body: string;
  internal: boolean;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  shippedQuantity?: number;
  cancelledQuantity?: number;
  returnedQuantity?: number;
  status: string;
  facility: string;
  unitPrice: number;
  adjustments?: number;
  shipGroupSeqId?: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  shipmentTypeId?: string;
  status: string;
  carrier: string;
  trackingCode: string;
  origin: string;
  destination: string;
  originFacilityId?: string;
  originFacilityName?: string;
  destinationFacilityId?: string;
  destinationFacilityName?: string;
  shipDate: string;
  estimatedShipDate?: string;
  estimatedArrivalDate?: string;
  latestCancelDate?: string;
  createdDate?: string;
  itemIds: string[];
  items?: ShipmentItem[];
  packages: ShipmentPackage[];
}

export interface ShipmentItem {
  id: string;
  orderId: string;
  orderItemSeqId: string;
  productId: string;
  description: string;
  quantity: number;
  dimensions?: string;
}

export interface ShipmentPackageContent {
  shipmentItemSeqId: string;
  quantity: number;
  productId: string;
}

export interface ShipmentPackage {
  id: string;
  shipmentId: string;
  packageName: string;
  boxTypeId: string;
  dimensions: string;
  weight: number;
  weightUomId: string;
  trackingCode: string;
  carrier: string;
  routeSegmentId: string;
  contents: ShipmentPackageContent[];
}

export interface ShipmentRouteSegment {
  id: string;
  shipmentId: string;
  carrier: string;
  method: string;
  trackingCode: string;
  status: string;
  actualCarrierCode: string;
  estimatedShipDate: string;
  estimatedArrivalDate: string;
  statusDate: string;
}

export interface ShipmentStatusChange {
  id: string;
  shipmentId: string;
  statusId: string;
  statusDate: string;
  changedBy: string;
}

export interface ReturnRecord {
  id: string;
  externalId?: string;
  orderId: string;
  status: string;
  reason: string;
  requestedDate: string;
  receivedDate?: string;
  returnHeaderTypeId?: string;
  fromPartyId?: string;
  toPartyId?: string;
  entryDate?: string;
  currencyUomId?: string;
  createdBy?: string;
  itemIds: string[];
  refundTotal: number;
}

export interface ReturnItem {
  returnId: string;
  returnItemSeqId: string;
  returnReasonId: string;
  returnTypeId: string;
  returnItemTypeId: string;
  productId: string;
  description: string;
  orderId: string;
  orderItemSeqId: string;
  statusId: string;
  returnQuantity: number;
  receivedQuantity: number;
  returnPrice: number;
  returnItemResponseId: string;
}

export interface ReturnStatusChange {
  id: string;
  returnId: string;
  statusId: string;
  statusDate: string;
  changedBy: string;
}

export interface Customer {
  id: string;
  name: string;
  personalTitle?: string;
  partyTypeId?: string;
  statusId?: string;
  externalId?: string;
  createdStamp?: string;
  lastUpdatedStamp?: string;
  email: string;
  phone: string;
  loyaltyTier: string;
  lifetimeOrders: number;
  lifetimeValue: number;
  addresses: Address[];
  contactMechs?: ContactMech[];
  emails?: ContactMech[];
  phones?: ContactMech[];
  postalAddresses?: ContactMech[];
}

export interface Order {
  id: string;
  externalId: string;
  orderDate: string;
  status: OrderStatus;
  customerId: string;
  channel: string;
  total: number;
  currency: string;
  productStoreId?: string;
  entryDate?: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  deliveryMethod: string;
  priority: string;
  items: OrderItem[];
  shipmentIds: string[];
  returnIds: string[];
  notes: OrderNote[];
  history: OrderStatusChange[];
  payments?: PaymentPreference[];
  terms?: OrderTerm[];
  roles?: OrderRole[];
  attributes?: OrderAttribute[];
  communicationEvents?: CommunicationEvent[];
  shipGroups?: Array<{
    id: string;
    shipmentId: string;
    method: string;
    status: string;
    trackingCode: string;
    carrier: string;
    facilityId: string;
    facilityName: string;
  }>;
  contactInfo?: Address[];
}
