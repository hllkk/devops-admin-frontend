<script setup lang="ts">
import BaseLayout from '@/layouts/base-layout/index.vue';

defineOptions({
  name: 'AutoLayout'
});
</script>

<template>
  <!-- disk 模块复用 BaseLayout，由 useLayoutPreset 按路径自动切换到 workbench 预设 -->
  <BaseLayout />
</template>
