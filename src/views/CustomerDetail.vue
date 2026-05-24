<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/orders" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ customer?.name || customer?.id || 'Customer' }}</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="customerStore.fetchStatus.detail === 'pending'" type="indeterminate" />
    </ion-header>

    <ion-content v-if="customer">
      <ion-list>
        <ion-list-header>
          <ion-label>Profile</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-label>
            <h2>{{ customer.name || customer.id }}</h2>
            <p>{{ customer.personalTitle }} {{ customer.partyTypeId }}</p>
          </ion-label>
          <ion-note slot="end">{{ customer.statusId || customer.loyaltyTier }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Party ID</ion-label>
          <ion-note slot="end">{{ customer.id }}</ion-note>
        </ion-item>
        <ion-item v-if="customer.externalId">
          <ion-label>External ID</ion-label>
          <ion-note slot="end">{{ customer.externalId }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Created</ion-label>
          <ion-note slot="end">{{ customer.createdStamp || 'Unavailable' }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>Updated</ion-label>
          <ion-note slot="end">{{ customer.lastUpdatedStamp || 'Unavailable' }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-accordion-group>
        <ion-accordion value="contacts">
          <ion-item slot="header">
            <ion-label>Contact</ion-label>
            <ion-badge slot="end">{{ contactCount }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="customerStore.errors.contactMechs">
              <ion-label>{{ customerStore.errors.contactMechs }}</ion-label>
            </ion-item>
            <ion-item v-for="email in emails" :key="email.contactMechId">
              <ion-label>
                <h2>{{ email.contactMechPurposeTypeId || 'Email' }}</h2>
                <p>{{ email.infoString }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-for="phone in phones" :key="phone.contactMechId">
              <ion-label>
                <h2>{{ phone.contactMechPurposeTypeId || 'Phone' }}</h2>
                <p>{{ phone.infoString }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!emails.length && !phones.length && !customerStore.errors.contactMechs">
              <ion-label>No email or phone contact found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>

        <ion-accordion value="addresses">
          <ion-item slot="header">
            <ion-label>Addresses</ion-label>
            <ion-badge slot="end">{{ postalAddresses.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-for="address in postalAddresses" :key="address.contactMechId">
              <ion-label>
                <h2>{{ address.contactMechPurposeTypeId || 'Address' }}</h2>
                <p v-if="address.postalAddress?.address1">{{ address.postalAddress.address1 }}</p>
                <p v-if="address.postalAddress?.address2">{{ address.postalAddress.address2 }}</p>
                <p>{{ addressLine(address) }}</p>
                <p>{{ address.postalAddress?.countryGeoId }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="!postalAddresses.length && !customerStore.errors.contactMechs">
              <ion-label>No postal addresses found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>

        <ion-accordion value="orders">
          <ion-item slot="header">
            <ion-label>Recent orders</ion-label>
            <ion-badge slot="end">{{ customerOrders.length }}</ion-badge>
          </ion-item>
          <ion-list slot="content">
            <ion-item v-if="customerStore.errors.orders">
              <ion-label>{{ customerStore.errors.orders }}</ion-label>
            </ion-item>
            <ion-item v-for="order in customerOrders" :key="order.id" :router-link="`/orders/${order.id}`">
              <ion-label>
                <h2>{{ order.externalId || order.id }}</h2>
                <p>{{ order.orderDate }} · {{ order.channel }}</p>
                <p>{{ money(order.total, order.currency) }}</p>
              </ion-label>
              <ion-note slot="end">{{ order.status }}</ion-note>
            </ion-item>
            <ion-item v-if="customerOrders.length">
              <ion-label>{{ customerOrderTotal }} total orders</ion-label>
            </ion-item>
            <ion-item v-if="!customerOrders.length && !customerStore.errors.orders">
              <ion-label>No recent orders found</ion-label>
            </ion-item>
          </ion-list>
        </ion-accordion>
      </ion-accordion-group>
    </ion-content>

    <ion-content v-else-if="customerStore.fetchStatus.detail === 'pending'">
      <ion-list>
        <ion-item>
          <ion-label>Loading customer</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="customerStore.errors.detail">
      <ErrorState
        title="Customer failed to load"
        :message="customerStore.errors.detail"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        title="Customer not found"
        message="The selected customer is not available in this workspace."
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
import { useCustomerStore } from '@/store/customers';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import type { ContactMech } from '@/types/order';

const props = defineProps<{
  customerId: string;
}>();

const customerStore = useCustomerStore();
const customer = computed(() => customerStore.getCustomer(props.customerId));
const emails = computed(() => customer.value?.emails || []);
const phones = computed(() => customer.value?.phones || []);
const postalAddresses = computed(() => customer.value?.postalAddresses || []);
const customerOrders = computed(() => customerStore.getCustomerOrders(props.customerId));
const customerOrderTotal = computed(() => customerStore.orderTotalsByCustomer[props.customerId] || customerOrders.value.length);
const contactCount = computed(() => emails.value.length + phones.value.length);

onMounted(loadCustomer);

watch(() => props.customerId, loadCustomer);

async function loadCustomer() {
  await customerStore.loadCustomer(props.customerId).catch(() => undefined);
}

function addressLine(contactMech: ContactMech) {
  return [
    contactMech.postalAddress?.city,
    contactMech.postalAddress?.stateProvinceGeoId,
    contactMech.postalAddress?.postalCode
  ].filter(Boolean).join(', ');
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
}
</script>
