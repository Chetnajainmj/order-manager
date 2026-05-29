<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/orders" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ order?.id ?? 'Order' }}</ion-title>
        <ion-buttons v-if="order && orderActions.length" slot="end">
          <ion-button @click="openOrderActions">Actions</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-progress-bar v-if="orderStore.detailLoading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="order" class="order-detail-content">
      <div class="order-detail-shell">
        <section class="order-detail-header">
          <div class="order-detail-header-details">
          <ion-card>
        <ion-card-header class="card-header-grid">
          <ion-card-title>{{ order.externalId || order.id }}</ion-card-title>
          <ion-card-subtitle>{{ orderContext }}</ion-card-subtitle>
          <ion-note>{{ money(order.total, order.currency) }}</ion-note>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                <h2>{{ order.id }}</h2>
                <p>{{ orderDate }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>Fulfillment</h2>
                <p>{{ fulfillmentSummary }}</p>
              </ion-label>
              <ion-note slot="end">{{ fulfillmentStatusSummary }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>Payment</h2>
                <p>{{ order.payments?.length || 0 }} payment record{{ order.payments?.length === 1 ? '' : 's' }}</p>
              </ion-label>
              <ion-note slot="end">{{ readableValue(order.paymentStatus) || 'Unavailable' }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>Returns</h2>
                <p>Return records</p>
              </ion-label>
              <ion-note slot="end">{{ order.returnIds.length || orderReturns.length || 0 }}</ion-note>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

          </div>

          <aside class="order-detail-timeline">
            <ion-item lines="none">
              <ion-icon slot="start" :icon="timeOutline" />
              <ion-label>
                <h2>Order timeline</h2>
                <p>{{ orderTimeline.length }} event{{ orderTimeline.length === 1 ? '' : 's' }}</p>
              </ion-label>
              <ion-badge slot="end" :color="statusBadgeColor(order.status)">{{ readableValue(order.status) || 'Status unavailable' }}</ion-badge>
            </ion-item>

            <ion-list lines="full" class="order-timeline">
              <ion-item v-if="orderStore.detailSectionErrors.activity">
                <ion-label>{{ orderStore.detailSectionErrors.activity }}</ion-label>
              </ion-item>
              <ion-item v-for="(entry, index) in orderTimeline" :key="entry.id">
                <ion-icon :icon="timelineIcon(entry)" slot="start" />
                <ion-label>
                  <p>{{ timelineDelta(entry, index) }}</p>
                  <h2>{{ readableValue(entry.label) || entry.label }}</h2>
                  <p>{{ entry.detail }}</p>
                  <p v-if="timelineItemLabel(entry)">{{ timelineItemLabel(entry) }}</p>
                </ion-label>
                <ion-note slot="end">{{ formatDateTime(entry.at) }}</ion-note>
              </ion-item>
              <ion-item v-if="!orderTimeline.length && !orderStore.detailSectionErrors.activity">
                <ion-label>No timeline events found</ion-label>
              </ion-item>
            </ion-list>
          </aside>
        </section>

        <section class="order-detail-secondary">
          <ion-card>
        <ion-card-header class="card-header-grid">
          <ion-card-title>{{ customerProfile?.name || order.customerName || order.customerId || 'Customer' }}</ion-card-title>
          <ion-card-subtitle>{{ order.customerId || 'Customer unavailable' }}</ion-card-subtitle>
          <ion-button v-if="order.customerId" fill="clear" size="small" :router-link="`/customers/${order.customerId}`">Open details</ion-button>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                <h2>Orders last 30 days</h2>
              </ion-label>
              <ion-note slot="end">{{ customerOrdersLast30Days }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>Lifetime value</h2>
                <p>{{ customerLifetimeOrders }} lifetime order{{ customerLifetimeOrders === 1 ? '' : 's' }}</p>
              </ion-label>
              <ion-note slot="end">{{ money(customerLifetimeValue, order.currency) }}</ion-note>
            </ion-item>
            <ion-item v-for="contact in customerContactRows" :key="contact.label">
              <ion-label>
                <h2>{{ contact.label }}</h2>
                <p v-for="line in contact.lines" :key="line">{{ line }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!order.customerId && !customerContactRows.length">
              <ion-label>No contact information found</ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Payment, returns, and terms</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item-divider>
              <ion-label>Payments</ion-label>
              <ion-note slot="end">{{ order.payments?.length || 0 }}</ion-note>
            </ion-item-divider>
            <ion-item v-for="payment in order.payments" :key="payment.id || payment.status">
              <ion-label>
                <h2>{{ payment.method || 'Payment' }}</h2>
                <p>{{ money(payment.amount, order.currency) }} · {{ paymentCapturedLabel(payment) }}</p>
                <p v-if="payment.gatewayResponse || payment.id">{{ payment.gatewayResponse || payment.id }}</p>
              </ion-label>
              <ion-note slot="end">{{ readableValue(payment.status) || payment.status }}</ion-note>
            </ion-item>
            <ion-item v-if="!order.payments?.length">
              <ion-label>No payments found</ion-label>
            </ion-item>
            <ion-item-divider>
              <ion-label>Returns</ion-label>
              <ion-note slot="end">{{ orderReturns.length }}</ion-note>
            </ion-item-divider>
            <ion-item v-if="orderStore.detailSectionErrors.returns">
              <ion-label>{{ orderStore.detailSectionErrors.returns }}</ion-label>
            </ion-item>
            <ion-item v-for="returnRecord in orderReturns" :key="returnRecord.id" :router-link="`/returns/${returnRecord.id}`">
              <ion-label>
                <h2>{{ returnRecord.id }}</h2>
                <p>{{ returnRecord.reason }}</p>
              </ion-label>
              <ion-note slot="end">{{ returnRecord.status }}</ion-note>
            </ion-item>
            <ion-item v-if="!orderReturns.length && !orderStore.detailSectionErrors.returns">
              <ion-label>No returns found</ion-label>
            </ion-item>
            <ion-item-divider>
              <ion-label>Terms</ion-label>
              <ion-note slot="end">{{ order.terms?.length || 0 }}</ion-note>
            </ion-item-divider>
            <ion-item v-for="term in order.terms" :key="term.id || term.type">
              <ion-label>
                <h2>{{ term.type || 'Term' }}</h2>
                <p>{{ term.description || term.value }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!order.terms?.length">
              <ion-label>No terms found</ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
        </section>

        <section class="order-detail-wide-section">
          <ion-list v-if="orderStore.detailSectionErrors.shipments" lines="full">
            <ion-item v-if="orderStore.detailSectionErrors.shipments">
              <ion-label>{{ orderStore.detailSectionErrors.shipments }}</ion-label>
            </ion-item>
          </ion-list>
          <ion-card v-for="shipGroup in displayShipGroups" :key="shipGroup.id || shipGroup.shipmentId" class="order-detail-wide-card">
            <ion-card-header>
              <ion-card-subtitle>{{ shipGroup.id || 'Ship group' }}</ion-card-subtitle>
              <ion-card-title>{{ shipGroup.facilityName || shipGroup.facilityId || 'Facility unavailable' }}</ion-card-title>
            </ion-card-header>
            <ion-item lines="none">
              <ion-label>
                <p class="overline">details</p>
                <ion-chip
                  v-if="canUseShipGroupDatesAction(shipGroup)"
                  :outline="true"
                  @click="openShipGroupEditor(shipGroup, 'dates')"
                >
                  <ion-icon :icon="calendarOutline" />
                  <ion-label>shipping dates</ion-label>
                </ion-chip>
                <ion-chip
                  v-if="canUseShipGroupGiftAction(shipGroup)"
                  :outline="true"
                  @click="openShipGroupEditor(shipGroup, 'gift')"
                >
                  <ion-icon :icon="giftOutline" />
                  <ion-label>gift</ion-label>
                </ion-chip>
              </ion-label>
            </ion-item>
            <ion-card-content>
              <ion-list lines="full">
              <template v-if="canUseShipGroupRoutingAction(shipGroup)">
                <ion-item>
                  <ion-select
                    :value="shipGroup.shipmentMethodTypeId || ''"
                    label="Shipment method"
                    label-placement="stacked"
                    interface="popover"
                    placeholder="Select method"
                    @ionChange="updateShipGroupRoutingField(shipGroup, 'shipmentMethodTypeId', $event.detail.value)"
                  >
                    <ion-select-option v-if="!shipGroup.shipmentMethodTypeId" value="">Select method</ion-select-option>
                    <ion-select-option v-for="method in shipGroupMethodOptions" :key="method.id" :value="method.id">
                      {{ method.label }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select
                    :value="shipGroup.carrier || ''"
                    label="Carrier"
                    label-placement="stacked"
                    interface="popover"
                    placeholder="Select carrier"
                    @ionChange="updateShipGroupRoutingField(shipGroup, 'carrierPartyId', $event.detail.value)"
                  >
                    <ion-select-option v-if="!shipGroup.carrier" value="">Select carrier</ion-select-option>
                    <ion-select-option v-for="carrier in shipGroupCarrierOptions" :key="carrier.id" :value="carrier.id">
                      {{ carrier.label }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
              </template>
              <ion-item v-for="item in shipGroupItems(shipGroup)" :key="`${shipGroup.id}-${item.id}`">
                <ion-thumbnail slot="start" class="order-item-thumbnail">
                  <DxpShopifyImg :src="item.imageUrl" size="medium" />
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ item.name }}</h2>
                  <p>{{ item.sku }} · {{ readableValue(item.status) || item.status }}</p>
                  <p>Ordered {{ item.quantity }} · Shipped {{ item.shippedQuantity || 0 }} · Cancelled {{ item.cancelledQuantity || 0 }}</p>
                </ion-label>
                <ion-note slot="end">{{ money(item.unitPrice, order.currency) }}</ion-note>
                <ion-button v-if="hasItemActions(item)" slot="end" @click="openItemActions(item)">Actions</ion-button>
              </ion-item>
              <ion-item v-if="!shipGroupItems(shipGroup).length">
                <ion-label>No items found for this ship group</ion-label>
              </ion-item>
              <ion-item-divider v-if="shipGroupDetails(shipGroup).length">
                <ion-label>Ship group fields</ion-label>
              </ion-item-divider>
              <ion-item v-for="detail in shipGroupDetails(shipGroup)" :key="`${shipGroup.id}-${detail.label}`">
                <ion-label>{{ detail.label }}</ion-label>
                <ion-note slot="end">{{ detail.value }}</ion-note>
              </ion-item>
              <ion-item v-if="canUseShipGroupAction('allow-split', shipGroup)">
                <ion-toggle
                  :checked="shipGroup.maySplit === 'Y'"
                  @ionChange="updateShipGroupSplit(shipGroup, $event.detail.checked)"
                >
                  Allow split
                  <p>Items may ship separately when fulfillment needs it.</p>
                </ion-toggle>
              </ion-item>
              <ion-item-divider v-if="shipGroupQuickActions(shipGroup).length">
                <ion-label>Manage ship group</ion-label>
              </ion-item-divider>
              <ion-item
                v-for="shipGroupAction in shipGroupQuickActions(shipGroup)"
                :key="`${shipGroup.id}-${shipGroupAction.mode}`"
                button
                detail
                @click="openShipGroupEditor(shipGroup, shipGroupAction.mode)"
              >
                <ion-label>
                  <h2>{{ shipGroupAction.label }}</h2>
                  <p>{{ shipGroupAction.description }}</p>
                </ion-label>
              </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
          <ion-card v-if="orderShipments.length" class="order-detail-wide-card">
            <ion-card-header>
              <ion-card-subtitle>{{ orderShipments.length }} shipment{{ orderShipments.length === 1 ? '' : 's' }}</ion-card-subtitle>
              <ion-card-title>Shipments</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list lines="full">
            <ion-item v-for="shipment in orderShipments" :key="shipment.id" :router-link="`/shipments/${shipment.id}`">
              <ion-label>
                <h2>{{ shipment.id }}</h2>
                <p>{{ shipment.carrier }} {{ shipment.trackingCode }}</p>
                <p>{{ shipment.origin }} to {{ shipment.destination }}</p>
              </ion-label>
              <ion-note slot="end">{{ shipment.status }}</ion-note>
              <ion-button slot="end" @click.prevent="openShipmentDocumentActions(shipment)">Docs</ion-button>
            </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
          <ion-list v-if="!displayShipGroups.length && !orderShipments.length && !orderStore.detailSectionErrors.shipments" lines="full">
            <ion-item>
              <ion-label>No shipping records found</ion-label>
            </ion-item>
          </ion-list>
        </section>

        <section class="order-detail-secondary">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Notes</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item-divider>
              <ion-label>Notes</ion-label>
              <ion-note slot="end">{{ order.notes.length }}</ion-note>
            </ion-item-divider>
            <ion-item v-if="orderStore.detailSectionErrors.notes">
              <ion-label>{{ orderStore.detailSectionErrors.notes }}</ion-label>
            </ion-item>
            <ion-item v-for="note in order.notes" :key="note.id">
              <ion-label>
                <h2>{{ note.title || note.body || note.id || 'Note' }}</h2>
                <p>{{ note.author }}{{ note.createdAt ? ` · ${note.createdAt}` : '' }} · {{ note.internal ? 'Internal' : 'Customer-visible' }}</p>
                <p v-if="note.title && note.body">{{ note.body }}</p>
                <p v-else-if="!note.title && !note.body">No note text found</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!order.notes.length && !orderStore.detailSectionErrors.notes">
              <ion-label>No notes found</ion-label>
            </ion-item>
            <ion-item v-if="canUpdate">
              <ion-input v-model="noteName" label="Title" label-placement="stacked" />
            </ion-item>
            <ion-item v-if="canUpdate">
              <ion-textarea v-model="noteInfo" label="Note" label-placement="stacked" auto-grow />
            </ion-item>
            <ion-item v-if="canUpdate">
              <ion-toggle v-model="internalNote">Internal note</ion-toggle>
              <ion-button slot="end" :disabled="!noteInfo.trim()" @click="saveNote">Add</ion-button>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Communications</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item v-if="communicationActions.length">
              <ion-label>Communication actions</ion-label>
              <ion-button slot="end" @click="openCommunicationActions">Actions</ion-button>
            </ion-item>
            <ion-item v-if="orderStore.detailSectionErrors.communications">
              <ion-label>{{ orderStore.detailSectionErrors.communications }}</ion-label>
            </ion-item>
            <ion-item v-for="thread in communicationThreads" :key="thread.id">
              <ion-label>
                <h2>{{ thread.subject }}</h2>
                <p>{{ thread.events.length }} event{{ thread.events.length === 1 ? '' : 's' }} · {{ readableValue(thread.latest.type || thread.latest.typeId) }}</p>
                <p>{{ communicationPreview(thread.latest) }}</p>
              </ion-label>
              <ion-note slot="end">{{ readableValue(thread.latest.status || thread.latest.statusId) }}</ion-note>
            </ion-item>
            <ion-item v-if="!communicationThreads.length && !orderStore.detailSectionErrors.communications">
              <ion-label>No communications found</ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
        </section>

        <ion-card class="order-detail-wide-card">
        <ion-card-header>
          <ion-card-title>Additional order data</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-accordion-group>
            <ion-accordion value="roles">
              <ion-item slot="header">
                <ion-label>Order roles</ion-label>
                <ion-note slot="end">{{ order.roles?.length || 0 }}</ion-note>
              </ion-item>
              <ion-list slot="content">
                <ion-item v-if="orderStore.detailSectionErrors.roles">
                  <ion-label>{{ orderStore.detailSectionErrors.roles }}</ion-label>
                </ion-item>
                <ion-item v-for="role in order.roles" :key="`${role.partyId}-${role.roleTypeId}`">
                  <ion-label>
                    <h2>{{ role.roleTypeId }}</h2>
                    <p>{{ role.name || role.partyId }}</p>
                  </ion-label>
                </ion-item>
                <ion-item v-if="!order.roles?.length && !orderStore.detailSectionErrors.roles">
                  <ion-label>No roles found</ion-label>
                </ion-item>
              </ion-list>
            </ion-accordion>
            <ion-accordion value="attributes">
              <ion-item slot="header">
                <ion-label>Attributes</ion-label>
                <ion-note slot="end">{{ order.attributes?.length || 0 }}</ion-note>
              </ion-item>
              <ion-list slot="content">
                <ion-item v-if="orderStore.detailSectionErrors.attributes">
                  <ion-label>{{ orderStore.detailSectionErrors.attributes }}</ion-label>
                </ion-item>
                <ion-item v-for="attribute in order.attributes" :key="attribute.name">
                  <ion-label>{{ attribute.name }}</ion-label>
                  <ion-note slot="end">{{ attribute.value }}</ion-note>
                </ion-item>
                <ion-item v-if="!order.attributes?.length && !orderStore.detailSectionErrors.attributes">
                  <ion-label>No attributes found</ion-label>
                </ion-item>
              </ion-list>
            </ion-accordion>
            <ion-accordion value="transitions">
              <ion-item slot="header">
                <ion-label>Transitions</ion-label>
                <ion-note slot="end">{{ transitionCount }}</ion-note>
              </ion-item>
              <ion-list slot="content">
                <ion-item v-for="item in itemsWithTransitions" :key="item.item.id">
                  <ion-label>
                    <h2>{{ item.item.name }}</h2>
                    <p>{{ item.item.status }}</p>
                  </ion-label>
                  <ion-buttons v-if="canUpdate" slot="end">
                    <ion-button
                      v-for="transition in item.transitions"
                      :key="transition.toStatusId"
                      @click="changeItemStatus(item.item.id, transition.toStatusId)"
                    >
                      {{ transition.toStatusDescription || transition.toStatusId }}
                    </ion-button>
                  </ion-buttons>
                </ion-item>
                <ion-item v-if="!transitionCount">
                  <ion-label>No transitions found</ion-label>
                </ion-item>
              </ion-list>
            </ion-accordion>
          </ion-accordion-group>
        </ion-card-content>
      </ion-card>
      </div>

      <ion-modal :is-open="Boolean(shipGroupEditorMode)" @didDismiss="closeShipGroupEditor">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closeShipGroupEditor">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
            <ion-title>{{ shipGroupEditorTitle }}</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list v-if="shipGroupEditorMode === 'instructions'" lines="full">
            <ion-item>
              <ion-textarea
                v-model="shipGroupInstructionDraft"
                label="Shipping instructions"
                label-placement="stacked"
                auto-grow
                placeholder="Example: Leave at receiving desk, include packing note, hold for customer pickup"
              />
            </ion-item>
          </ion-list>

          <ion-list v-else-if="shipGroupEditorMode === 'gift'" lines="full">
            <ion-item>
              <ion-toggle v-model="shipGroupIsGiftDraft">Gift order</ion-toggle>
            </ion-item>
            <ion-item>
              <ion-textarea
                v-model="shipGroupGiftMessageDraft"
                label="Gift message"
                label-placement="stacked"
                auto-grow
                placeholder="Message to include with the shipment"
              />
            </ion-item>
          </ion-list>

          <ion-list v-else-if="shipGroupEditorMode === 'dates'" lines="full">
            <ion-item>
              <ion-input v-model="shipGroupShipAfterDraft" label="Ship after" label-placement="stacked" type="date" :min="todayDate" />
            </ion-item>
            <ion-item>
              <ion-input v-model="shipGroupShipByDraft" label="Ship by" label-placement="stacked" type="date" :min="shipGroupShipAfterDraft || todayDate" />
            </ion-item>
          </ion-list>

          <ion-list v-else-if="shipGroupEditorMode === 'shipToStore'" lines="full">
            <ion-item>
              <ion-select v-model="shipGroupStoreFacilityDraft" label="Store facility" label-placement="stacked" interface="popover">
                <ion-select-option value="">Select a store facility</ion-select-option>
                <ion-select-option v-for="facility in shipGroupFacilityOptions" :key="facility.id" :value="facility.id">
                  {{ facility.label }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </ion-list>

          <ion-fab vertical="bottom" horizontal="end" slot="fixed">
            <ion-fab-button @click="saveShipGroupEditor">
              <ion-icon :icon="saveOutline" />
            </ion-fab-button>
          </ion-fab>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="communicationComposerOpen" @didDismiss="closeCommunicationComposer">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closeCommunicationComposer">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
            <ion-title>Communication event</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list lines="full">
            <ion-item>
              <ion-segment v-model="communicationEventIntent">
                <ion-segment-button value="log">
                  <ion-label>Log</ion-label>
                </ion-segment-button>
                <ion-segment-button value="send">
                  <ion-label>Send</ion-label>
                </ion-segment-button>
                <ion-segment-button value="draft">
                  <ion-label>Draft</ion-label>
                </ion-segment-button>
              </ion-segment>
            </ion-item>
            <ion-item>
              <ion-select v-model="communicationEventTypeIdDraft" label="Type" label-placement="stacked" interface="popover">
                <ion-select-option v-for="type in communicationEventTypeOptions" :key="type.id" :value="type.id">
                  {{ type.label }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select v-model="communicationParentEventIdDraft" label="Thread" label-placement="stacked" interface="popover">
                <ion-select-option value="">New conversation</ion-select-option>
                <ion-select-option v-for="thread in communicationThreads" :key="thread.id" :value="thread.id">
                  {{ thread.subject }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select v-model="communicationPartyFromDraft" label="From party" label-placement="stacked" interface="popover">
                <ion-select-option v-for="party in communicationPartyOptions" :key="`from-${party.id}`" :value="party.id">
                  {{ party.label }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select v-model="communicationPartyToDraft" label="To party" label-placement="stacked" interface="popover">
                <ion-select-option value="">No party selected</ion-select-option>
                <ion-select-option v-for="party in communicationPartyOptions" :key="`to-${party.id}`" :value="party.id">
                  {{ party.label }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-input v-model="communicationSubjectDraft" label="Subject" label-placement="stacked" />
            </ion-item>
            <ion-item>
              <ion-textarea v-model="communicationContentDraft" label="Content" label-placement="stacked" auto-grow />
            </ion-item>
            <ion-accordion-group>
              <ion-accordion value="advanced-communication">
                <ion-item slot="header">
                  <ion-label>Advanced model fields</ion-label>
                </ion-item>
                <ion-list slot="content" lines="full">
                  <ion-item>
                    <ion-select v-model="communicationStatusIdDraft" label="Status" label-placement="stacked" interface="popover">
                      <ion-select-option v-for="status in communicationStatusOptions" :key="status.id" :value="status.id">
                        {{ status.label }}
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item>
                    <ion-select v-model="communicationActionDraft" label="Action" label-placement="stacked" interface="popover">
                      <ion-select-option value="">None</ion-select-option>
                      <ion-select-option value="REPLY">Reply</ion-select-option>
                      <ion-select-option value="REPLYALL">Reply all</ion-select-option>
                      <ion-select-option value="FORWARD">Forward</ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item>
                    <ion-select v-model="communicationContactMechTypeIdDraft" label="Contact mechanism type" label-placement="stacked" interface="popover">
                      <ion-select-option v-for="type in communicationContactMechTypeOptions" :key="type.id" :value="type.id">
                        {{ type.label }}
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationDatetimeStartedDraft" label="Started" label-placement="stacked" type="datetime-local" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationDatetimeEndedDraft" label="Ended" label-placement="stacked" type="datetime-local" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationContactMechFromDraft" label="From contactMechId" label-placement="stacked" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationContactMechToDraft" label="To contactMechId" label-placement="stacked" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationRoleFromDraft" label="From roleTypeId" label-placement="stacked" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationRoleToDraft" label="To roleTypeId" label-placement="stacked" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationMessageIdDraft" label="Message ID" label-placement="stacked" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="communicationExternalIdDraft" label="External ID" label-placement="stacked" />
                  </ion-item>
                </ion-list>
              </ion-accordion>
            </ion-accordion-group>
          </ion-list>

          <ion-fab vertical="bottom" horizontal="end" slot="fixed">
            <ion-fab-button :disabled="!communicationContentDraft.trim()" @click="saveCommunicationEvent">
              <ion-icon :icon="saveOutline" />
            </ion-fab-button>
          </ion-fab>
        </ion-content>
      </ion-modal>
    </ion-content>

    <ion-content v-else-if="orderStore.detailLoading">
      <ion-list>
        <ion-item>
          <ion-label>Loading order</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="orderStore.detailError">
      <ErrorState
        title="Order failed to load"
        :message="orderStore.detailError"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        title="Order not found"
        message="The selected order is not available in this workspace."
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonMenuButton,
  IonModal,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
  IonThumbnail,
  IonTitle,
  IonToggle,
  IonToolbar,
  actionSheetController,
  alertController
} from '@ionic/vue';
import {
  alertCircleOutline,
  calendarOutline,
  checkmarkDoneOutline,
  closeOutline,
  cubeOutline,
  downloadOutline,
  giftOutline,
  saveOutline,
  sunnyOutline,
  timeOutline
} from 'ionicons/icons';
import { commonUtil, DxpShopifyImg } from '@common';
import { useOrderStore } from '@/store/orders';
import { useCustomerStore } from '@/store/customers';
import { useUserStore } from '@/store/user';
import { useCustomerServiceStore } from '@/store/customerService';
import { useUtilStore } from '@/store/util';
import {
  getCallableOrderActionsByGroup,
  legacySalesOrderActions
} from '@/services/orderActions';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import { showToast } from '@/utils';
import type { CommunicationEvent, Order, OrderItem, OrderStatusChange, PaymentPreference, ShipGroupUpdatePayload, Shipment } from '@/types/order';
import type { CommunicationEventPayload } from '@/services/order';

type DisplayShipGroup = NonNullable<Order['shipGroups']>[number] & { isUnassigned?: boolean };
type ActionSheetButton = { text: string; role?: string; handler?: () => void };
type ShipGroupEditorMode = '' | 'instructions' | 'gift' | 'dates' | 'shipToStore';
type SelectOption = { id: string; label: string };
type CommunicationThread = { id: string; subject: string; latest: CommunicationEvent; events: CommunicationEvent[] };
type CommunicationIntent = 'log' | 'send' | 'draft';

const props = defineProps<{
  orderId: string;
}>();

const orderStore = useOrderStore();
const customerStore = useCustomerStore();
const userStore = useUserStore();
const customerServiceStore = useCustomerServiceStore();
const utilStore = useUtilStore();
const noteName = ref('');
const noteInfo = ref('');
const internalNote = ref(true);
const shipGroupEditorMode = ref<ShipGroupEditorMode>('');
const activeShipGroup = ref<DisplayShipGroup>();
const shipGroupInstructionDraft = ref('');
const shipGroupGiftMessageDraft = ref('');
const shipGroupIsGiftDraft = ref(false);
const shipGroupShipAfterDraft = ref('');
const shipGroupShipByDraft = ref('');
const shipGroupStoreFacilityDraft = ref('');
const communicationComposerOpen = ref(false);
const communicationEventIntent = ref<CommunicationIntent>('log');
const communicationEventTypeIdDraft = ref('EMAIL_COMMUNICATION');
const communicationParentEventIdDraft = ref('');
const communicationPartyFromDraft = ref('');
const communicationPartyToDraft = ref('');
const communicationSubjectDraft = ref('');
const communicationContentDraft = ref('');
const communicationStatusIdDraft = ref('COM_COMPLETE');
const communicationActionDraft = ref<CommunicationEventPayload['action']>('');
const communicationContactMechTypeIdDraft = ref('EMAIL_ADDRESS');
const communicationDatetimeStartedDraft = ref('');
const communicationDatetimeEndedDraft = ref('');
const communicationContactMechFromDraft = ref('');
const communicationContactMechToDraft = ref('');
const communicationRoleFromDraft = ref('ORIGINATOR');
const communicationRoleToDraft = ref('ADDRESSEE');
const communicationMessageIdDraft = ref('');
const communicationExternalIdDraft = ref('');

const order = computed(() => orderStore.getOrder(props.orderId));
const orderShipments = computed(() => orderStore.getOrderShipments(order.value?.id || props.orderId));
const orderReturns = computed(() => orderStore.getOrderReturns(order.value?.id || props.orderId));
const customerProfile = computed(() => order.value?.customerId ? customerStore.getCustomer(order.value.customerId) : undefined);
const customerOrders = computed(() => order.value?.customerId ? customerStore.getCustomerOrders(order.value.customerId) : []);
const customerOrderTotal = computed(() => order.value?.customerId ? customerStore.orderTotalsByCustomer[order.value.customerId] || customerOrders.value.length : 0);
const canUpdate = computed(() => userStore.hasPermission('ORDERMGR_UPDATE OR ORD_SALES_ORDER_EDIT OR ORD_SALES_ORDER_ADMIN OR ORDERMGR_ADMIN'));
const canSendEmail = computed(() => userStore.hasPermission('ORDERMGR_SEND_CONFIRMATION OR COMM_EVNT_MENU_VIEW OR ORD_SALES_ORDER_ADMIN OR ORDERMGR_ADMIN'));
const actionContext = computed(() => ({
  permissions: userStore.getPermissions,
  orderStatus: order.value?.status
}));
const orderActions = computed(() => [
  ...getCallableOrderActionsByGroup('fulfillment', actionContext.value),
  ...getCallableOrderActionsByGroup('communications', actionContext.value),
]);
const communicationActions = computed(() => getCallableOrderActionsByGroup('communications', actionContext.value));
const itemsWithTransitions = computed(() => (order.value?.items || []).map((item) => ({
  item,
  transitions: utilStore.getAllowedTransitions(item.status)
})).filter((entry) => entry.transitions.length));
const transitionCount = computed(() => itemsWithTransitions.value.reduce((count, entry) => count + entry.transitions.length, 0));
const orderDate = computed(() => formatDateTime(order.value?.orderDate || order.value?.entryDate));
const orderTimeline = computed(() => {
  return [...(order.value?.history || [])].sort((first, second) => timelineTime(first.at) - timelineTime(second.at));
});
const displayShipGroups = computed<DisplayShipGroup[]>(() => {
  if (!order.value) return [];

  const shipGroups = [...(order.value.shipGroups || [])] as DisplayShipGroup[];
  const groupedItemIds = new Set(shipGroups.flatMap((shipGroup) => {
    return order.value?.items.filter((item) => item.shipGroupSeqId === shipGroup.id).map((item) => item.id) || [];
  }));
  const unassignedItems = order.value.items.filter((item) => !groupedItemIds.has(item.id));

  if (unassignedItems.length) {
    shipGroups.push({
      id: 'unassigned',
      method: 'Unassigned items',
      status: order.value.fulfillmentStatus,
      facilityName: 'Facility unavailable',
      isUnassigned: true
    } as DisplayShipGroup);
  }

  return shipGroups;
});
const fulfillmentSummary = computed(() => {
  if (orderShipments.value.length) {
    return `${orderShipments.value.length} shipment${orderShipments.value.length === 1 ? '' : 's'}`;
  }

  if (displayShipGroups.value.length) {
    return `${displayShipGroups.value.length} ship group${displayShipGroups.value.length === 1 ? '' : 's'}`;
  }

  return 'No shipping data';
});
const fulfillmentStatusSummary = computed(() => {
  const items = order.value?.items || [];
  const shippedItemCount = items.filter(isItemShipped).length;

  if (items.length && shippedItemCount > 0) {
    return `${shippedItemCount}/${items.length} items shipped`;
  }

  const latestShipment = [...orderShipments.value]
    .sort((first, second) => timelineTime(second.shipDate || second.estimatedShipDate || second.createdDate) - timelineTime(first.shipDate || first.estimatedShipDate || first.createdDate))[0];

  if (latestShipment) {
    return shipmentStatusLabel(latestShipment);
  }

  const activeShipGroup = displayShipGroups.value.find((shipGroup) => shipGroup.status && !shipGroup.isUnassigned);
  return readableValue(activeShipGroup?.status) || 'Unavailable';
});
const orderContext = computed(() => {
  const channel = readableValue(order.value?.channel || order.value?.productStoreId) || 'Sales order';
  const priority = order.value?.priority && order.value.priority !== order.value.status ? readableValue(order.value.priority) : '';

  return [channel, priority].filter(Boolean).join(' · ');
});
const customerContactRows = computed(() => {
  const rows = customerProfile.value?.addresses?.length ? customerProfile.value.addresses : order.value?.contactInfo || [];
  const customerName = customerProfile.value?.name || order.value?.customerName || '';

  return rows.filter((contact) => {
    const meaningfulLines = contact.lines.filter((line) => line && line !== customerName);

    return meaningfulLines.length;
  });
});
const customerOrdersLast30Days = computed(() => {
  const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return customerOrders.value.filter((customerOrder) => timelineTime(customerOrder.orderDate || customerOrder.entryDate) >= startTime).length;
});
const customerLifetimeOrders = computed(() => customerProfile.value?.lifetimeOrders || customerOrderTotal.value || customerOrders.value.length);
const customerLifetimeValue = computed(() => {
  if (customerProfile.value?.lifetimeValue) return customerProfile.value.lifetimeValue;

  return customerOrders.value.reduce((total, customerOrder) => total + customerOrder.total, 0);
});
const shipGroupEditorTitle = computed(() => {
  if (shipGroupEditorMode.value === 'instructions') return 'Shipping instructions';
  if (shipGroupEditorMode.value === 'gift') return 'Gift details';
  if (shipGroupEditorMode.value === 'dates') return 'Ship dates';
  if (shipGroupEditorMode.value === 'shipToStore') return 'Ship to store';
  return 'Ship group';
});
const todayDate = ref(dateInputValue(new Date().toISOString()));
const shipGroupMethodOptions = computed(() => selectOptions([
  ...(activeShipGroup.value?.shipmentMethodTypeId ? [{ id: activeShipGroup.value.shipmentMethodTypeId, label: activeShipGroup.value.method || activeShipGroup.value.shipmentMethodTypeId }] : []),
  ...displayShipGroups.value
    .filter((shipGroup) => shipGroup.shipmentMethodTypeId)
    .map((shipGroup) => ({ id: shipGroup.shipmentMethodTypeId || '', label: shipGroup.method || shipGroup.shipmentMethodTypeId || '' })),
  ...customerServiceStore.orders.map((workflowOrder) => ({
    id: workflowOrder.shippingMethodTypeId,
    label: workflowOrder.shipmentMethodDesc || readableValue(workflowOrder.shippingMethodTypeId)
  }))
]));
const shipGroupCarrierOptions = computed(() => selectOptions([
  ...(activeShipGroup.value?.carrier ? [{ id: activeShipGroup.value.carrier, label: activeShipGroup.value.carrier }] : []),
  ...displayShipGroups.value.map((shipGroup) => ({ id: shipGroup.carrier, label: shipGroup.carrier })),
  ...orderShipments.value.map((shipment) => ({ id: shipment.carrier, label: shipment.carrier }))
]));
const shipGroupFacilityOptions = computed(() => selectOptions([
  ...(activeShipGroup.value?.facilityId ? [{ id: activeShipGroup.value.facilityId, label: activeShipGroup.value.facilityName || activeShipGroup.value.facilityId }] : []),
  ...displayShipGroups.value.map((shipGroup) => ({ id: shipGroup.facilityId, label: shipGroup.facilityName || shipGroup.facilityId })),
  ...customerServiceStore.facilities.map((facility) => ({ id: facility.id, label: facility.name || facility.id }))
]));
const communicationThreads = computed<CommunicationThread[]>(() => {
  const events = [...(order.value?.communicationEvents || [])].sort((first, second) => timelineTime(first.entryDate || first.datetimeStarted) - timelineTime(second.entryDate || second.datetimeStarted));
  const threadById = new Map<string, CommunicationThread>();

  events.forEach((event) => {
    const threadId = event.parentCommEventId || event.origCommEventId || event.id;
    const existingThread = threadById.get(threadId);

    if (existingThread) {
      existingThread.events.push(event);
      existingThread.latest = event;
      if (!existingThread.subject && event.subject) existingThread.subject = event.subject;
      return;
    }

    threadById.set(threadId, {
      id: threadId,
      subject: event.subject || readableValue(event.type || event.typeId) || event.id,
      latest: event,
      events: [event]
    });
  });

  return [...threadById.values()].sort((first, second) => timelineTime(second.latest.entryDate || second.latest.datetimeStarted) - timelineTime(first.latest.entryDate || first.latest.datetimeStarted));
});
const communicationEventTypeOptions = computed(() => selectOptions([
  { id: 'EMAIL_COMMUNICATION', label: 'Email' },
  { id: 'EXT_EMAIL_COMM', label: 'External email' },
  { id: 'PHONE_COMMUNICATION', label: 'Phone call' },
  { id: 'CHAT_COMMUNICATION', label: 'Chat' },
  { id: 'COMMENT_NOTE', label: 'Internal comment' },
  { id: 'ORDER_NOTE', label: 'Order note' },
  { id: 'API_COMMUNICATION', label: 'API communication' }
]));
const communicationStatusOptions = computed(() => selectOptions([
  { id: 'COM_ENTERED', label: 'Entered' },
  { id: 'COM_PENDING', label: 'Pending' },
  { id: 'COM_IN_PROGRESS', label: 'In progress' },
  { id: 'COM_COMPLETE', label: 'Closed' },
  { id: 'COM_RESOLVED', label: 'Resolved' },
  { id: 'COM_REFERRED', label: 'Referred' },
  { id: 'COM_BOUNCED', label: 'Bounced' },
  { id: 'COM_UNKNOWN_PARTY', label: 'Unknown party' },
  { id: 'COM_CANCELLED', label: 'Cancelled' }
]));
const communicationContactMechTypeOptions = computed(() => selectOptions([
  { id: 'EMAIL_ADDRESS', label: 'Email address' },
  { id: 'TELECOM_NUMBER', label: 'Phone number' },
  { id: 'WEB_ADDRESS', label: 'Web address' },
  { id: 'POSTAL_ADDRESS', label: 'Postal address' },
  { id: 'INTERNAL_PARTYID', label: 'Internal party' }
]));
const communicationPartyOptions = computed(() => selectOptions([
  ...(userStore.getUserProfile?.partyId ? [{ id: userStore.getUserProfile.partyId, label: userStore.getUserProfile.partyName || userStore.getUserProfile.userId || 'Current user' }] : []),
  ...(order.value?.customerId ? [{ id: order.value.customerId, label: order.value.customerName || customerProfile.value?.name || order.value.customerId }] : []),
  ...(order.value?.roles || []).map((role) => ({
    id: role.partyId,
    label: [role.name || role.partyId, readableValue(role.roleTypeId)].filter(Boolean).join(' · ')
  }))
]));
onMounted(loadOrder);

watch(() => props.orderId, loadOrder);
watch(communicationEventIntent, (intent) => {
  if (intent === 'send') communicationStatusIdDraft.value = 'COM_IN_PROGRESS';
  else if (intent === 'draft') communicationStatusIdDraft.value = 'COM_PENDING';
  else communicationStatusIdDraft.value = 'COM_COMPLETE';
});
watch(communicationEventTypeIdDraft, (typeId) => {
  if (typeId === 'PHONE_COMMUNICATION') communicationContactMechTypeIdDraft.value = 'TELECOM_NUMBER';
  else if (typeId === 'CHAT_COMMUNICATION' || typeId === 'COMMENT_NOTE' || typeId === 'ORDER_NOTE' || typeId === 'API_COMMUNICATION') communicationContactMechTypeIdDraft.value = 'INTERNAL_PARTYID';
  else communicationContactMechTypeIdDraft.value = 'EMAIL_ADDRESS';
});

async function loadOrder() {
  await Promise.allSettled([
    orderStore.loadOrder(props.orderId),
    utilStore.fetchStatusFlowTransitions()
  ]);

  if (order.value?.customerId) {
    await customerStore.loadCustomer(order.value.customerId).catch(() => undefined);
  }
}

async function saveNote() {
  if (!order.value || !canUpdate.value || !noteInfo.value.trim()) return;

  await orderStore.addOrderNote(order.value.id, {
    noteName: noteName.value,
    noteInfo: noteInfo.value.trim(),
    internalNote: internalNote.value
  });
  noteName.value = '';
  noteInfo.value = '';
  internalNote.value = true;
  await showToast('Note added');
}

async function sendEmail(emailType: 'PRDS_ODR_CONFIRM' | 'PRDS_ODR_COMPLETE') {
  if (!order.value || !canSendEmail.value) return;

  await runAction(() => orderStore.sendOrderEmail(order.value!.id, emailType), 'Email request sent');
}

async function changeItemStatus(orderItemSeqId: string, statusId: string) {
  if (!order.value || !canUpdate.value) return;

  await orderStore.changeOrderItemStatus(order.value.id, orderItemSeqId, statusId);
  await showToast('Item status updated');
}

async function openOrderActions() {
  if (!order.value) return;

  await presentActionSheet('Order actions', [
    actionButton('reserve-soft-allocations', () => runAction(() => orderStore.reserveSoftAllocatedInventory(order.value!.id), 'Soft allocations reserved')),
    actionButton('allocate-order', () => openInventoryAction('Allocate order', (payload) => orderStore.processOrderFacilityAllocation(order.value!.id, payload))),
    actionButton('ship-to-store', openShipToStoreAction),
    actionButton('send-order-email', openEmailActions),
    actionButton('pickup-scheduled-notification', () => runAction(() => orderStore.sendPickupScheduledNotification(order.value!.id), 'Pickup scheduled notification sent')),
    actionButton('pickup-ready-notification', () => runAction(() => orderStore.sendPickupNotification(order.value!.id), 'Pickup notification sent')),
  ]);
}

async function openItemActions(item: OrderItem) {
  if (!order.value) return;

  await presentActionSheet(item.name, getItemActionButtons(item));
}

function openShipGroupEditor(shipGroup: DisplayShipGroup, mode: ShipGroupEditorMode) {
  activeShipGroup.value = shipGroup;
  shipGroupEditorMode.value = mode;
  shipGroupInstructionDraft.value = shipGroup.shippingInstructions || '';
  shipGroupGiftMessageDraft.value = shipGroup.giftMessage || '';
  shipGroupIsGiftDraft.value = shipGroup.isGift === 'Y';
  shipGroupShipAfterDraft.value = dateInputValue(shipGroup.shipAfterDate);
  shipGroupShipByDraft.value = dateInputValue(shipGroup.shipByDate);
  shipGroupStoreFacilityDraft.value = '';
}

function openShipGroupActions(shipGroup: DisplayShipGroup) {
  openShipGroupEditor(shipGroup, 'dates');
}

function closeShipGroupEditor() {
  shipGroupEditorMode.value = '';
  activeShipGroup.value = undefined;
}

async function saveShipGroupEditor() {
  if (!order.value || !activeShipGroup.value?.id || !shipGroupEditorMode.value) return;

  const shipGroup = activeShipGroup.value;
  const mode = shipGroupEditorMode.value;
  let payload: ShipGroupUpdatePayload = {};
  let successMessage = 'Ship group updated';

  if (mode === 'instructions') {
    payload = { shippingInstructions: shipGroupInstructionDraft.value.trim() };
    successMessage = 'Shipping instructions updated';
  } else if (mode === 'gift') {
    payload = {
      giftMessage: shipGroupGiftMessageDraft.value.trim(),
      isGift: shipGroupIsGiftDraft.value ? 'Y' : 'N'
    };
    successMessage = 'Gift details updated';
  } else if (mode === 'dates') {
    payload = {
      shipAfterDate: datePayloadValue(shipGroupShipAfterDraft.value),
      shipByDate: datePayloadValue(shipGroupShipByDraft.value)
    };
    successMessage = 'Ship dates updated';
  } else if (mode === 'shipToStore') {
    const facilityId = shipGroupStoreFacilityDraft.value.trim();
    if (!facilityId) {
      await showToast('Store facility is required');
      return;
    }

    await runAction(() => orderStore.convertOrderShipToStore(order.value!.id, {
      shipGroupSeqId: shipGroup.id,
      facilityId
    }), 'Ship-to-store conversion submitted');
    closeShipGroupEditor();
    return;
  }

  await runAction(() => orderStore.updateOrderShipGroup(order.value!.id, shipGroup.id, payload), successMessage);
  closeShipGroupEditor();
}

async function updateShipGroupSplit(shipGroup: DisplayShipGroup, checked: boolean) {
  if (!order.value || !shipGroup.id || !canUseShipGroupAction('allow-split', shipGroup)) return;

  await runAction(() => orderStore.updateOrderShipGroup(order.value!.id, shipGroup.id, { maySplit: checked ? 'Y' : 'N' }), checked ? 'Split allowed' : 'Split disabled');
}

async function updateShipGroupRoutingField(shipGroup: DisplayShipGroup, fieldName: 'shipmentMethodTypeId' | 'carrierPartyId', value?: string) {
  if (!order.value || !shipGroup.id || !value || !canUseShipGroupRoutingAction(shipGroup)) return;

  await runAction(() => orderStore.updateOrderShipGroup(order.value!.id, shipGroup.id, { [fieldName]: value }), 'Routing updated');
}

function hasItemActions(item: OrderItem) {
  return getItemActionButtons(item).length > 0;
}

function getItemActionButtons(item: OrderItem) {
  const transitionButtons = canUpdate.value
    ? utilStore.getAllowedTransitions(item.status).map((transition) => ({
      text: transition.toStatusDescription || transition.toStatusId,
      handler: () => changeItemStatus(item.id, transition.toStatusId)
    }))
    : [];

  return availableActionButtons([
    actionButton('update-item', () => openUpdateItemAction(item)),
    actionButton('cancel-item', () => openReasonAction('Cancel item', 'Cancellation reason', (reason) => orderStore.cancelOrderItem(order.value!.id, item.id, reason))),
    actionButton('reject-item', () => openReasonAction('Reject item', 'Rejection reason', (reason) => orderStore.rejectOrderItem(order.value!.id, item.id, reason))),
    actionButton('reserve-item-inventory', () => openInventoryAction('Reserve inventory', (payload) => orderStore.createOrderItemReservation(order.value!.id, item.id, payload))),
    actionButton('cancel-item-reservation', () => openQuantityAction('Cancel reservation', (quantity) => orderStore.cancelOrderItemReservation(order.value!.id, item.id, quantity))),
    actionButton('allocate-item', () => openInventoryAction('Allocate item', (payload) => orderStore.processOrderItemAllocation(order.value!.id, item.id, payload))),
    actionButton('delete-item', () => confirmAction('Delete item', 'Delete this item from the order?', () => orderStore.deleteOrderItem(order.value!.id, item.id))),
    ...transitionButtons
  ]);
}

function canUseShipGroupAction(actionId: string, shipGroup: DisplayShipGroup) {
  return Boolean(!shipGroup.isUnassigned && shipGroup.id && actionAvailable(actionId));
}

function canUseShipGroupDatesAction(shipGroup: DisplayShipGroup) {
  return canUseShipGroupAction('update-ship-by-date', shipGroup) || canUseShipGroupAction('update-ship-after-date', shipGroup);
}

function canUseShipGroupGiftAction(shipGroup: DisplayShipGroup) {
  return canUseShipGroupAction('set-gift-message', shipGroup);
}

function canUseShipGroupRoutingAction(shipGroup: DisplayShipGroup) {
  return canUseShipGroupAction('update-ship-group', shipGroup);
}

function shipGroupQuickActions(shipGroup: DisplayShipGroup) {
  return [
    {
      actionId: 'set-shipping-instructions',
      label: shipGroup.shippingInstructions ? 'Edit instructions' : 'Instructions',
      description: shipGroup.shippingInstructions ? 'Update warehouse handling notes.' : 'Add warehouse handling notes.',
      mode: 'instructions' as ShipGroupEditorMode
    },
    {
      actionId: 'ship-to-store',
      label: 'Ship to store',
      description: 'Route this group through a store facility.',
      mode: 'shipToStore' as ShipGroupEditorMode
    }
  ].filter((entry) => canUseShipGroupAction(entry.actionId, shipGroup));
}

async function openCommunicationActions() {
  await presentActionSheet('Communication actions', [
    { text: 'Custom communication', handler: openCommunicationComposer },
    actionButton('send-order-email', openEmailActions),
    actionButton('pickup-scheduled-notification', () => runAction(() => orderStore.sendPickupScheduledNotification(order.value!.id), 'Pickup scheduled notification sent')),
    actionButton('pickup-ready-notification', () => runAction(() => orderStore.sendPickupNotification(order.value!.id), 'Pickup notification sent')),
  ]);
}

function openCommunicationComposer() {
  const currentUserPartyId = userStore.getUserProfile?.partyId || '';
  const customerPartyId = order.value?.customerId || '';

  communicationComposerOpen.value = true;
  communicationEventIntent.value = 'log';
  communicationEventTypeIdDraft.value = 'EMAIL_COMMUNICATION';
  communicationParentEventIdDraft.value = '';
  communicationPartyFromDraft.value = currentUserPartyId;
  communicationPartyToDraft.value = customerPartyId;
  communicationSubjectDraft.value = order.value ? `Order ${order.value.id}` : '';
  communicationContentDraft.value = '';
  communicationStatusIdDraft.value = 'COM_COMPLETE';
  communicationActionDraft.value = '';
  communicationContactMechTypeIdDraft.value = 'EMAIL_ADDRESS';
  communicationDatetimeStartedDraft.value = dateTimeInputValue(new Date().toISOString());
  communicationDatetimeEndedDraft.value = '';
  communicationContactMechFromDraft.value = '';
  communicationContactMechToDraft.value = '';
  communicationRoleFromDraft.value = 'ORIGINATOR';
  communicationRoleToDraft.value = 'ADDRESSEE';
  communicationMessageIdDraft.value = '';
  communicationExternalIdDraft.value = '';
}

function closeCommunicationComposer() {
  communicationComposerOpen.value = false;
}

async function saveCommunicationEvent() {
  if (!order.value || !communicationContentDraft.value.trim()) return;

  const payload = compactPayload({
    communicationEventTypeId: communicationEventTypeIdDraft.value,
    parentCommEventId: communicationParentEventIdDraft.value,
    statusId: communicationStatusIdDraft.value,
    contactMechTypeId: communicationContactMechTypeIdDraft.value,
    contactMechIdFrom: communicationContactMechFromDraft.value,
    contactMechIdTo: communicationContactMechToDraft.value,
    roleTypeIdFrom: communicationRoleFromDraft.value,
    roleTypeIdTo: communicationRoleToDraft.value,
    partyIdFrom: communicationPartyFromDraft.value,
    partyIdTo: communicationPartyToDraft.value,
    datetimeStarted: dateTimePayloadValue(communicationDatetimeStartedDraft.value),
    datetimeEnded: dateTimePayloadValue(communicationDatetimeEndedDraft.value),
    subject: communicationSubjectDraft.value,
    contentMimeTypeId: 'text/plain',
    content: communicationContentDraft.value.trim(),
    messageId: communicationMessageIdDraft.value,
    externalId: communicationExternalIdDraft.value,
    action: communicationActionDraft.value || ''
  }) as CommunicationEventPayload;

  await runAction(() => orderStore.createOrderCommunicationEvent(order.value!.id, payload), 'Communication event saved');
  closeCommunicationComposer();
}

async function openShipmentDocumentActions(shipment: Shipment) {
  await presentActionSheet(shipment.id, [
    actionButton('print-packing-slip', () => runAction(() => orderStore.getPoortiDocument('PackingSlip.pdf', { shipmentId: shipment.id }), 'Packing slip requested')),
    actionButton('print-shipping-label', () => runAction(() => orderStore.getPoortiDocument('Label.pdf', { shipmentId: shipment.id }), 'Shipping label requested')),
  ]);
}

async function openEmailActions() {
  await presentActionSheet('Send email', [
    {
      text: 'Confirmation',
      handler: () => sendEmail('PRDS_ODR_CONFIRM')
    },
    {
      text: 'Completion',
      handler: () => sendEmail('PRDS_ODR_COMPLETE')
    }
  ]);
}

async function openUpdateItemAction(item: OrderItem) {
  await presentAlert('Update item', [
    { name: 'quantity', type: 'number', label: 'Quantity', value: String(item.quantity) },
    { name: 'unitPrice', type: 'number', label: 'Unit price', value: String(item.unitPrice) },
  ], async (data) => {
    const quantity = numberValue(data.quantity);
    const unitPrice = numberValue(data.unitPrice);
    await runAction(() => orderStore.updateOrderItem(order.value!.id, item.id, { quantity, unitPrice }), 'Item updated');
  });
}

async function openReasonAction(header: string, label: string, handler: (reason: string) => Promise<unknown>) {
  await presentAlert(header, [
    { name: 'reason', type: 'textarea', label, placeholder: label },
  ], async (data) => {
    const reason = String(data.reason || '').trim();
    if (!reason) return;
    await runAction(() => handler(reason), `${header} submitted`);
  });
}

async function openInventoryAction(header: string, handler: (payload: { facilityId?: string; quantity?: number }) => Promise<unknown>) {
  await presentAlert(header, [
    { name: 'facilityId', type: 'text', label: 'Facility', placeholder: 'Facility ID' },
    { name: 'quantity', type: 'number', label: 'Quantity', placeholder: 'Quantity' },
  ], async (data) => {
    await runAction(() => handler({
      facilityId: String(data.facilityId || '').trim() || undefined,
      quantity: numberValue(data.quantity)
    }), `${header} submitted`);
  });
}

async function openQuantityAction(header: string, handler: (quantity?: number) => Promise<unknown>) {
  await presentAlert(header, [
    { name: 'quantity', type: 'number', label: 'Quantity', placeholder: 'Quantity' },
  ], async (data) => {
    await runAction(() => handler(numberValue(data.quantity)), `${header} submitted`);
  });
}

async function openShipToStoreAction(shipGroupSeqId = '') {
  await presentAlert('Convert to ship-to-store', [
    { name: 'shipGroupSeqId', type: 'text', label: 'Ship group', value: shipGroupSeqId },
    { name: 'facilityId', type: 'text', label: 'Facility', placeholder: 'Facility ID' },
  ], async (data) => {
    const selectedShipGroupSeqId = String(data.shipGroupSeqId || '').trim();
    if (!selectedShipGroupSeqId) return;
    await runAction(() => orderStore.convertOrderShipToStore(order.value!.id, {
      shipGroupSeqId: selectedShipGroupSeqId,
      facilityId: String(data.facilityId || '').trim() || undefined
    }), 'Ship-to-store conversion submitted');
  });
}

async function confirmAction(header: string, message: string, handler: () => Promise<unknown>) {
  const alert = await alertController.create({
    header,
    message,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Continue',
        role: 'destructive',
        handler: () => runAction(handler, `${header} submitted`)
      }
    ]
  });
  await alert.present();
}

async function presentActionSheet(header: string, buttons: Array<ActionSheetButton | undefined>) {
  const availableButtons = availableActionButtons(buttons);
  if (!availableButtons.length) {
    await showToast('No actions available');
    return;
  }

  const actionSheet = await actionSheetController.create({
    header,
    buttons: [
      ...availableButtons,
      { text: 'Cancel', role: 'cancel' }
    ]
  });
  await actionSheet.present();
}

async function presentAlert(
  header: string,
  inputs: Array<{ name: string; type: 'text' | 'number' | 'textarea'; label: string; value?: string; placeholder?: string }>,
  submit: (data: Record<string, string>) => Promise<void>
) {
  const alert = await alertController.create({
    header,
    inputs,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Save',
        handler: (data) => submit(data)
      }
    ]
  });
  await alert.present();
}

function actionButton(actionId: string, handler: () => void) {
  const action = legacySalesOrderActions.find((entry) => entry.id === actionId);
  if (!action || !actionAvailable(actionId)) return undefined;

  return {
    text: action.label,
    handler
  };
}

function availableActionButtons(buttons: Array<ActionSheetButton | undefined>) {
  return buttons.filter(Boolean) as ActionSheetButton[];
}

function actionAvailable(actionId: string) {
  const action = legacySalesOrderActions.find((entry) => entry.id === actionId);
  if (!action || action.implementationStatus !== 'callable') return false;
  if (action.permission && !userStore.hasPermission(action.permission)) return false;
  if (order.value?.status && action.hiddenForStatuses?.includes(order.value.status)) return false;
  return true;
}

async function runAction(handler: () => Promise<unknown>, successMessage: string) {
  try {
    await handler();
    await showToast(successMessage);
  } catch (error: any) {
    await showToast(error?.message || 'Action failed');
  }
}

function numberValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function compactPayload(data: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => String(value || '').trim()));
}

function selectOptions(options: SelectOption[]) {
  const optionsById = new Map<string, SelectOption>();

  options.forEach((option) => {
    const id = option.id?.trim();
    if (!id || optionsById.has(id)) return;

    optionsById.set(id, {
      id,
      label: option.label?.trim() || id
    });
  });

  return [...optionsById.values()].sort((first, second) => first.label.localeCompare(second.label));
}

function dateInputValue(value?: string) {
  if (!value) return '';

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(value);

  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return date.toISOString().slice(0, 10);
}

function datePayloadValue(value: string) {
  return value ? value.slice(0, 10) : undefined;
}

function dateTimeInputValue(value?: string) {
  if (!value) return '';

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(value);

  if (Number.isNaN(date.getTime())) return value.slice(0, 16);

  return date.toISOString().slice(0, 16);
}

function dateTimePayloadValue(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function communicationPreview(event: CommunicationEvent) {
  const content = event.content || event.note || event.toString || event.fromString || '';
  const startedAt = formatDateTime(event.datetimeStarted || event.entryDate);
  const participants = [event.partyIdFrom, event.partyIdTo].filter(Boolean).join(' to ');

  return [participants, startedAt, content].filter((value) => value && value !== 'Order date unavailable').join(' · ');
}

function shipGroupItems(shipGroup: DisplayShipGroup) {
  if (!order.value) return [];

  if (shipGroup.isUnassigned) {
    const assignedIds = new Set((order.value.shipGroups || []).flatMap((group) => {
      return order.value?.items.filter((item) => item.shipGroupSeqId === group.id).map((item) => item.id) || [];
    }));

    return order.value.items.filter((item) => !assignedIds.has(item.id));
  }

  return order.value.items.filter((item) => item.shipGroupSeqId === shipGroup.id);
}

function shipGroupDetails(shipGroup: DisplayShipGroup) {
  return [
    {
      label: 'Shipping instructions',
      value: shipGroup.shippingInstructions
    },
    {
      label: 'Gift message',
      value: shipGroup.giftMessage
    },
    {
      label: 'May split',
      value: yesNoValue(shipGroup.maySplit)
    },
    {
      label: 'Gift',
      value: yesNoValue(shipGroup.isGift)
    },
    {
      label: 'Ship after',
      value: formatDateTime(shipGroup.shipAfterDate)
    },
    {
      label: 'Ship by',
      value: formatDateTime(shipGroup.shipByDate)
    },
    {
      label: 'Estimated ship',
      value: formatDateTime(shipGroup.estimatedShipDate)
    },
    {
      label: 'Estimated delivery',
      value: formatDateTime(shipGroup.estimatedDeliveryDate)
    }
  ].filter((detail) => detail.value && detail.value !== 'Order date unavailable');
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
}

function paymentCapturedLabel(payment: PaymentPreference) {
  return payment.capturedAt ? `Captured ${formatDateTime(payment.capturedAt)}` : 'Capture date unavailable';
}

function isItemShipped(item: OrderItem) {
  const shippedQuantity = item.shippedQuantity || 0;
  if (item.quantity > 0 && shippedQuantity >= item.quantity) return true;

  return /(shipped|completed)/i.test(item.status);
}

function shipmentStatusLabel(shipment: Shipment) {
  const status = readableValue(shipment.status).replace(/^Shipment /, '') || 'Shipment';
  const relativeDate = relativeDateLabel(shipment.shipDate || shipment.estimatedShipDate || shipment.createdDate);

  return relativeDate ? `${status} ${relativeDate}` : status;
}

function relativeDateLabel(value?: string) {
  const time = timelineTime(value);
  if (!time) return '';

  const elapsedMs = Date.now() - time;
  if (elapsedMs < 0) return '';

  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Order date unavailable';

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function timelineTime(value?: string) {
  if (!value) return 0;

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function timelineIcon(entry: OrderStatusChange) {
  const label = `${entry.label} ${entry.detail}`.toLowerCase();

  if (label.includes('created')) return sunnyOutline;
  if (label.includes('import')) return downloadOutline;
  if (label.includes('cancel') || label.includes('reject')) return alertCircleOutline;
  if (label.includes('ship') || label.includes('complete')) return checkmarkDoneOutline;
  if (entry.itemSeqId || label.includes('item')) return cubeOutline;
  return timeOutline;
}

function timelineDelta(entry: OrderStatusChange, index: number) {
  const previousEvent = orderTimeline.value[index - 1];
  const baseline = previousEvent?.at || order.value?.orderDate || order.value?.entryDate;
  const startTime = timelineTime(baseline);
  const eventTime = timelineTime(entry.at);

  if (!startTime || !eventTime) return 'Time unavailable';

  const minutes = Math.max(0, Math.round((eventTime - startTime) / 60000));
  if (minutes < 60) return minutes ? `${minutes}m later` : index ? 'Same time as previous event' : 'At order time';

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h later`;

  return `${Math.round(hours / 24)}d later`;
}

function timelineItemLabel(entry: OrderStatusChange) {
  if (!entry.itemSeqId || !order.value) return '';

  const item = order.value.items.find((orderItem) => orderItem.id === entry.itemSeqId);
  if (!item) return `Item ${entry.itemSeqId}`;

  return [item.name || item.sku, item.sku && item.sku !== item.name ? item.sku : ''].filter(Boolean).join(' · ');
}

function readableValue(value?: string) {
  if (!value) return '';

  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusBadgeColor(status?: string) {
  const description = readableValue(status);
  const fallbackDescription = description.split(' ').slice(1).join(' ');

  return commonUtil.getColorByDesc(description) || commonUtil.getColorByDesc(fallbackDescription) || commonUtil.getColorByDesc('default');
}

function yesNoValue(value?: string) {
  if (!value) return '';
  if (value === 'Y') return 'Yes';
  if (value === 'N') return 'No';
  return readableValue(value);
}
</script>

<style scoped>
.card-header-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions" "subtitle actions";
}

.card-header-grid ion-card-title {
  grid-area: title;
}

.card-header-grid ion-card-subtitle {
  grid-area: subtitle;
}

.card-header-grid ion-note,
.card-header-grid ion-button,
.card-header-grid ion-buttons {
  grid-area: actions;
  align-self: center;
}

.order-detail-content::part(scroll) {
  padding: 16px;
}

.order-detail-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-inline: auto;
  max-width: 1280px;
  padding-bottom: 24px;
}

.order-detail-header,
.order-detail-header-details,
.order-detail-secondary {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

.order-detail-shell ion-card {
  margin: 0;
}

.order-detail-shell ion-card-content {
  padding-inline: 0;
}

.order-detail-wide-card {
  width: 100%;
}

.order-detail-wide-section {
  display: grid;
  gap: 16px;
}

.order-detail-timeline {
  align-self: start;
}

.order-item-thumbnail {
  --size: 56px;
}

.order-timeline ion-item {
  --min-height: 72px;
}

@media (min-width: 900px) {
  .order-detail-header {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
  }

  .order-detail-header-details {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .order-detail-secondary {
    align-items: start;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
