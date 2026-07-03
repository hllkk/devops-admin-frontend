<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'StatCard' });

interface Props {
  label: string;
  value: number | string;
  icon: string;
  trend?: string;
  accent?: 'primary' | 'success' | 'warning' | 'error';
}

const props = withDefaults(defineProps<Props>(), { accent: 'primary', trend: '' });

/**
 * accent 颜色映射
 *
 * 使用 inline style 绑定以避免 UnoCSS 任意值颜色在 lint/typecheck 阶段的潜在风险，
 * 同时保证暗/亮主题一致。颜色取自 Naive UI 调色板。
 */
const accentColor = computed(() => {
  const map: Record<NonNullable<Props['accent']>, string> = {
    primary: '#2080f0',
    success: '#18a058',
    warning: '#f0a020',
    error: '#d03050'
  };
  return map[props.accent];
});
</script>

<template>
  <div class="glass-card flex items-center gap-16px p-20px">
    <div
      class="flex-center size-48px rd-10px bg-white/10"
      :style="{ color: accentColor }"
    >
      <SvgIcon :icon="icon" class="size-24px" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-13px opacity-70">{{ label }}</div>
      <div class="text-26px font-600 tabular-nums">{{ value }}</div>
    </div>
    <div v-if="trend" class="shrink-0 text-12px opacity-60">{{ trend }}</div>
  </div>
</template>
