<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Find shipments</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="searchQuery" placeholder="Order, tracking code, shipment ID" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-list-header>
          <ion-label>Filters</ion-label>
          <ion-button fill="clear" @click="clearFilters">Clear</ion-button>
        </ion-list-header>
        <ion-item>
          <ion-select v-model="searchFilters.status" label="Status" interface="popover">
            <ion-select-option value="All">All statuses</ion-select-option>
            <ion-select-option v-for="option in shipmentStatuses" :key="option.statusId" :value="option.statusId">
              {{ option.description || option.statusId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="searchFilters.carrierPartyId" label="Carrier" interface="popover">
            <ion-select-option value="All">All carriers</ion-select-option>
            <ion-select-option v-for="carrier in carriers" :key="carrier" :value="carrier">
              {{ carrier }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input v-model="searchFilters.dateFrom" label="From" type="date" />
        </ion-item>
        <ion-item>
          <ion-input v-model="searchFilters.dateThru" label="Thru" type="date" />
        </ion-item>
      </ion-list>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        title="Shipment search failed"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ searchTotal }} shipments</ion-label>
        </ion-list-header>
        <ion-item v-for="shipment in searchResults" :key="shipment.id" :router-link="`/shipments/${shipment.id}`">
          <ion-label>
            <h2>{{ shipment.id }}</h2>
            <p>{{ shipment.orderId || '—' }} · {{ shipment.trackingCode || '—' }}</p>
            <p>{{ shipment.status }} · {{ formatDate(shipment.shipDate) }}</p>
          </ion-label>
          <ion-note slot="end">
            {{ shipment.carrier }}
          </ion-note>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !searchResults.length"
        title="No matching shipments"
        message="Adjust the search text or filters to broaden the shipment list."
      />

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more shipments" />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar
} from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import { storeToRefs } from 'pinia';
import { useShipmentsStore } from '@/store/shipments';
import { useUtilStore } from '@/store/util';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const shipmentsStore = useShipmentsStore();
const utilStore = useUtilStore();
const { searchQuery, searchFilters, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(shipmentsStore);
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const shipmentStatuses = computed(() => utilStore.getStatusItemsByType('SHIPMENT_STATUS'));
const carriers = computed(() => {
  const carrierIds = searchResults.value.map((shipment) => shipment.carrier).filter(Boolean);
  if (searchFilters.value.carrierPartyId !== 'All') carrierIds.push(searchFilters.value.carrierPartyId);
  return [...new Set(carrierIds)].sort();
});

onMounted(async () => {
  await utilStore.fetchStatusItemsByType('SHIPMENT_STATUS');
  await shipmentsStore.runSearch();
});

watch(searchQuery, () => {
  scheduleSearch();
});

watch(searchFilters, () => {
  shipmentsStore.runSearch();
}, { deep: true });

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => shipmentsStore.runSearch(), 300);
}

function clearFilters() {
  shipmentsStore.searchQuery = '';
  shipmentsStore.searchFilters = {
    status: 'All',
    carrierPartyId: 'All',
    dateFrom: '',
    dateThru: '',
  };
}

async function loadMore(event: CustomEvent) {
  await shipmentsStore.appendNextPage();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}
</script>
