<script setup lang="ts">
import { computed } from 'vue';
import { useRouteStore } from '@/store/modules/route';
import BaseLayout from '@/layouts/base-layout/index.vue';
import DiskLayout from '@/layouts/disk-layout/index.vue';

defineOptions({
  name: 'AutoLayout'
});

const routeStore = useRouteStore();

const currentLayout = computed(() => (routeStore.currentModule === 'disk' ? DiskLayout : BaseLayout));
</script>

<template>
  <component :is="currentLayout" />
</template>
