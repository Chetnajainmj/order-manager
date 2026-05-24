import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_CONTACT_DATADOC_ID,
  buildCustomerContactSeedPlan
} from './customer-contact-datadoc-definition.mjs';

describe('customer contact DataDocument definition', () => {
  it('builds the customer contact lookup over the purpose detail view entity', () => {
    const plan = buildCustomerContactSeedPlan();

    expect(plan.document).toEqual({
      dataDocumentId: CUSTOMER_CONTACT_DATADOC_ID,
      documentName: 'Order Manager Customer Contact Lookup',
      documentTitle: 'Order Manager Customer Contact Lookup',
      indexName: 'oms',
      primaryEntityName: 'org.apache.ofbiz.party.contact.PartyContactMech'
    });
  });

  it('selects the app-facing customer contact aliases', () => {
    const plan = buildCustomerContactSeedPlan();

    expect(plan.fields.map((field) => field.fieldNameAlias)).toEqual([
      'partyId',
      'contactMechId',
      'contactMechTypeId',
      'contactMechPurposeTypeId',
      'infoString',
      'countryCode',
      'areaCode',
      'contactNumber',
      'address1',
      'address2',
      'city',
      'stateProvinceGeoId',
      'postalCode',
      'countryGeoId',
      'expireDate'
    ]);
    expect(plan.fields.at(-1)).toMatchObject({
      fieldPath: 'thruDate',
      fieldNameAlias: 'expireDate'
    });
    expect(plan.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldPath: 'contactMech:contactMechTypeId',
        fieldNameAlias: 'contactMechTypeId'
      }),
      expect.objectContaining({
        fieldPath: 'purposes:contactMechPurposeTypeId',
        fieldNameAlias: 'contactMechPurposeTypeId'
      }),
      expect.objectContaining({
        fieldPath: 'TelecomNumber:countryCode',
        fieldNameAlias: 'countryCode'
      }),
      expect.objectContaining({
        fieldPath: 'PostalAddress:address1',
        fieldNameAlias: 'address1'
      })
    ]));
    expect(plan.fields.every((field) => field.dataDocumentId === CUSTOMER_CONTACT_DATADOC_ID)).toBe(true);
  });
});
