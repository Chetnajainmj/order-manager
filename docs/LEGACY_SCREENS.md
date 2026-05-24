# Legacy OFBiz Screens — what we are replacing

> Verified against `/Users/adityapatel/Documents/GitHub/hotwax-oms` source XML. Every line citation here was confirmed; if you find a discrepancy, fix this doc.
>
> For each screen we list: the source XML, every widget / include / template referenced, every action service called by the screen or its forms, every entity touched, every cross-link to other screens, and the permission gates.

## 1. OrderFindOrder (Find Orders)

- **Legacy URL:** `/ordermgr/control/findorders`
- **Source:** `applications/order/widget/ordermgr/OrderViewScreens.xml:247-275`
- **Scripts:** `FindOrders.groovy`, `FindPrinters.groovy`
- **Decorator:** `CommonOrderViewDecorator` (lines 265–272)
- **Templates:**
  - `SetMultipleSelectJs.ftl` (line 267)
  - `FindOrders.ftl` (line 269)
- **Search inputs (FindOrders.ftl):** order ID, external order ID, customer name / party ID / email / phone, date range, status, sales channel, product store, payment method, currency, order type
- **Cross-links:** Each result row → `orderview?orderId={orderId}`
- **Permissions:** No explicit `if-has-permission` on the screen; gated by the parent menu (`ORDERMGR_VIEW`)

**Migration target:** `views/OrderSearch.vue` calling `POST oms/dataDocumentView` with an `OrderManagerOrderLookup`-shape DataDocument (to be seeded). See [briefs/03-find-order.md](briefs/03-find-order.md).

## 2. OrderHeaderView (View Order)

- **Legacy URL:** `/ordermgr/control/orderview`
- **Source:** `applications/order/widget/ordermgr/OrderViewScreens.xml:54-83`
- **Scripts:** `OrderView.groovy` (line 62), `OrderViewWebSecure.groovy` (line 63)
- **Top-level widgets:**
  - `<include-screen name="orderHeader"/>` (line 68) — wraps the rest
  - `OrderItems.ftl` (line 71)
  - `OrderNotes.ftl` (line 74)
  - `Transitions.ftl` (line 77)
- **`orderHeader` screen includes (lines 84–108):**
  - `orderinfo` → `OrderInfo.ftl` (line 114)
  - `orderterms` → `OrderTerms.ftl` (line 123)
  - `orderpaymentinfo` → `OrderPaymentInfo.ftl` (line 132)
  - `projectAssoOrder` (line 95) — entities: `OrderHeaderAndWorkEffort`, `OrderRole`, `PaymentMethod` (lines 144–147)
  - `ordercontactinfo` → `OrderContactInfo.ftl` (line 171)
  - `OrderRoleInfo` (line 99)
  - `ordershippinginfo` → `OrderShippingInfo.ftl` (line 189)
  - `OrderSalesReps` → `OrderSalesReps.ftl` (line 198)

### Sections the user sees (consolidated)

| Section            | Source template          | Renders                                                                                       |
|--------------------|--------------------------|------------------------------------------------------------------------------------------------|
| Order header       | `OrderInfo.ftl`          | Order ID, external order name, dates, status, currency, sales channel, store, priority         |
| Terms              | `OrderTerms.ftl`         | Payment terms, tax terms                                                                       |
| Payment info       | `OrderPaymentInfo.ftl`   | Payment method(s), auth amount, capture status, gateway response                               |
| Contact info       | `OrderContactInfo.ftl`   | Billing address, shipping address(es), bill-to & ship-to parties                               |
| Order roles        | (form `ListOrderRoles`)  | All party-role bindings (sales rep, affiliate, customer)                                       |
| Shipping info      | `OrderShippingInfo.ftl`  | Shipment method, tracking codes, carrier, ETA                                                  |
| Sales reps         | `OrderSalesReps.ftl`     | Assigned sales reps                                                                            |
| Items              | `OrderItems.ftl`         | Line items: product, SKU, qty ordered / shipped / returned, unit price, adjustments, status    |
| Notes              | `OrderNotes.ftl`         | Internal notes + customer-visible notes                                                        |
| Transitions        | `Transitions.ftl`        | Status-flow actions: approve, hold/release, cancel, complete, ship                             |

### Actions / services that fire from this screen and its forms

| Trigger                          | Service / endpoint                                                                  |
|----------------------------------|-------------------------------------------------------------------------------------|
| Add note                         | (form on `OrderNewNote` screen, lines 276–302)                                      |
| Receive payment                  | `OrderReceivePayment` (lines 368–392)                                               |
| Send confirmation email          | `SendOrderConfirmation`, emailType `PRDS_ODR_CONFIRM` (lines 404–422)               |
| Send completion email            | `SendOrderCompletion`, emailType `PRDS_ODR_COMPLETE` (lines 423–441)                |
| Update order header              | `updateOrderHeader` form target                                                     |
| Edit order terms                 | `ListOrderTerms` (lines 442–462)                                                    |
| Approve / hold / release / cancel| `Transitions.ftl` form targets — `changeOrderStatus`, etc.                          |
| Add / remove order role          | form on `OrderRoleInfo`                                                             |

### Cross-links

- Each item row → product detail
- Shipment header → `/facility/control/ViewShipment?shipmentId=...`
- Return link → `/ordermgr/control/returnMain?returnId=...`
- Customer party → `/partymgr/control/viewprofile?partyId=...`

### Permissions

- `<if-has-permission permission="ORDERMGR" action="_VIEW"/>` gates note creation (line 279)
- `<if-has-permission permission="PROJECTMGR" action="_VIEW"/>` conditional for `projectAssoOrder` (line 140)
- `ORDERMGR_SEND_CONFIRMATION` (implicit for email screens)
- `ORDERMGR_UPDATE` for term / status edits

**Migration target:** `views/OrderDetail.vue` calling primarily `GET oms/orders/{orderId}` (the deep-fetch `OrderServices.get#SalesOrder` returns header + items + ship groups + payments + parties + addresses in one call), plus side calls for notes, status history, communication events. See [briefs/04-view-order.md](briefs/04-view-order.md).

## 3. ViewShipment

- **Legacy URL:** `/facility/control/ViewShipment`
- **Source:** `applications/product/widget/facility/ShipmentScreens.xml:152-200`
- **Scripts:** `ViewShipment.groovy` (line 159), `EditShipmentItems.groovy`, `EditShipmentPackages.groovy`, `EditShipmentRouteSegments.groovy`
- **Decorator:** `CommonShipmentDecorator` (lines 74–77) — loads `Shipment` and `DestinationFacility`
- **Templates (lines 164–197):**
  - `ViewShipmentInfo.ftl` (line 175) — header
  - `ViewShipmentItemInfo.ftl` (lines 177–181) — items in `shipmentItemPanel`
  - `ViewShipmentPackageInfo.ftl` (lines 182–186) — packages
  - `ViewShipmentRouteInfo.ftl` (lines 187–191) — route segments
  - `ViewShipmentRouteInfo.ftl` again (lines 192–196) — receipts panel (yes, same FTL is included twice)
- **Conditional actions:**
  - Receive Inventory (line 113) — for PURCHASE_SHIPMENT
  - Receive Against PO (line 133) — for PURCHASE_SHIPMENT
- **Permissions:** `<if-has-permission permission="FACILITY" action="_VIEW"/>` (lines 34, 84)

### Sections

| Section        | Renders                                                              |
|----------------|----------------------------------------------------------------------|
| Shipment Info  | Shipment ID, type, status, dates, origin/destination facility        |
| Shipment Items | Items being shipped, qty, dimensions                                 |
| Packages       | Package config, weight, tracking number per package                  |
| Route Segments | Carrier, method, segment status, tracking                            |
| Receipts       | Receipts (purchase shipments only)                                   |

### Actions / services

| Trigger                | Service / endpoint                                  |
|------------------------|-----------------------------------------------------|
| Edit shipment header   | `EditShipment` screen (lines 207–226)               |
| Edit items             | `EditShipmentItems` (lines 227–246)                 |
| Edit packages          | `EditShipmentPackages` (lines 292–311)              |
| Edit route segments    | `EditShipmentRouteSegments` (lines 312–331)         |
| Add items from order   | `AddItemsFromOrder` (lines 332–351)                 |
| View receipts          | `ViewShipmentReceipts` (lines 352–367)              |

### Cross-links

- Each item → order item (back to `OrderHeaderView`)
- Route segments may link to carrier party (`viewprofile`)

**Migration target:** `views/ShipmentDetail.vue` calling `poorti/shipments` GET, plus `poorti/shipments/{id}/shipmentPackages`, `poorti/shipments/{id}/statusHistory`, `poorti/orderShipmentAndRouteSegments` (entity built for customer service). See [briefs/05-view-shipment.md](briefs/05-view-shipment.md).

## 4. OrderReturnHeader / returnMain (View Return)

- **Legacy URL:** `/ordermgr/control/returnMain` (the user's filing label)
- **Source:** `applications/order/widget/ordermgr/OrderReturnScreens.xml:85-106`
- **Scripts:** `ReturnHeader.groovy` (line 93)
- **Top-level widget:** `<include-form name="EditReturn"/>` from `ReturnForms.xml` (line 100)
- **Related screens in same XML:**
  - `OrderFindReturn` (lines 41–63) — find/list returns
  - `OrderQuickReturn` (lines 65–84) — quick return creation
  - `OrderReturnItems` (lines 128–152) — return item list + edit
  - `ReturnStatusHistory` (lines 178–205)
  - `ReturnTypeHistory` (lines 207–233)
  - `ReturnReasonHistory` (lines 235–261)
  - `ReturnQuantityHistory` (lines 263–289)
  - `ReceivedQuantityHistory` (lines 291–317)
  - `ReturnPriceHistory` (lines 319–345)

> Note: there is no screen literally named `returnMain` in source; `OrderReturnHeader` is the canonical detail screen and is the migration target.

### Sections / actions

| Section / action               | Service / endpoint                          |
|--------------------------------|---------------------------------------------|
| Return header (form `EditReturn`) | `updateReturnHeader` form target         |
| Return items list              | `OrderReturnItems` includes `ReturnItems.ftl` |
| Edit return item               | `updateReturnItem` form target              |
| Update received quantity       | `receiveReturnItem`                         |
| Approve return                 | `changeReturnStatus` (status transition)    |
| Receive return items           | `changeReturnStatus`                        |
| Cancel return                  | `changeReturnStatus`                        |
| Status history                 | `ReturnStatusHistory` screen                |

### Cross-links

- Each return item → order item (back to `OrderHeaderView`)
- From-party → `viewprofile`

### Permissions

- `ORDERMGR_RETURN` (menu gate, OrderMenus.xml:66–71)
- `ORDERMGR_UPDATE` for edits

**Migration target:** `views/ReturnDetail.vue` calling `oms/returns` GET (for list) and `oms/dataDocumentView` with `ReturnHeaderAndItem` shape for detail. Status changes via `POST` to a status-flow transition service (to be confirmed on the Moqui side). See [briefs/06-view-return.md](briefs/06-view-return.md).

## 5. viewprofile (View Customer)

- **Legacy URL:** `/partymgr/control/viewprofile`
- **Source:** `applications/party/widget/partymgr/PartyScreens.xml:71-159`
- **Script:** `ViewProfile.groovy` (line 79)
- **Top-level widget:** `<include-portal-page id="PartyProfile"/>` (line 145) — the actual content is portal-driven
- **Conditional lookups:** `findPartyFromTelephone` (line 92), `findPartyFromEmailAddress` (line 108)
- **Show/Hide-old toggle:** lines 124–141 — controls whether expired contact mechs are displayed

### Sections (delivered via PartyProfile portal page)

- Party info: name, type, status, created/updated stamps
- Contact mechanisms: emails, phones, postal addresses (active + optionally inactive)
- Party roles & classifications
- Recent orders (by partyId)
- Communication history

### Adjacent screens

- `viewroles` (lines 160–216) — role list; add via `AddPartySecondaryRoles` (lines 217–228)
- `EditPartyRelationships` (lines 259–319) — parent / child / affiliate links
- `viewvendor` (lines 321–344)
- `EditPartyAttribute` (lines 346–371) — custom attributes
- `EditPartyTaxAuthInfos` (lines 373–400)

### Permissions

- `PARTYMGR_VIEW` (implicit menu gate)
- `PARTYMGR_UPDATE` (lines 182, 241) for role / relationship edits

**Migration target:** `views/CustomerDetail.vue` calling `GET oms/parties/{partyId}`, `GET oms/partyContactMechs?partyId=...`, and a DataDocument-shape query for recent orders by customer. See [briefs/07-view-customer.md](briefs/07-view-customer.md).

## Top-nav menu (Order Manager / Customer Service role)

Source: `applications/order/widget/ordermgr/OrderMenus.xml:21-90`

| Menu item    | Lines     | Target                          | Permission gate                                       |
|--------------|-----------|---------------------------------|-------------------------------------------------------|
| Request      | 22–30     | `FindRequest`                   | `ORDERMGR_VIEW` OR `ORDERMGR_PURCHASE_VIEW`           |
| Quote        | 32–40     | `FindQuote`                     | `ORDERMGR_VIEW` OR `ORDERMGR_PURCHASE_VIEW`           |
| Order List   | 42–47     | `orderlist`                     | `ORDERMGR_VIEW`                                       |
| Find Orders  | 49–54     | `findorders` (OrderFindOrder)   | `ORDERMGR_VIEW`                                       |
| Order Entry  | 56–64     | `orderentry`                    | `ORDERMGR_CREATE` OR `ORDERMGR_PURCHASE_CREATE`       |
| Returns      | 66–71     | `findreturn` (OrderFindReturn)  | `ORDERMGR_RETURN`                                     |
| Requirements | 73–81     | `FindRequirements`              | `ORDERMGR_VIEW` OR `ORDERMGR_ROLE_VIEW`               |
| Reports      | 83–85     | `OrderPurchaseReportOptions`    | —                                                     |
| Stats        | 87–89     | `orderstats`                    | —                                                     |

**In-scope for this migration:** Find Orders, View Order (orderview), View Shipment, View Return (findreturn → return detail), View Customer (viewprofile). The user's stated goal also lets us pull in adjacent items the role uses daily; treat Quotes, Requests, Requirements, Reports, Stats as out-of-scope unless promoted later.

## Permissions to mirror

The Moqui side should expose equivalents to:

- `ORDERMGR_VIEW` — read order screens
- `ORDERMGR_UPDATE` — edit order / item / status
- `ORDERMGR_CREATE` — create new orders (out of scope today)
- `ORDERMGR_DELETE` — destructive ops (out of scope)
- `ORDERMGR_RETURN` — return workflow
- `ORDERMGR_SEND_CONFIRMATION` — send order emails
- `FACILITY_VIEW` — view shipments
- `PARTYMGR_VIEW` — view customer profiles
- `PARTYMGR_UPDATE` — edit customer profile / roles

Check the actual permission IDs in `co.hotwax.security.SecurityGroupAndPermission` via `GET admin/groups` and update [briefs/01-auth.md](briefs/01-auth.md) accordingly.
