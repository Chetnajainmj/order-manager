# Brief 07 — View Customer

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md`, `../LEGACY_SCREENS.md § viewprofile`. Briefs 00–02 must be complete.

## Goal

Replace the mock customer profile with a real customer view: name, contact mechs, addresses, recent orders. Match the in-scope sections in `LEGACY_SCREENS.md § viewprofile`.

## Inputs

- Current view: `src/views/CustomerDetail.vue` (117 lines). Layout reusable.
- Endpoints: `../ENDPOINTS.md § Parties / Customers`. The relevant ones are `oms/parties/{partyId}`, `oms/partyContactMechs`, plus order search by customer.

## Architecture

| Section          | Endpoint                                                                                                          |
|------------------|-------------------------------------------------------------------------------------------------------------------|
| Profile          | `GET oms/parties/{partyId}` (returns `PartyNameDetail`)                                                           |
| Contact mechs    | **NO swagger endpoint exists for this.** Seed/use DataDocument `OrderManagerCustomerContactLookup` over `PartyContactMech + ContactMech + PartyContactMechPurpose + PostalAddress + TelecomNumber` and query via `POST oms/dataDocumentView`. Pattern: `POST moqui/dataDocuments` to define, `POST admin/dataDocuments/{id}/fields` for each field. |
|                  | (2) If you're blocked, hit each `*ContactMech` entity individually — but the swagger doesn't expose those either; you'd need to add the endpoints. **Option 1 is strongly preferred.** |
| Recent orders    | `POST oms/dataDocumentView` with `OrderManagerOrderLookup`, `customParametersMap.customerPartyId={partyId}`, `orderByField=-orderDate`, `pageSize=10`. The DataDocument is seeded (live-verified) and joins OrderHeader+OrderRole+Party. |
| Recent returns   | `GET oms/returns?fromPartyId={partyId}&dependentLevels=1&orderByField=-entryDate&pageSize=10`                     |
| Communication log| `GET oms/communicationEvents?partyId={partyId}` (defer to follow-up)                                              |

**Note on `OrderManagerCustomerLookup`:** the existing DataDocument by that name is thin — live probes show it returns only `partyId, createdStamp, lastUpdatedStamp`. It's not enough for the profile section by itself. Use `oms/parties/{partyId}` for the profile data. The `OrderManagerCustomerContactLookup` we seed in this brief is a separate (new) DataDocument focused on contact mechs.

## Tasks

1. **`src/services/customer.ts`:**
   - `getCustomer(partyId)`.
   - `getCustomerContactMechs(partyId)` — returns grouped email / phone / postal.
   - `getCustomerOrders(partyId, { pageSize, pageIndex })` — uses the order DataDocument from brief 03.
   - Normalizers (carry forward `normalizeCustomerDoc` from `OrderService.ts`).

2. **`src/store/customer.ts`** (Pinia):
   - Cache `Record<string, Customer>`, `ordersByCustomer`, `contactMechsByCustomer`.
   - Action `loadCustomer(partyId)`.

3. **Extend `src/types/order.ts`:**
   - `Customer`: add `personalTitle`, `createdStamp`, `lastUpdatedStamp`, plus contact-mech sub-collections.
   - Add `ContactMech`: `contactMechId`, `contactMechTypeId`, `infoString`, `postalAddress?`, `expireDate`.
   - Add `PostalAddress`: `address1`, `address2`, `city`, `stateProvinceGeoId`, `postalCode`, `countryGeoId`.

4. **Rebuild `views/CustomerDetail.vue`:**
   - Profile header (name, personal title, party type, lifetime metrics if accessible).
   - Contact card (email, phone — primary + others).
   - Addresses card (postal addresses with type label).
   - Recent orders list (with `<router-link>` to each).
   - Optional "Recent returns" and "Recent emails" panels — defer if data is hard to get.

5. **Cross-links:** Each order → `/orders/{orderId}` (Brief 04). The "Recent orders" list should accept a "View all" link that runs the order search prefiltered by `customerPartyId`.

6. **Permission gate.** `meta: { permissionId: 'PARTYMGR_VIEW' }` (confirm actual ID).

7. **Tests.** Contact-mech grouping logic + normalizer unit tests.

## Out of scope (defer)

- Editing party info
- Adding / editing contact mechs
- Managing roles or relationships (`viewroles`, `EditPartyRelationships`)
- Tax info / party attributes
- Vendor view

## Done when

- `/customers/{realPartyId}` renders profile + contact mechs + addresses + recent orders against a real instance.
- "Order history" → tappable rows that navigate to the order detail.
- Recent orders sort correctly by date desc.

## Hand off

If `oms/partyContactMechs` response shape diverges from what `normalizeCustomerDoc` assumed, document the actual shape and update the normalizer.

Implemented locally without a git commit per instruction. Customer detail now has `src/services/customer.ts`, `src/store/customer.ts`, and a read-only Ionic detail view backed by `GET oms/parties/{partyId}`, recent orders through the existing `OrderManagerOrderLookup` DataDocument with `customerPartyId`, and contact mechs through the expected `OrderManagerCustomerContactLookup` DataDocument. App-level and route-level permission gates remain intentionally omitted per user direction.

Backend gap closed: `OrderManagerCustomerContactLookup` was seeded through `scripts/seed-customer-contact-datadoc.mjs`. The live document uses primary entity `org.apache.ofbiz.party.contact.PartyContactMech` with relation fields `contactMech:*`, `purposes:*`, `TelecomNumber:*`, and `PostalAddress:*`. `oms/dataDocumentView` lowercases aliases for this document, so the customer-contact query filters with `customParametersMap.partyid` and normalizes lowercase response keys. Browser smoke on `/customers/CUST_1` returned 200 for profile, contact lookup, and recent-order lookup; `CUST_1` currently has no contact rows. Recent returns and communication log panels remain deferred.
