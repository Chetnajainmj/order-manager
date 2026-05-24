<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Find returns</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="searchQuery" placeholder="Return ID, order, customer" />
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
            <ion-select-option v-for="option in returnStatuses" :key="option.statusId" :value="option.statusId">
              {{ option.description || option.statusId }}
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
        title="Return search failed"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ searchTotal }} returns</ion-label>
        </ion-list-header>
        <ion-item v-for="ret in searchResults" :key="ret.id" :router-link="`/returns/${ret.id}`">
          <ion-label>
            <h2>{{ ret.id }} · {{ ret.status }}</h2>
            <p>{{ ret.orderId || '—' }} · {{ formatDate(ret.requestedDate) }}</p>
            <p v-if="ret.refundTotal">{{ ret.refundTotal }} {{ ret.currencyUomId }}</p>
          </ion-label>
          <ion-note slot="end">
            {{ ret.fromPartyId }}
          </ion-note>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !searchResults.length"
        title="No matching returns"
        message="Adjust the search text or filters to broaden the return list."
      />

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more returns" />
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
import { useReturnsStore } from '@/store/returns';
import { useUserStore } from '@/store/user';
import { useUtilStore } from '@/store/util';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const returnsStore = useReturnsStore();
const userStore = useUserStore();
const utilStore = useUtilStore();
const { searchQuery, searchFilters, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(returnsStore);
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const returnStatuses = computed(() => utilStore.getStatusItemsByType('RETURN_HEADER_STATUS'));
const productStores = computed(() => userStore.getUserProfile?.stores || []);

onMounted(async () => {
  await utilStore.fetchStatusItemsByType('RETURN_HEADER_STATUS');
  await returnsStore.runSearch();
});

watch(searchQuery, () => {
  scheduleSearch();
});

watch(searchFilters, () => {
  returnsStore.runSearch();
}, { deep: true });

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => returnsStore.runSearch(), 300);
}

function clearFilters() {
  returnsStore.searchQuery = '';
  returnsStore.searchFilters = {
    status: 'All',
    dateFrom: '',
    dateThru: '',
    productStoreId: 'All',
  };
}

async function loadMore(event: CustomEvent) {
  await returnsStore.appendNextPage();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}
</script>
