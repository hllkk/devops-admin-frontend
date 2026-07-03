<script setup lang="ts">
import { NEmpty, NSpin, NTag } from 'naive-ui';
import { $t } from '@/locales';

defineOptions({ name: 'RecentAlertList' });

interface Props {
  alerts: Api.Server.AlertItem[];
  loading?: boolean;
}

withDefaults(defineProps<Props>(), { loading: false });

/** 告警级别 -> NTag 配置映射 */
function tagOf(level: Api.Server.AlertLevel): { type: 'error' | 'warning' | 'info'; label: string } {
  const map: Record<Api.Server.AlertLevel, { type: 'error' | 'warning' | 'info'; label: string }> = {
    critical: { type: 'error', label: 'Critical' },
    warning: { type: 'warning', label: 'Warning' },
    info: { type: 'info', label: 'Info' }
  };
  return map[level];
}
</script>

<template>
  <div class="h-full overflow-auto">
    <NSpin :show="loading">
      <template v-if="alerts.length">
        <div
          v-for="a in alerts"
          :key="a.id"
          class="flex items-center gap-12px border-b border-white/5 px-12px py-10px"
        >
          <NTag :type="tagOf(a.level).type" size="small" round>
            {{ tagOf(a.level).label }}
          </NTag>
          <div class="min-w-0 flex-1 truncate text-14px">{{ a.title }}</div>
          <div class="shrink-0 text-12px opacity-50">{{ a.source }}</div>
        </div>
      </template>
      <NEmpty v-else class="py-40px" :description="$t('common.noData')" />
    </NSpin>
  </div>
</template>
