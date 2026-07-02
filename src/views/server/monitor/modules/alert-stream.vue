<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { NEmpty, NTag } from 'naive-ui';
import { $t } from '@/locales';

defineOptions({ name: 'AlertStream' });

interface Props {
  alerts: Api.Server.AlertItem[];
}

const props = defineProps<Props>();

const listRef = ref<HTMLElement | null>(null);
const prefersReduced = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

/** 告警级别 -> NTag type 映射 */
function tagOf(level: Api.Server.AlertLevel): 'error' | 'warning' | 'info' {
  const map: Record<Api.Server.AlertLevel, 'error' | 'warning' | 'info'> = {
    critical: 'error',
    warning: 'warning',
    info: 'info'
  };
  return map[level];
}

const hasAlerts = computed(() => props.alerts.length > 0);

/** 自动滚动一步：到底回到顶部，否则向下推进 1px */
function scrollStep() {
  const el = listRef.value;
  if (!el) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
    el.scrollTop = 0;
  } else {
    el.scrollTop += 1;
  }
}

onMounted(() => {
  prefersReduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced.value) {
    timer = setInterval(scrollStep, 60);
  }
});

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>

<template>
  <div ref="listRef" class="h-full overflow-hidden">
    <template v-if="hasAlerts">
      <div
        v-for="a in alerts"
        :key="a.id"
        class="flex items-center gap-12px border-b border-white/5 px-16px py-12px"
      >
        <NTag :type="tagOf(a.level)" size="small" round>{{ a.level }}</NTag>
        <div class="min-w-0 flex-1 truncate text-14px">{{ a.title }}</div>
        <div class="shrink-0 text-12px opacity-50">{{ a.source }}</div>
      </div>
    </template>
    <NEmpty v-else class="py-40px" :description="$t('common.noData')" />
  </div>
</template>
