<template>
  <WorkflowOrderList
    bucket="unfillable"
    title="Unfillable"
    search-placeholder="Order, external ID, customer"
    empty-title="No unfillable orders"
    empty-message="Orders that could not be brokered to any facility will appear here."
  />
</template>

<script setup lang="ts">
import WorkflowOrderList from '@/components/WorkflowOrderList.vue';
</script>
