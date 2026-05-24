# Brief 09 — Find Customers screen

> Before you start: read `../PROJECT.md`, `../CONVENTIONS.md`, `../ENDPOINTS.md § Parties / Customers`, `../ENDPOINTS.md § Pre-seeded DataDocuments`. Briefs 00–02 must be complete. Brief 07 provides the detail page rows will link to.

## Goal

A search screen at `/customers` that lets a CSR find a customer by **name** (first / middle / last / group / party name), with secondary recognition for email and phone in the same searchbar. Filters for status and loyalty tier. Infinite-scroll pagination. Tapping a row navigates to the existing `/customers/:customerId` detail view from brief 07.

## Inputs

- Pattern to clone: [`src/views/OrderSearch.vue`](../../src/views/OrderSearch.vue), [`src/store/order.ts`](../../src/store/order.ts), [`src/services/order.ts`](../../src/services/order.ts) `buildOrderLookupPayload`.
- Current stubs to replace: [`src/store/customers.ts`](../../src/store/customers.ts) (1-line stub).
- Detail route already exists: `/customers/:customerId` → `CustomerDetail.vue` (brief 07).
- Field list already declared: `customerLookupFields` in `src/services/OrderService.ts` lines 151–171; `normalizeCustomerDoc` at lines 367–390.

## Architecture: which endpoint?

Two viable paths — pick **A** unless the live probe in step 0 shows it's still thin.

### A. `oms/parties` entity-list (preferred)

`GET oms/parties` accepts `firstName`, `middleName`, `lastName`, `groupName`, `personalTitle`, `partyTypeId`, `statusId` filters plus pagination + `dependentLevels`. This is the most reliable way to search by name today — the existing `OrderManagerCustomerLookup` DataDocument is **thin** (live probe shows only `partyId, createdStamp, lastUpdatedStamp` — see ENDPOINTS.md § Pre-seeded DataDocuments and brief 07's note).

```
GET oms/parties?partyTypeId=PERSON&lastName=Smith_op=contains&pageSize=50&pageIndex=0&dependentLevels=1
```

Trade-off: no joined `emailAddress` / `lifetimeOrders` / `loyaltyTier` columns. The list view shows name + partyId + status; full contact info loads on the detail page (brief 07).

### B. Enrich-and-search via a new DataDocument (fallback / follow-up)

If the row content is too sparse with option A, seed `OrderManagerCustomerSearchLookup` over `PartyNameDetail + emailAddress + primary TelecomNumber + lifetimeOrders + lifetimeValue + loyaltyTier`. The fields list already in `OrderService.ts:151` is the template. Use the brief 07 seed script `scripts/seed-customer-contact-datadoc.mjs` as the pattern.

**Recommendation:** ship option A first, file a follow-up to upgrade to B if the sparse rows become a pain point.

## Query routing

Inside `buildCustomerSearchParams` (option A) or `buildCustomerLookupPayload` (option B):

| Pattern | Mapped to |
|---|---|
| `@` present | `emailAddress` (option B). With option A: hand off to a contact-mech lookup via `OrderManagerCustomerContactLookup` to resolve → `partyId`, then `GET oms/parties?partyId=...`. |
| All digits (≥ 7) | `contactNumber` (option B) / contact-mech lookup (option A). |
| Single token | `lastName_op=contains` (most common case) + parallel `groupName_op=contains` for company accounts. |
| Two-plus tokens | first token → `firstName_op=contains`, last token → `lastName_op=contains`. |
| Starts with `10` and is all digits (typical Hotwax partyId) | `partyId` (exact). |

Filter map:

| Filter | Param |
|---|---|
| status (`All` = omit) | `statusId` |
| party type (`All` = omit; default `PERSON`) | `partyTypeId` |
| loyalty tier (option B only) | `loyaltyTier` |

## Tasks

0. **Smoke-check the live DataDocument shape first** to decide A vs B:

   ```bash
   eval "$(node scripts/dev-login.mjs --shell)"
   curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -X POST "${MAARG_URL}oms/dataDocumentView" \
     -d '{"dataDocumentId":"OrderManagerCustomerLookup","format":"json","pageSize":3}' | jq '.entityValueList[0]'
   ```

   If it still returns only `partyId` + timestamps, go with option A.

1. **Service — extend [`src/services/customer.ts`](../../src/services/customer.ts):**
   - Export `interface CustomerSearchParams { queryString?, status?, partyTypeId?, loyaltyTier?, pageSize?, pageIndex? }`.
   - Export `searchCustomers(params): Promise<{ customers: Customer[], total: number }>`.
   - For option A: build query params for `GET oms/parties`. Map response rows through `normalizeCustomerDoc` (already handles `firstName / lastName / groupName / partyName / partyId` fallbacks). Total comes from the entity-list response (`count` or `Content-Range`).
   - For option B: build a `dataDocumentView` payload mirroring `buildOrderLookupPayload`.

2. **Store — flesh out [`src/store/customers.ts`](../../src/store/customers.ts):**
   - Trimmed clone of `src/store/order.ts:30`.
   - State: `searchQuery`, `searchFilters` (`status`, `partyTypeId`, `loyaltyTier`), `searchResults: Customer[]`, `searchTotal`, `pageIndex`, `pageSize` (50), `loading`, `error`.
   - Actions: `runSearch`, `appendNextPage`, `fetchSearchPage`, `toSearchParams`.
   - Getter: `hasMore`.
   - `persist: true`.

3. **View — new `src/views/CustomerSearch.vue`:**
   - Clone the `OrderSearch.vue` skeleton.
   - Searchbar placeholder: `"Name, email, phone"`.
   - Filters: status (from `useUtilStore().getStatusItemsByType('PARTY_STATUS')`), partyType (PERSON / PARTY_GROUP), loyalty tier (option B only — hide the row otherwise).
   - Row content: `{{ customer.name || customer.id }}` / `{{ customer.email || customer.phone || customer.partyTypeId }}` with `:router-link="`/customers/${customer.id}`"`. Show `lifetimeOrders · loyaltyTier` as `<ion-note slot="end">` if present.
   - Empty / error states via `EmptyState.vue` / `ErrorState.vue`.

4. **Route — add to [`src/router/index.ts`](../../src/router/index.ts):**
   - `{ path: '/customers', name: 'CustomerSearch', component: CustomerSearch, beforeEnter: authGuard }`. Insert before the dynamic `/customers/:customerId`.

5. **Menu — add to [`src/components/Menu.vue`](../../src/components/Menu.vue):**
   - New `<ion-menu-toggle>` block with `peopleOutline` icon and `translate("Find customers")` label, routing to `/customers`.

6. **Util store warm-up.** Add `fetchStatusItemsByType('PARTY_STATUS')` to the search view's `onMounted` if the util store doesn't already have it.

7. **Tests.** `src/services/customer.spec.ts` should cover the query-routing branches and the `normalizeCustomerDoc` happy path against both `oms/parties` and (if applicable) DataDocument responses.

## Don't do

- Don't introduce edit / create-party actions — out of scope.
- Don't fetch the contact-mech sub-doc on every search row; that's a detail-screen concern (brief 07).
- Don't add a "merge customers" affordance even if it shows up in legacy screens — defer.

## Done when

- Typing a name fragment returns matching customers within ~300ms.
- Typing an email matches by contact-mech lookup → party.
- Status / party-type filters narrow results.
- Infinite scroll appends pages.
- Tapping a row opens `/customers/{partyId}` (brief 07's view).
- "Find customers" appears in the sidebar.

## Hand off

- If you went with option B, document the seed script and field list under `ENDPOINTS.md § Pre-seeded DataDocuments`.
- Note any divergences between the entity-list response shape and what `normalizeCustomerDoc` expected.
- If you discovered a `partyName_op=contains` filter that worked, document it on the `oms/parties` row in `ENDPOINTS.md § Parties / Customers`.
