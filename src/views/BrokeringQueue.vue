<template>
  <WorkflowOrderList
    bucket="brokering"
    title="Brokering queue"
    search-placeholder="Order, external ID, customer"
    empty-title="No orders awaiting brokering"
    empty-message="Approved orders waiting to be brokered to a facility will appear here."
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/WorkflowOrderList.vue';
</script>
