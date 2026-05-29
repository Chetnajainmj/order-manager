<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Tasks</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="query" placeholder="Search order, return, customer, channel, brand" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="purpose">
          <ion-segment-button value="all">
            <ion-label>All</ion-label>
          </ion-segment-button>
          <ion-segment-button value="grace-period">
            <ion-label>Grace</ion-label>
          </ion-segment-button>
          <ion-segment-button value="repair">
            <ion-label>Repair</ion-label>
          </ion-segment-button>
          <ion-segment-button value="inventory">
            <ion-label>Inventory</ion-label>
          </ion-segment-button>
          <ion-segment-button value="manual">
            <ion-label>Manual</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-progress-bar v-if="loading" type="indeterminate" />
      <ErrorState v-if="error" title="Task queue failed" :message="error" />

      <section v-if="taskCards.length" class="tasks">
        <ion-card v-for="taskCard in taskCards" :key="taskCard.workEffort.workEffortId">
          <ion-card-header>
            <ion-card-subtitle>{{ taskCard.workEffort.workEffortName }}</ion-card-subtitle>
            <ion-card-title>{{ purposeLabel(taskCard.workEffort.purpose) }}</ion-card-title>
            <div class="ion-text-end meta-data">
              <p>{{ taskAge(taskCard.workEffort) }} ago</p>
              <p>{{ dueDelta(taskCard.workEffort.dueAt) }}</p>
            </div>
          </ion-card-header>

          <div class="actions">
            <ion-button fill="clear" :router-link="`/tasks/${taskCard.workEffort.workEffortId}`">
              Open task
            </ion-button>
            <ion-button fill="clear" @click="openAssigneeModal(taskCard.workEffort.workEffortId)">
              Assign
            </ion-button>
            <ion-button fill="outline" :router-link="transactionLink(taskCard.item)">
              Open {{ taskCard.item.transactionType.toLowerCase() }}
            </ion-button>
          </div>

          <ion-list lines="full">
            <ion-item>
              <ion-label>
                {{ taskCard.item.displayId }} · {{ taskCard.item.customerName }}
                <p>{{ taskCard.item.transactionType }} · {{ taskCard.item.status }} · {{ taskCard.item.channel }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                Assignment
              </ion-label>
              <p slot="end">{{ taskCard.workEffort.owner }}</p>
            </ion-item>
          </ion-list>
        </ion-card>
      </section>

      <EmptyState
        v-if="!loading && !error && !workItems.length"
        title="No tasks"
        message="Active work linked to orders, returns, refunds, or shipments will appear here."
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  modalController
} from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import TaskAssigneeModal from '@/components/TaskAssigneeModal.vue';
import { useOperationsStore } from '@/store/operations';
import type { TransactionWorkItem, WorkEffortPurpose, WorkEffortSummary } from '@/types/operations';

const operationsStore = useOperationsStore();
const { workItems, loading, error } = storeToRefs(operationsStore);
const purpose = ref<WorkEffortPurpose | 'all'>('all');
const query = ref('');
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const taskCards = computed(() => {
  return workItems.value.flatMap((item) => {
    return item.activeWorkEfforts.map((workEffort) => ({ item, workEffort }));
  });
});

onMounted(() => {
  loadWorkItems();
});

watch(purpose, () => {
  loadWorkItems();
});

watch(query, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadWorkItems, 300);
});

function loadWorkItems() {
  operationsStore.loadWorkItems({ purpose: purpose.value, status: 'active', query: query.value });
}

async function openAssigneeModal(workEffortId: string) {
  const assigneeModal = await modalController.create({
    component: TaskAssigneeModal
  });

  assigneeModal.onDidDismiss().then((result) => {
    const assignee = result.data;
    if (!assignee?.name) return;

    operationsStore.assignWorkEffort(workEffortId, assignee.name);
  });

  return assigneeModal.present();
}

function purposeLabel(value: WorkEffortPurpose) {
  return {
    'grace-period': 'Grace period',
    repair: 'Repair',
    inventory: 'Inventory',
    manual: 'Manual',
  }[value];
}

function transactionLink(item: TransactionWorkItem) {
  if (item.transactionType === 'RETURN') return `/returns/${item.transactionId}`;
  if (item.transactionType === 'ORDER') return `/orders/${item.transactionId}`;
  return '/orders';
}

function impactLabel(workEffort: WorkEffortSummary) {
  const impacts = [];
  if (workEffort.blocksRelease) impacts.push('Blocks release');
  if (workEffort.blocksRefund) impacts.push('Blocks refund');
  if (workEffort.blocksExport) impacts.push('Blocks export');
  return impacts.length ? impacts.join(' · ') : 'No blocking impact';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function taskAge(workEffort: WorkEffortSummary) {
  const createdActivity = workEffort.activity.find((a) => a.event === 'Created') || workEffort.activity[0];
  if (!createdActivity) return '';

  const createdTime = new Date(createdActivity.at).getTime();
  const elapsedMs = Date.now() - createdTime;
  if (elapsedMs < 0) return '0m';

  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d`;
}

function dueDelta(dueAt: string) {
  const dueTime = new Date(dueAt).getTime();
  const diffMs = dueTime - Date.now();
  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const minutes = Math.round(absDiffMs / 60000);
  if (minutes < 1) return isOverdue ? 'overdue' : 'now';

  let deltaStr = '';
  if (minutes < 60) {
    deltaStr = `${minutes}m`;
  } else {
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      deltaStr = `${hours}h`;
    } else {
      const days = Math.round(hours / 24);
      deltaStr = `${days}d`;
    }
  }

  return isOverdue ? `${deltaStr} overdue` : `in ${deltaStr}`;
}
</script>

<style scoped>
ion-card {
  display: grid;
  column-gap: var(--spacer-base);
  grid-template-columns: 1fr auto;
  margin: ;
}

ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title meta" "subtitle meta";
}

ion-card-title {
  grid-area: title;
}

ion-card-subtitle {
  grid-area: subtitle;
}

.meta-data {
  grid-area: meta;
}

.actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: var(--spacer-base);
}

@media (max-width: 520px) {
  ion-card {
    display: block;
  }
}
</style>
