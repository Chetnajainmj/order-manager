<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="shipment?.orderId ? `/orders/${shipment.orderId}` : '/orders'" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ shipment?.id ?? 'Shipment' }}</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="shipmentStore.fetchStatus.detail === 'pending'" type="indeterminate" />
    </ion-header>

    <ion-content v-if="shipment">
      <ion-list>
        <ion-list-header>
          <ion-label>Shipment info</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-label>
            <h2>{{ shipment.id }}</h2>
            <p>{{ shipment.shipmentTypeId || 'Shipment' }}</p>
          </ion-label>
          <ion-note slot="end">{{ shipment.status }}</ion-note>
        </ion-item>
        <ion-item v-if="shipment.orderId" :router-link="`/orders/${shipment.orderId}`">
          <ion-label>Back to order</ion-label>
          <ion-note slot="end">{{ shipment.orderId }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Route</ion-label>
          <ion-note slot="end">{{ shipment.origin || shipment.originFacilityId }} to {{ shipment.destination || shipment.destinationFacilityId }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Ship date</ion-label>
          <ion-note slot="end">{{ formatDate(shipment.estimatedShipDate || shipment.shipDate) || 'Unavailable' }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>ETA</ion-label>
          <ion-note slot="end">{{ formatDate(shipment.estimatedArrivalDate) || 'Unavailable' }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Created</ion-label>
          <ion-note slot="end">{{ formatDate(shipment.createdDate) || 'Unavailable' }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-accordion-group>
        <ion-accordion value="items">
          <ion-item slot="header">
            <ion-label>Items</ion-label>
            <ion-badge slot="end">{{ shipment.items?.length || 0 }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item
              v-for="item in shipment.items"
              :key="item.id"
              :router-link="item.orderId ? `/orders/${item.orderId}` : undefined"
            >
              <ion-label>
                <h2>{{ item.description || item.productId }}</h2>
                <p>{{ item.productId }} · Order item {{ item.orderItemSeqId }}</p>
                <p v-if="item.dimensions">{{ item.dimensions }}</p>
              </ion-label>
              <ion-note slot="end">{{ item.quantity }}</ion-note>
            </ion-item>
            <ion-item v-if="!shipment.items?.length">
              <ion-label>No shipment items found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>

        <ion-accordion value="packages">
          <ion-item slot="header">
            <ion-label>Packages</ion-label>
            <ion-badge slot="end">{{ packages.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="shipmentStore.errors.packages">
              <ion-label>{{ shipmentStore.errors.packages }}</ion-label>
            </ion-item>
            <ion-item
              v-for="shipmentPackage in packages"
              :key="shipmentPackage.id"
              :href="trackingUrl(shipmentPackage.carrier, shipmentPackage.trackingCode)"
              target="_blank"
            >
              <ion-label>
                <h2>{{ shipmentPackage.packageName || shipmentPackage.id }}</h2>
                <p>{{ shipmentPackage.dimensions || shipmentPackage.boxTypeId }}</p>
                <p>{{ shipmentPackage.trackingCode || 'No tracking number' }}</p>
                <p v-if="shipmentPackage.contents.length">Contents {{ packageContentSummary(shipmentPackage) }}</p>
              </ion-label>
              <ion-note slot="end">{{ shipmentPackage.weight }} {{ shipmentPackage.weightUomId }}</ion-note>
            </ion-item>
            <ion-item v-if="!packages.length && !shipmentStore.errors.packages">
              <ion-label>No packages found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>

        <ion-accordion value="routes">
          <ion-item slot="header">
            <ion-label>Route segments</ion-label>
            <ion-badge slot="end">{{ routeSegments.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="shipmentStore.errors.routes">
              <ion-label>{{ shipmentStore.errors.routes }}</ion-label>
            </ion-item>
            <ion-item
              v-for="segment in routeSegments"
              :key="segment.id"
              :href="trackingUrl(segment.carrier, segment.trackingCode)"
              target="_blank"
            >
              <ion-label>
                <h2>{{ segment.carrier || 'Carrier' }}</h2>
                <p>{{ segment.method }}</p>
                <p>{{ segment.trackingCode || segment.actualCarrierCode }}</p>
                <p>{{ formatDate(segment.estimatedShipDate) }} {{ formatDate(segment.estimatedArrivalDate) }}</p>
              </ion-label>
              <ion-note slot="end">{{ segment.status }}</ion-note>
            </ion-item>
            <ion-item v-if="!routeSegments.length && !shipmentStore.errors.routes">
              <ion-label>No route segments found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>

        <ion-accordion value="history">
          <ion-item slot="header">
            <ion-label>Status history</ion-label>
            <ion-badge slot="end">{{ statusHistory.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="shipmentStore.errors.statusHistory">
              <ion-label>{{ shipmentStore.errors.statusHistory }}</ion-label>
            </ion-item>
            <ion-item v-for="entry in statusHistory" :key="entry.id">
              <ion-label>
                <h2>{{ entry.statusId }}</h2>
                <p>{{ formatDate(entry.statusDate) }}</p>
                <p>{{ entry.changedBy }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!statusHistory.length && !shipmentStore.errors.statusHistory">
              <ion-label>No status history found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>
      </ion-accordion-group>
    </ion-content>

    <ion-content v-else-if="shipmentStore.fetchStatus.detail === 'pending'">
      <ion-list>
        <ion-item>
          <ion-label>Loading shipment</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="shipmentStore.errors.detail">
      <ErrorState
        title="Shipment failed to load"
        :message="shipmentStore.errors.detail"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        title="Shipment not found"
        message="The selected shipment is not available in this workspace."
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonTitle,
  IonToolbar
} from '@ionic/vue';
import { DateTime } from 'luxon';
import { useShipmentStore } from '@/store/shipment';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import type { ShipmentPackage } from '@/types/order';

const props = defineProps<{
  shipmentId: string;
}>();

const shipmentStore = useShipmentStore();
const shipment = computed(() => shipmentStore.getShipment(props.shipmentId));
const packages = computed(() => shipmentStore.getShipmentPackages(props.shipmentId));
const routeSegments = computed(() => shipmentStore.getShipmentRouteSegments(props.shipmentId));
const statusHistory = computed(() => shipmentStore.getShipmentStatusHistory(props.shipmentId));

onMounted(loadShipment);

watch(() => props.shipmentId, loadShipment);

async function loadShipment() {
  await shipmentStore.loadShipment(props.shipmentId).catch(() => undefined);
}

function packageContentSummary(shipmentPackage: ShipmentPackage) {
  return shipmentPackage.contents.map((content) => `${content.quantity} x ${content.productId || content.shipmentItemSeqId}`).join(', ');
}

function trackingUrl(carrier: string, trackingCode: string) {
  if (!trackingCode) return undefined;

  const normalizedCarrier = carrier.toUpperCase();
  if (normalizedCarrier.includes('UPS')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingCode)}`;
  if (normalizedCarrier.includes('FEDEX')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingCode)}`;
  if (normalizedCarrier.includes('USPS')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingCode)}`;

  return undefined;
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}
</script>
