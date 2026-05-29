import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail actions', () => {
  it('uses Ionic action surfaces instead of browser prompts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('actionSheetController');
    expect(source).toContain('alertController');
    expect(source).toContain('legacySalesOrderActions');
    expect(source).not.toContain('window.prompt');
  });

  it('surfaces supported actions near their matching order sections', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('openOrderActions');
    expect(source).toContain('openItemActions');
    expect(source).toContain('hasItemActions(item)');
    expect(source).toContain('openShipGroupEditor');
    expect(source).toContain('shipGroupQuickActions(shipGroup)');
    expect(source).toContain('openCommunicationActions');
    expect(source).toContain('openCommunicationComposer');
    expect(source).toContain('openShipmentDocumentActions');
  });

  it('models custom communications on CommunicationEvent fields and threaded conversations', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('communicationThreads');
    expect(source).toContain('Custom communication');
    expect(source).toContain('<ion-modal :is-open="communicationComposerOpen"');
    expect(source).toContain('<ion-fab-button :disabled="!communicationContentDraft.trim()"');
    expect(source).toContain('communicationEventTypeId');
    expect(source).toContain('parentCommEventId');
    expect(source).toContain('contactMechIdFrom');
    expect(source).toContain('contactMechIdTo');
    expect(source).toContain('roleTypeIdFrom');
    expect(source).toContain('roleTypeIdTo');
    expect(source).toContain('partyIdFrom');
    expect(source).toContain('partyIdTo');
    expect(source).toContain('datetimeStarted');
    expect(source).toContain('contentMimeTypeId');
    expect(source).toContain('messageId');
    expect(source).toContain('externalId');
  });

  it('groups shipping information into ship group sections with their items', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('v-for="shipGroup in displayShipGroups"');
    expect(source).toContain('<ion-card v-for="shipGroup in displayShipGroups"');
    expect(source).toContain("{{ shipGroup.facilityName || shipGroup.facilityId || 'Facility unavailable' }}");
    expect(source).toContain('shipGroupDetails(shipGroup)');
    expect(source).toContain('shipGroupItems(shipGroup)');
    expect(source).toContain('Ship group fields');
    expect(source).toContain('Manage ship group');
    expect(source).toContain('Allow split');
    expect(source).toContain('<p class="overline">details</p>');
    expect(source).toContain('v-if="canUseShipGroupDatesAction(shipGroup)"');
    expect(source).toContain('@click="openShipGroupEditor(shipGroup, \'dates\')"');
    expect(source).toContain(':outline="true"');
    expect(source).toContain(':icon="calendarOutline"');
    expect(source).toContain('<ion-label>shipping dates</ion-label>');
    expect(source).toContain('v-if="canUseShipGroupGiftAction(shipGroup)"');
    expect(source).toContain('@click="openShipGroupEditor(shipGroup, \'gift\')"');
    expect(source).toContain(':icon="giftOutline"');
    expect(source).toContain('<ion-label>gift</ion-label>');
    expect(source).toContain('Shipping instructions');
    expect(source).not.toContain("<h2>{{ shipGroupItems(shipGroup).length }} item{{ shipGroupItems(shipGroup).length === 1 ? '' : 's' }}</h2>");
  });

  it('uses focused ship group editors instead of one generic data menu', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('<ion-modal :is-open="Boolean(shipGroupEditorMode)"');
    expect(source).toContain('<ion-fab vertical="bottom" horizontal="end" slot="fixed">');
    expect(source).toContain(':icon="closeOutline"');
    expect(source).toContain(':icon="saveOutline"');
    expect(source).toContain('shipGroupEditorMode === \'dates\'');
    expect(source).toContain('canUseShipGroupDatesAction(shipGroup)');
    expect(source).toContain('v-model="shipGroupShipAfterDraft"');
    expect(source).toContain('v-model="shipGroupShipByDraft"');
    expect(source).toContain(':min="todayDate"');
    expect(source).toContain(':min="shipGroupShipAfterDraft || todayDate"');
    expect(source).toContain('canUseShipGroupRoutingAction(shipGroup)');
    expect(source).toContain('@ionChange="updateShipGroupRoutingField(shipGroup, \'shipmentMethodTypeId\', $event.detail.value)"');
    expect(source).toContain('@ionChange="updateShipGroupRoutingField(shipGroup, \'carrierPartyId\', $event.detail.value)"');
    expect(source).not.toContain('@ionChange="updateShipGroupRoutingField(shipGroup, \'facilityId\', $event.detail.value)"');
    expect(source).not.toContain('shipGroupEditorMode === \'routing\'');
    expect(source).toContain('shipGroupEditorMode === \'shipToStore\'');
    expect(source).toContain('<ion-select v-model="shipGroupStoreFacilityDraft"');
  });

  it('renders a dedicated timeline and keeps activity out of notes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('Order timeline');
    expect(source).toContain('orderTimeline');
    expect(source.match(/statusBadgeColor\(order.status\)/g)).toHaveLength(1);
    expect(source).not.toContain('<ion-label>Activity</ion-label>');
    expect(source).not.toContain('<h2>Service context</h2>');
  });

  it('renders note titles and empty note text explicitly', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain("note.title || note.body || note.id || 'Note'");
    expect(source).toContain('No note text found');
  });

  it('uses item imagery with a fallback when order item image urls are unavailable', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('<ion-thumbnail slot="start"');
    expect(source).toContain('<DxpShopifyImg :src="item.imageUrl"');
  });

  it('does not mix shipment and ship group counts in the fulfillment summary', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('fulfillmentSummary');
    expect(source).toContain('orderShipments.value.length');
    expect(source).toContain('displayShipGroups.value.length');
    expect(source).not.toContain('shippingRecordCount');
    expect(source).not.toContain('shippingRecordCount }} shipping record');
  });

  it('summarizes fulfillment progress without echoing the order status', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('fulfillmentStatusSummary');
    expect(source).toContain('isItemShipped');
    expect(source).toContain('items shipped');
    expect(source).toContain('shipmentStatusLabel');
    expect(source).not.toContain('readableValue(order.fulfillmentStatus) || \'Unavailable\'');
  });

  it('shows one count for customer orders in the end slot', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('<h2>Orders last 30 days</h2>');
    expect(source).toContain('<ion-note slot="end">{{ customerOrdersLast30Days }}</ion-note>');
    expect(source).not.toContain('total order{{ customerOrderTotal === 1 ? \'\' : \'s\' }} found');
  });
});
