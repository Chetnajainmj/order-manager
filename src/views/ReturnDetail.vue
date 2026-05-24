<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="returnRecord?.orderId ? `/orders/${returnRecord.orderId}` : '/orders'" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ returnRecord?.id ?? 'Return' }}</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="returnStore.fetchStatus.detail === 'pending'" type="indeterminate" />
    </ion-header>

    <ion-content v-if="returnRecord">
      <ion-list>
        <ion-list-header>
          <ion-label>Return header</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-label>
            <h2>{{ returnRecord.id }}</h2>
            <p>{{ returnRecord.returnHeaderTypeId || returnRecord.reason }}</p>
          </ion-label>
          <ion-note slot="end">{{ returnRecord.status }}</ion-note>
        </ion-item>
        <ion-item v-if="returnRecord.orderId" :router-link="`/orders/${returnRecord.orderId}`">
          <ion-label>Back to order</ion-label>
          <ion-note slot="end">{{ returnRecord.orderId }}</ion-note>
        </ion-item>
        <ion-item v-if="returnRecord.fromPartyId" :router-link="`/customers/${returnRecord.fromPartyId}`">
          <ion-label>From party</ion-label>
          <ion-note slot="end">{{ returnRecord.fromPartyId }}</ion-note>
        </ion-item>
        <ion-item v-if="returnRecord.toPartyId" :router-link="`/customers/${returnRecord.toPartyId}`">
          <ion-label>To party</ion-label>
          <ion-note slot="end">{{ returnRecord.toPartyId }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Entry date</ion-label>
          <ion-note slot="end">{{ returnRecord.entryDate || returnRecord.requestedDate || 'Unavailable' }}</ion-note>
        </ion-item>
        <ion-item v-if="returnRecord.receivedDate">
          <ion-label>Received</ion-label>
          <ion-note slot="end">{{ returnRecord.receivedDate }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Refund total</ion-label>
          <ion-note slot="end">{{ money(returnRecord.refundTotal, returnRecord.currencyUomId) }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Created by</ion-label>
          <ion-note slot="end">{{ returnRecord.createdBy || 'Unavailable' }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-accordion-group>
        <ion-accordion value="items">
          <ion-item slot="header">
            <ion-label>Returned items</ion-label>
            <ion-badge slot="end">{{ returnItems.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="returnStore.errors.items">
              <ion-label>{{ returnStore.errors.items }}</ion-label>
            </ion-item>
            <ion-item
              v-for="item in returnItems"
              :key="item.returnItemSeqId"
              :router-link="item.orderId ? `/orders/${item.orderId}` : undefined"
            >
              <ion-label>
                <h2>{{ item.description || item.productId }}</h2>
                <p>{{ item.productId }} · Order item {{ item.orderItemSeqId }}</p>
                <p>{{ item.returnReasonId }} · {{ item.returnTypeId || item.returnItemTypeId }}</p>
                <p>{{ item.statusId }}</p>
              </ion-label>
              <ion-note slot="end">
                {{ item.returnQuantity }} / {{ item.receivedQuantity }} · {{ money(item.returnPrice, returnRecord.currencyUomId) }}
              </ion-note>
            </ion-item>
            <ion-item v-if="!returnItems.length && !returnStore.errors.items">
              <ion-label>No return items found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>

        <ion-accordion value="history">
          <ion-item slot="header">
            <ion-label>Status history</ion-label>
            <ion-badge slot="end">{{ statusHistory.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="returnStore.errors.statusHistory">
              <ion-label>{{ returnStore.errors.statusHistory }}</ion-label>
            </ion-item>
            <ion-item v-for="entry in statusHistory" :key="entry.id">
              <ion-label>
                <h2>{{ entry.statusId }}</h2>
                <p>{{ entry.statusDate }}</p>
                <p>{{ entry.changedBy }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!statusHistory.length && !returnStore.errors.statusHistory">
              <ion-label>No status history found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>
      </ion-accordion-group>
    </ion-content>

    <ion-content v-else-if="returnStore.fetchStatus.detail === 'pending'">
      <ion-list>
        <ion-item>
          <ion-label>Loading return</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="returnStore.errors.detail">
      <ErrorState
        title="Return failed to load"
        :message="returnStore.errors.detail"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        title="Return not found"
        message="The selected return is not available in this workspace."
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
import { useReturnStore } from '@/store/returns';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const props = defineProps<{
  returnId: string;
}>();

const returnStore = useReturnStore();
const returnRecord = computed(() => returnStore.getReturn(props.returnId));
const returnItems = computed(() => returnStore.getReturnItems(props.returnId));
const statusHistory = computed(() => returnStore.getReturnStatusHistory(props.returnId));

onMounted(loadReturn);

watch(() => props.returnId, loadReturn);

async function loadReturn() {
  await returnStore.loadReturn(props.returnId).catch(() => undefined);
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
}
</script>
