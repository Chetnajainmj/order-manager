export const CUSTOMER_CONTACT_DATADOC_ID = 'OrderManagerCustomerContactLookup';

const document = {
  dataDocumentId: CUSTOMER_CONTACT_DATADOC_ID,
  documentName: 'Order Manager Customer Contact Lookup',
  documentTitle: 'Order Manager Customer Contact Lookup',
  indexName: 'oms',
  primaryEntityName: 'org.apache.ofbiz.party.contact.PartyContactMech'
};

const fields = [
  ['partyId', 'partyId'],
  ['contactMechId', 'contactMechId'],
  ['contactMech:contactMechTypeId', 'contactMechTypeId'],
  ['purposes:contactMechPurposeTypeId', 'contactMechPurposeTypeId'],
  ['contactMech:infoString', 'infoString'],
  ['TelecomNumber:countryCode', 'countryCode'],
  ['TelecomNumber:areaCode', 'areaCode'],
  ['TelecomNumber:contactNumber', 'contactNumber'],
  ['PostalAddress:address1', 'address1'],
  ['PostalAddress:address2', 'address2'],
  ['PostalAddress:city', 'city'],
  ['PostalAddress:stateProvinceGeoId', 'stateProvinceGeoId'],
  ['PostalAddress:postalCode', 'postalCode'],
  ['PostalAddress:countryGeoId', 'countryGeoId'],
  ['thruDate', 'expireDate']
];

export function buildCustomerContactSeedPlan() {
  return {
    document: { ...document },
    fields: fields.map(([fieldPath, fieldNameAlias], index) => ({
      dataDocumentId: CUSTOMER_CONTACT_DATADOC_ID,
      fieldSeqId: String(index + 1).padStart(2, '0'),
      fieldPath,
      fieldNameAlias,
      defaultDisplay: 'Y',
      sequenceNum: index + 1
    }))
  };
}
