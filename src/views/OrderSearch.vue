<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Find orders</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="searchQuery" placeholder="Order, external ID, customer, email" />
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
            <ion-select-option v-for="option in orderStatuses" :key="option.statusId" :value="option.statusId">
              {{ option.description || option.statusId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="searchFilters.channel" label="Channel" interface="popover">
            <ion-select-option value="All">All channels</ion-select-option>
            <ion-select-option v-for="option in salesChannels" :key="option.enumId" :value="option.enumId">
              {{ option.description || option.enumName || option.enumId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="searchFilters.productStoreId" label="Product store" interface="popover">
            <ion-select-option value="All">All stores</ion-select-option>
            <ion-select-option v-for="store in productStores" :key="store.productStoreId" :value="store.productStoreId">
              {{ store.storeName || store.productStoreId }}
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
        title="Order search failed"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ searchTotal }} orders</ion-label>
        </ion-list-header>
        <ion-item v-for="order in searchResults" :key="order.id" :router-link="`/orders/${order.id}`">
          <ion-label>
            <h2>{{ order.id }} · {{ order.externalId }}</h2>
            <p>{{ order.orderDate }} · {{ order.channel }}</p>
            <p>{{ order.priority }}</p>
          </ion-label>
          <ion-note slot="end">
            {{ order.status }}
          </ion-note>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !searchResults.length"
        title="No matching orders"
        message="Adjust the search text or filters to broaden the order list."
      />

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more orders" />
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
import { storeToRefs } from 'pinia';
import { useOrderStore } from '@/store/order';
import { useUserStore } from '@/store/user';
import { useUtilStore } from '@/store/util';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const orderStore = useOrderStore();
const userStore = useUserStore();
const utilStore = useUtilStore();
const { searchQuery, searchFilters, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(orderStore);
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const orderStatuses = computed(() => utilStore.getStatusItemsByType('ORDER_STATUS'));
const salesChannels = computed(() => utilStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const productStores = computed(() => userStore.getUserProfile?.stores || []);

onMounted(async () => {
  await Promise.allSettled([
    utilStore.fetchStatusItemsByType('ORDER_STATUS'),
    utilStore.fetchEnumsByType('ORDER_SALES_CHANNEL')
  ]);
  await orderStore.runSearch();
});

watch(searchQuery, () => {
  scheduleSearch();
});

watch(searchFilters, () => {
  orderStore.runSearch();
}, { deep: true });

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => orderStore.runSearch(), 300);
}

function clearFilters() {
  orderStore.searchQuery = '';
  orderStore.searchFilters = {
    status: 'All',
    channel: 'All',
    productStoreId: 'All',
    dateFrom: '',
    dateThru: '',
  };
}

async function loadMore(event: CustomEvent) {
  await orderStore.appendNextPage();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}
</script>
