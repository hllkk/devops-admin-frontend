<script setup lang="ts">
defineOptions({ name: 'MetricBar' });

interface Props {
  /** 0-100 */
  value: number;
  label?: string;
}

const props = defineProps<Props>();

function colorOf(v: number): string {
  return v >= 85 ? '#d03050' : v >= 65 ? '#f0a020' : '#18a058';
}

function widthOf(v: number): string {
  const clamped = Math.max(0, Math.min(100, v));
  return `${clamped}%`;
}
</script>

<template>
  <div class="flex items-center gap-8px">
    <span v-if="props.label" class="w-30px shrink-0 text-12px opacity-60">{{ props.label }}</span>
    <div class="h-6px flex-1 overflow-hidden rd-full bg-white/10">
      <div
        class="h-full rd-full transition-all duration-300 ease-out"
        :style="{ width: widthOf(props.value), background: colorOf(props.value) }"
      ></div>
    </div>
    <span class="w-40px shrink-0 text-right text-12px tabular-nums">{{ props.value }}%</span>
  </div>
</template>

<style scoped></style>
