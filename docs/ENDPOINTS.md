# Moqui Endpoint Catalog (swagger + live-probe verified)

> Built from the live Swagger specs at `https://dev-maarg.hotwax.io/rest/service.swagger/*`, saved at `docs/swagger/*.json`, and confirmed with read-only probes against the dev instance.
>
> Re-fetch: `node scripts/fetch-swagger.mjs` · re-index: `node scripts/index-swagger.mjs [<spec>] [--details]` · drill in: `node scripts/inspect-op.mjs <spec> <METHOD> '<path-pattern>'` · live probe: `node scripts/api-probe.mjs` (needs `.env.local`).

## Base URLs at runtime

| Cookie key | Resolved as                          | Used for                                              |
|------------|--------------------------------------|-------------------------------------------------------|
| `oms`      | `https://<oms>.hotwax.io/api/`       | OFBiz-side: `/api/login`, `/api/logout`, `/api/getPermissions`. Default `commonUtil.getOmsURL()`. |
| `maarg`    | `https://<maarg>.hotwax.io/rest/s1/` | Moqui-side: everything else. Default `commonUtil.getMaargURL()` and default `baseURL` of `api()`. |

`api({ url: 'oms/orders' })` → `https://<maarg>.hotwax.io/rest/s1/oms/orders`.

## Available Swagger spec groups

| Group                     | Ops | Local file                              |
|---------------------------|-----|-----------------------------------------|
| `oms/orders`              | 30  | `docs/swagger/oms-orders.json`          |
| `oms/returns`             | 2   | `docs/swagger/oms-returns.json`         |
| `oms/products`            | 5   | `docs/swagger/oms-products.json`        |
| `oms/parties`             | 7   | `docs/swagger/oms-parties.json`         |
| `oms/facilities`          | —   | `docs/swagger/oms-facilities.json`      |
| `oms/productStores`       | —   | `docs/swagger/oms-productStores.json`   |
| `oms/communicationEvents` | 2   | `docs/swagger/oms-communicationEvents.json` |
| `poorti`                  | 67  | `docs/swagger/poorti.json`              |
| `moqui`                   | 89  | `docs/swagger/moqui.json`               |
| `admin`                   | 104 | `docs/swagger/admin.json`               |
| `api`                     | 2   | `docs/swagger/api.json`                 |

## The big picture — three query mechanisms

1. **Entity-list endpoints** — `GET oms/orders`, `GET oms/returns`, `GET oms/parties`. Each accepts the entity's fields as query-string filters plus `pageIndex`, `pageSize`, `orderByField`, `pageNoLimit`, **`dependentLevels`** (Moqui's "include N nested levels" flag). Sufficient for most simple lists.
2. **Deep service endpoints** — e.g. `GET oms/orders/{orderId}` calls `co.hotwax.orderledger.order.OrderServices.get#SalesOrder` and returns a screen-shaped object with `orderDetail.shipGroups[].items[]` already hydrated.
3. **DataDocument lookups** — `POST oms/dataDocumentView` against a pre-seeded `OrderManager*Lookup`. This is what gives us indexed (Solr/ES) search-style queries over joined entities. **Confirmed working** on the dev instance with a live probe.

`oms/dataDocumentView` is not in the swagger because it's service-backed, but the call works. Confirmed shape:

```json
POST oms/dataDocumentView
{
  "dataDocumentId": "OrderManagerOrderLookup",
  "format": "json",
  "fieldsToSelect": ["hcOrderId","orderName","externalId","orderDate","statusId","grandTotal","currencyUom","productStoreId"],
  "customParametersMap": { "orderTypeId": "SALES_ORDER", "statusId": "ORDER_APPROVED" },
  "orderByField": "-orderDate",
  "pageSize": 50,
  "pageIndex": 0
}
```

Response: `{ entityValueList: [...], count: <total> }`. (Codex's `normalizeOrderCollectionResponse` already handles this shape.)

## Pre-seeded DataDocuments on the dev instance (verified live)

All 11 of these are already seeded and indexed to the `oms` ElasticSearch index. **Codex's `defaultDataDocuments` map was correct — every entry resolves.**

| dataDocumentId                       | Primary entity                | Use for                                          |
|--------------------------------------|-------------------------------|--------------------------------------------------|
| `OrderManagerOrderLookup`            | `OrderHeader`                 | Find Orders + customer's recent orders           |
| `OrderManagerOrderItemLookup`        | `OrderItem`                   | Order items list                                  |
| `OrderManagerOrderRoleLookup`        | `OrderRole`                   | Customer / sales-rep bindings on an order         |
| `OrderManagerOrderShipmentLookup`    | `OrderShipment`               | Order ↔ shipment join                             |
| `OrderManagerOrderNoteLookup`        | `OrderHeaderNote`             | Notes attached to an order                        |
| `OrderManagerNoteDataLookup`         | `NoteData`                    | Body content for notes                            |
| `OrderManagerOrderStatusLookup`      | `OrderStatus`                 | Order status-change history                       |
| `OrderManagerShipmentLookup`         | `Shipment`                    | Shipment header (use for shipment list / detail)  |
| `OrderManagerReturnLookup`           | `ReturnHeader`                | Return header                                     |
| `OrderManagerReturnItemLookup`       | `ReturnItem`                  | Return items                                      |
| `OrderManagerCustomerLookup`         | `Person`                      | Customer header — thin (partyId + timestamps); enrich via `oms/parties/{partyId}` |
| `OrderManagerCustomerContactLookup`  | `PartyContactMech`                 | Brief 07 customer contacts. Seeded via `scripts/seed-customer-contact-datadoc.mjs`; fields include `contactMech:*`, `purposes:*`, `TelecomNumber:*`, and `PostalAddress:*`. Filter with lowercase `customParametersMap.partyid`. |

Brief 06 uses the existing `OrderManagerReturnLookup` and `OrderManagerReturnItemLookup` DataDocuments for `/returns/{returnId}`. Return status history currently comes from `GET oms/returns?returnId={id}&dependentLevels=2`; add a ReturnStatus DataDocument later if the nested status payload is incomplete in a populated environment.

> **`fieldsToSelect` quirk on the Return DataDocuments (verified live 2026-05-24).** Passing `fieldsToSelect` to `oms/dataDocumentView` for `OrderManagerReturnLookup` and `OrderManagerReturnItemLookup` causes the server to silently strip fields from each row — including the PK (`returnId`). Omit `fieldsToSelect` entirely for these calls; the DataDocument's own field list is the projection. Probed combinations: `["returnId"]`, `["returnid"]`, `["statusId"]` all dropped fields the field-list defines. Same issue confirmed on `OrderManagerCustomerContactLookup`. Pattern: when calling these DDs via `buildRelatedDataDocumentPayload`, do NOT pass the fields-list argument. Brief 08 search calls follow this rule.

Other useful seeded DataDocuments (no ES index — query via `admin/dataDocuments/{id}/data` with `pageIndex`/`pageSize`/`orderByField`):

| dataDocumentId                          | Primary entity                       |
|-----------------------------------------|--------------------------------------|
| `ShipmentRouteAndPackageRouteSegment`   | `ShipmentRouteSegment` (joined with packages) |
| `ProductStoreShipmentMethod`            | `ProductStoreShipmentMeth`           |
| `FacilityCarrier` / `FacilityGroupAndMember` | facility metadata             |
| `OmsProduct`                            | `Product` (indexed `oms`)            |

Add new DataDocuments via `POST moqui/dataDocuments` (define) + `POST admin/dataDocuments/{id}/fields` (add fields) + put into a DataFeed indexed to `oms`.

## Auth (admin.rest.xml + admin swagger)

| HTTP   | Path                              | Service / Entity                                            | Auth          |
|--------|-----------------------------------|-------------------------------------------------------------|---------------|
| POST   | `admin/login`                     | `co.hotwax.auth.AuthServices.login#User`                    | anonymous     |
| GET    | `admin/checkLoginOptions`         | `co.hotwax.auth.AuthServices.check#LoginOptions`            | anonymous     |
| GET    | `admin/user/profile`              | `co.hotwax.util.UserServices.get#UserProfile`               | bearer        |
| POST   | `admin/user/profile`              | `co.hotwax.util.UserServices.update#UserAccount`            | bearer        |
| GET    | `admin/user/permissions`          | `co.hotwax.util.UserServices.get#SecurityPermissions`       | bearer        |
| GET    | `admin/user/getAvailableTimeZones`| `co.hotwax.util.UtilityServices.get#AvailableTimeZones`     | bearer        |
| GET    | `admin/productStores`             | `ProductStore` (list)                                       | bearer        |
| GET    | `admin/facilities`                | `co.hotwax.facility.FacilityAndType`                        | bearer        |
| GET    | `admin/enums`                     | `co.hotwax.common.enum.EnumerationAndType`                  | bearer        |
| GET    | `admin/status`                    | `co.hotwax.common.status.StatusItemAndType`                 | bearer        |
| GET    | `admin/statusFlows`               | `moqui.basic.StatusFlow`                                    | bearer        |
| GET    | `admin/statusFlows/transitions`   | `moqui.basic.StatusFlowTransition`                          | bearer        |
| GET    | `admin/groups`                    | `co.hotwax.security.SecurityGroupAndPermission`             | bearer        |
| GET    | `admin/permissions`               | `SecurityPermission`                                        | bearer        |
| GET    | `admin/dataDocuments`             | seeded DataDocument list                                    | bearer        |

> Login endpoint used by `@common/useAuth.login()` is the **OFBiz-side** `POST {oms}/login` — not `admin/login`. That's the single approved OFBiz exception. `admin/login` is the Moqui-side equivalent and the future direction; today's accxui apps use the OFBiz one.

## Orders (oms/orders, 30 ops)

### Read

| HTTP | Path                                          | Notes |
|------|-----------------------------------------------|-------|
| GET  | `oms/orders`                                  | Entity-list with **dependentLevels** support. Returns full nested entity values when `dependentLevels=2`: `adjustments`, `roles`, `paymentPreferences`, `identifications`, `contactMechs`, `shipGroups`, `statuses`, `contents`. **Use for raw entity-level reads.** |
| GET  | `oms/orders/{orderId}`                        | Service `get#SalesOrder`. Returns `{ orderDetail: { orderId, orderName, externalId, orderDate, orderStatusId, productStoreId, entryDate, grandTotal, currencyUom, salesChannel, partyId, customerFirstName, customerLastName, shipGroups: [{ shipGroupSeqId, shipmentMethodTypeId, shipmentId, shipmentStatusId, trackingCode, carrierPartyId, facilityId, facilityName, picklistId, items: [{ orderItemSeqId, itemStatusId, productId, ... }] }] } }`. **Best for View Order screen.** |
| GET  | `oms/orders/{orderId}/items`                  | `OrderItem` list                                                                              |
| GET  | `oms/orders/{orderId}/items/{orderItemSeqId}` | Single item                                                                                   |
| GET  | `oms/orders/{orderId}/shipGroups`             | `OrderItemShipGroup` list                                                                     |
| GET  | `oms/orders/{orderId}/status`                 | `OrderStatus` list — **status history**                                                       |
| GET  | `oms/orders/{orderId}/attributes`             | `OrderAttribute` list                                                                         |
| GET  | `oms/orders/{orderId}/facilityChange`         | History of facility changes for items                                                         |
| GET  | `oms/orders/shipToStore`                      | Service `get#ShipToStoreOrders`                                                               |

Entity-list filters available on `GET oms/orders`: `orderId`, `orderTypeId`, `orderName`, `externalId`, `salesChannelEnumId`, `orderDate`, `priority`, `entryDate`, `pickSheetPrintedDate`, `statusId`, `createdBy`, `firstAttemptOrderId`, `currencyUom`, `syncStatusId`, `billingAccountId`, `originFacilityId`, `webSiteId`, `productStoreId`, `terminalId`, `transactionId`, `autoOrderShoppingListId`, `needsInventoryIssuance`, `isRushOrder`, `internalCode`, `remainingSubTotal`, `grandTotal`, `isViewed`, `invoicePerShipment`, `expireDate`, `localeString`, `customerClassificationId`, `presentmentCurrencyUom`, `autoApprove`, `statusFlowId`, `lastUpdatedStamp`, `createdStamp`, plus pagination + `dependentLevels`. **Note:** no direct `customerPartyId` filter — for that, use `OrderManagerOrderLookup` DataDocument.

### Write / actions

| HTTP   | Path                                                              | Service                                                                          |
|--------|-------------------------------------------------------------------|----------------------------------------------------------------------------------|
| POST   | `oms/orders`                                                      | Create order                                                                     |
| PUT    | `oms/orders/{orderId}`                                            | Update order header                                                              |
| DELETE | `oms/orders/{orderId}`                                            | Delete order                                                                     |
| POST   | `oms/orders/{orderId}/items`                                      | Add item                                                                         |
| PUT    | `oms/orders/{orderId}/items/{seq}`                                | Update item                                                                      |
| DELETE | `oms/orders/{orderId}/items/{seq}`                                | Delete item                                                                      |
| POST   | `oms/orders/{orderId}/items/{seq}/cancel`                         | `OrderServices.cancel#SalesOrderItem`                                            |
| POST   | `oms/orders/{orderId}/items/{seq}/reject`                         | `OrderServices.reject#OrderItem`                                                 |
| POST   | `oms/orders/{orderId}/items/{seq}/reservation`                    | Create inventory reservation                                                     |
| DELETE | `oms/orders/{orderId}/items/{seq}/reservation`                    | Cancel inventory reservation                                                     |
| POST   | `oms/orders/{orderId}/items/{seq}/allocation`                     | Process item allocation                                                          |
| POST   | `oms/orders/{orderId}/items/cancel`                               | Bulk cancel items (`SalesOrderItems`)                                            |
| PUT    | `oms/orders/{orderId}/shipGroups/{shipGroupSeqId}`                | Update ship group                                                                |
| POST   | `oms/orders/{orderId}/allocation`                                 | Order-level facility allocation                                                  |
| POST   | `oms/orders/{orderId}/reject`                                     | Bulk reject items                                                                |
| POST   | `oms/orders/{orderId}/soft-allocations/reserve-inventory`         | Soft-allocate inventory                                                          |
| POST   | `oms/orders/{orderId}/shipToStore`                                | Convert BOPIS → ship-to-store                                                    |
| POST   | `oms/orders/pickupScheduledNotification`                          | `EmailServices.send#EmailOnOrderEvents`                                          |
| POST   | `oms/orders/sendEmailNotification`                                | Same — send order email (`PRDS_ODR_CONFIRM`, `PRDS_ODR_COMPLETE`, etc.)         |
| POST   | `oms/orders/pickup/{orderId}/notification`                        | BOPIS pickup notification                                                        |

## Returns (oms/returns, 2 ops only)

| HTTP | Path                  | Notes                                                            |
|------|-----------------------|------------------------------------------------------------------|
| GET  | `oms/returns`         | Entity-list, filters: `returnId`, `externalId`, `returnHeaderTypeId`, `statusId`, `createdBy`, `fromPartyId`, `toPartyId`, `paymentMethodId`, `finAccountId`, `billingAccountId`, `entryDate`, `originContactMechId`, `destinationFacilityId`, `needsInventoryReceive`, `currencyUomId`, `supplierRmaId`, `returnChannelEnumId`, `transactionId`, `returnDate`, `employeeId`, `terminalId`, `lastUpdatedStamp`, `createdStamp` + `dependentLevels` |
| POST | `oms/returns`         | Create return                                                    |

**Gap:** there is no `/oms/returns/{returnId}` endpoint and no return-item endpoint in the swagger. Use:
- `GET oms/returns?returnId={id}&dependentLevels=2` for the header (entity-list with single-record filter), OR
- `POST oms/dataDocumentView { dataDocumentId: 'OrderManagerReturnLookup', customParametersMap: { returnId } }` for the indexed view, AND
- `POST oms/dataDocumentView { dataDocumentId: 'OrderManagerReturnItemLookup', customParametersMap: { returnId } }` for items.

## Shipments (poorti, 67 ops)

| HTTP   | Path                                                          | Notes                                                                     |
|--------|---------------------------------------------------------------|---------------------------------------------------------------------------|
| GET    | `poorti/shipments`                                            | `FulfillmentServices.get#Shipments` — service-backed list                 |
| POST   | `poorti/shipments`                                            | Create shipment                                                           |
| PUT    | `poorti/shipments/{shipmentId}`                               | Update shipment                                                           |
| POST   | `poorti/shipments/{shipmentId}/pack` / `/unpack` / `/ship`    | Pack / unpack / ship                                                      |
| GET    | `poorti/shipments/{shipmentId}/shipmentPackages`              | `ShipmentPackage` list                                                    |
| POST   | `poorti/shipments/{shipmentId}/shipmentPackages`              | Create package                                                            |
| GET/PUT| `poorti/shipments/{id}/shipmentPackages/{seq}`                | Package detail / update                                                   |
| GET/POST | `poorti/shipments/{id}/shipmentPackageContents`             | Package contents                                                          |
| POST   | `poorti/shipments/{id}/shipmentPackageRouteSegments`          | Create route segment for package                                          |
| PUT    | `poorti/shipments/{id}/shipmentRouteSegment`                  | Update route segment                                                      |
| GET    | `poorti/shipments/{shipmentId}/statusHistory`                 | `ShipmentStatus` list                                                     |
| GET    | `poorti/orderShipmentAndRouteSegments`                        | `co.hotwax.customerservice.order.OrderShipmentAndRouteSegment` — view designed for customer service screens |
| PUT    | `poorti/updateShipmentTracking`                               | Update tracking                                                           |
| PUT    | `poorti/updateShipmentCarrierAndMethod`                       | Update carrier/method                                                     |
| POST   | `poorti/shipments/bulkPack` / `bulkShip`                      | Bulk operations                                                           |
| GET    | `poorti/Picklist.pdf` / `PackingSlip.pdf` / `Label.pdf` / `Manifest.pdf` | Print artifacts                                                  |
| GET    | `poorti/shipmentFacets`                                       | Facets for filtering UI                                                   |

## Parties / Customers (oms/parties, 7 ops)

| HTTP   | Path                            | Notes                                                                                          |
|--------|---------------------------------|------------------------------------------------------------------------------------------------|
| GET    | `oms/parties`                   | List `PartyNameDetail`. Filters: `partyId`, `partyTypeId`, `externalId`, `description`, `statusId`, `firstName`, `middleName`, `lastName`, `firstNameLocal`, `lastNameLocal`, `personalTitle`, `suffix`, `groupName`, `groupNameLocal` + pagination + `dependentLevels`. |
| POST   | `oms/parties`                   | Create party                                                                                   |
| GET    | `oms/parties/{partyId}`         | Single party (`PartyNameDetail` one)                                                           |
| PUT    | `oms/parties/{partyId}`         | Update                                                                                         |
| DELETE | `oms/parties/{partyId}`         | Delete                                                                                         |
| POST   | `oms/parties/{partyId}/partyGroup` | Create party group                                                                          |
| DELETE | `oms/parties/{partyId}/partyGroup/{partyId}` | Delete party group                                                                |

**Gap:** there is **no `partyContactMechs` endpoint in the swagger**. Live probes show `dependentLevels=2` on `oms/parties/{partyId}` does not pull contact mechs either. Options:

Use the seeded `OrderManagerCustomerContactLookup` DataDocument:

```json
POST oms/dataDocumentView
{
  "dataDocumentId": "OrderManagerCustomerContactLookup",
  "format": "json",
  "customParametersMap": { "partyid": "CUST_1" },
  "pageSize": 100,
  "pageIndex": 0
}
```

Response aliases are lowercased for this document (`contactmechtypeid`, `postalcode`, etc.), so normalize both camel-case and lowercase keys in the app.

## Communication events

| HTTP | Path                       | Notes                                                                          |
|------|----------------------------|--------------------------------------------------------------------------------|
| GET  | `oms/communicationEvents`  | `co.hotwax.orderledger.order.email.EmailServices.get#CommunicationEvents`     |
| POST | `oms/communicationEvents`  | Create event                                                                   |

Use for the "Activity / Emails sent" panel on the order detail screen.

## Reference data / lookups

| HTTP | Path                          | Use for                                                                    |
|------|-------------------------------|----------------------------------------------------------------------------|
| GET  | `admin/status?statusTypeId=ORDER_STATUS` | Order status enum for filter dropdown                            |
| GET  | `admin/status?statusTypeId=ORDER_ITEM_STATUS` | Order item status enum                                       |
| GET  | `admin/status?statusTypeId=RETURN_STATUS` | Return status enum                                              |
| GET  | `admin/enums?enumTypeId=ORDER_SALES_CHANNEL` | Sales channel options                                        |
| GET  | `admin/productStores`         | Product store dropdown                                                     |
| GET  | `admin/facilities`            | Facility dropdown                                                          |
| GET  | `oms/paymentMethodTypes`      | Payment-method type options                                                |
| GET  | `admin/statusFlows/transitions?statusId={current}` | Allowed status transitions for an entity              |

## DataDocument management (admin/dataDocuments)

| HTTP   | Path                                                    | Notes                                            |
|--------|---------------------------------------------------------|--------------------------------------------------|
| GET    | `admin/dataDocuments`                                   | List seeded DataDocuments                        |
| GET    | `admin/dataDocuments/{id}/data`                         | Get all rows (only pagination + orderBy, **no filter params** — limited use) |
| GET    | `admin/dataDocuments/{id}/relatedEntities`              | Inspect the DataDocument shape                    |
| POST   | `admin/dataDocuments/{id}/fields`                       | Add a field to an existing DataDocument          |
| PUT/DELETE | `admin/dataDocuments/{id}/fields/{seq}`             | Update / remove field                            |
| POST   | `admin/dataDocuments/{id}/conditions`                   | Add a condition                                  |
| GET    | `moqui/dataDocuments`                                   | (alternate list)                                 |
| POST   | `moqui/dataDocuments`                                   | **Create a new DataDocument**                    |
| POST   | `moqui/dataDocuments/{id}/clone`                        | Clone for variation                              |
| POST   | `moqui/dataDocuments/feeds/{feedId}/index`              | Index a feed's docs into ES                      |
| POST   | `moqui/dataDocuments/indexes/{indexName}/search`        | ElasticSearch-style search (Lucene query string) |

The pattern for seeding a new DataDocument:
1. `POST moqui/dataDocuments { dataDocumentId, primaryEntityName, indexName, ... }`
2. `POST admin/dataDocuments/{id}/fields` for each field you need
3. `POST admin/dataDocuments/{id}/conditions` for filter conditions
4. Add to a `DataFeed` (via `admin/dataFeeds`) and `POST moqui/dataDocuments/feeds/{id}/index` to populate ES.
5. Query via `POST oms/dataDocumentView` (service-backed; recommended for app calls) or `POST moqui/dataDocuments/indexes/{indexName}/search` (Lucene).

## Endpoints we explicitly do NOT call

- Anything under `atp/*` (deprecated since maarg 4.4.0; redirected to `admin/*`).
- Any OFBiz `/control/*` URL.
- The OFBiz `/api/login` is the **only** OFBiz endpoint the app touches — all other `oms`-host calls today are for `getPermissions`, `logout`, `checkLoginOptions` which `@common/useAuth` handles.
