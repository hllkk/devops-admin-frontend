<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import VerticalMenu from './modules/vertical-menu.vue';
import VerticalMixMenu from './modules/vertical-mix-menu.vue';
import VerticalHybridHeaderFirst from './modules/vertical-hybrid-header-first.vue';
import HorizontalMenu from './modules/horizontal-menu.vue';
import TopHybridSidebarFirst from './modules/top-hybrid-sidebar-first.vue';
import TopHybridHeaderFirst from './modules/top-hybrid-header-first.vue';

defineOptions({
  name: 'GlobalMenu'
});

/**
 * Optional mode prop: passed in by BaseLayout as the module-overridden layout
 * mode (effectiveLayoutMode), so a module with a fixed mode (e.g. server=horizontal)
 * overrides the user's global theme. Falls back to the global theme when unset.
 */
const props = defineProps<{ mode?: UnionKey.ThemeLayoutMode }>();

const appStore = useAppStore();
const themeStore = useThemeStore();

const activeLayoutMode = computed(() => props.mode ?? themeStore.layout.mode);

const activeMenu = computed(() => {
  const menuMap: Record<UnionKey.ThemeLayoutMode, Component> = {
    vertical: VerticalMenu,
    'vertical-mix': VerticalMixMenu,
    'vertical-hybrid-header-first': VerticalHybridHeaderFirst,
    horizontal: HorizontalMenu,
    'top-hybrid-sidebar-first': TopHybridSidebarFirst,
    'top-hybrid-header-first': TopHybridHeaderFirst
  };

  return menuMap[activeLayoutMode.value];
});

const reRenderVertical = computed(() => activeLayoutMode.value === 'vertical' && appStore.isMobile);
</script>

<template>
  <component :is="activeMenu" :key="reRenderVertical" />
</template>

<style scoped></style>
