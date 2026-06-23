<script setup lang="ts">
import { computed } from 'vue';
import { useSystemConfigStore } from '@/store/modules/system-config';
import { useModuleHome } from '@/hooks/common/router';

defineOptions({
  name: 'GlobalLogo'
});

interface Props {
  /** Whether to show the title */
  showTitle?: boolean;
}

withDefaults(defineProps<Props>(), {
  showTitle: true
});

const systemConfigStore = useSystemConfigStore();
const { moduleHomeName } = useModuleHome();

const systemName = computed(() => systemConfigStore.getSystemName());
const logoUrl = computed(() => systemConfigStore.getLogoUrl());
</script>

<template>
  <RouterLink :to="{ name: moduleHomeName }" class="w-full flex-center nowrap-hidden">
    <!-- 有自定义 Logo 时显示图片 -->
    <img v-if="logoUrl" :src="logoUrl" class="size-32px" alt="logo" />
    <!-- 否则显示默认 SVG Logo -->
    <SystemLogo v-else class="size-32px" />
    <!-- 系统名称 -->
    <h2 v-show="showTitle" class="pl-8px text-16px text-primary font-bold transition duration-300 ease-in-out">
      {{ systemName }}
    </h2>
  </RouterLink>
</template>

<style scoped></style>
