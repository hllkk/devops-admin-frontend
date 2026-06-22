<script setup lang="ts">
import ShareListPage from '../shared-with-me/modules/share-list-page.vue';

defineOptions({ name: 'GroupSharePage' });
</script>

<template>
  <ShareListPage share-type="dept" :show-filter="true" />
</template>
