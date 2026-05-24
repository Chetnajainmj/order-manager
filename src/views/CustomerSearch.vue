<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Find customers</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="searchQuery" placeholder="Name, email, phone" />
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
            <ion-select-option v-for="option in customerStatuses" :key="option.statusId" :value="option.statusId">
              {{ option.description || option.statusId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="searchFilters.partyTypeId" label="Party type" interface="popover">
            <ion-select-option value="All">All party types</ion-select-option>
            <ion-select-option value="PERSON">Person</ion-select-option>
            <ion-select-option value="PARTY_GROUP">Group</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        title="Customer search failed"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header>
          <ion-label>{{ searchTotal }} customers</ion-label>
        </ion-list-header>
        <ion-item v-for="customer in searchResults" :key="customer.id" :router-link="`/customers/${customer.id}`">
          <ion-label>
            <h2>{{ customer.name || customer.id }}</h2>
            <p>{{ customer.email || customer.phone || customer.partyTypeId || customer.id }}</p>
            <p>{{ customer.statusId }}</p>
          </ion-label>
          <ion-note v-if="customer.lifetimeOrders || (customer.loyaltyTier && customer.loyaltyTier !== 'Unassigned')" slot="end">
            {{ customer.lifetimeOrders }} · {{ customer.loyaltyTier }}
          </ion-note>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !searchResults.length"
        title="No matching customers"
        message="Adjust the search text or filters to broaden the customer list."
      />

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more customers" />
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
import { useCustomersStore } from '@/store/customers';
import { useUtilStore } from '@/store/util';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const customersStore = useCustomersStore();
const utilStore = useUtilStore();
const { searchQuery, searchFilters, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(customersStore);
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const customerStatuses = computed(() => utilStore.getStatusItemsByType('PARTY_STATUS'));

onMounted(async () => {
  await utilStore.fetchStatusItemsByType('PARTY_STATUS');
  await customersStore.runSearch();
});

watch(searchQuery, () => {
  scheduleSearch();
});

watch(searchFilters, () => {
  customersStore.runSearch();
}, { deep: true });

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => customersStore.runSearch(), 300);
}

function clearFilters() {
  customersStore.searchQuery = '';
  customersStore.searchFilters = {
    status: 'All',
    partyTypeId: 'PERSON',
    loyaltyTier: 'All',
  };
}

async function loadMore(event: CustomEvent) {
  await customersStore.appendNextPage();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}
</script>
