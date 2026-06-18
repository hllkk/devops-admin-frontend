<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'ArchiveActionDialog'
});

interface Props {
  visible: boolean;
  fileName: string;
  extractLoading?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'preview'): void;
  (e: 'extractHere'): void;
  (e: 'extractTo'): void;
}>();
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="查看压缩文件"
    style="width: 420px"
    :closable="true"
    @update:show="emit('update:visible', $event)"
  >
    <div class="flex items-center gap-2 mb-4 text-14px text-gray-500">
      <SvgIcon icon="mdi:folder-zip-outline" :size="24" />
      <span class="truncate">{{ fileName }}</span>
    </div>
    <div class="flex justify-center gap-3">
      <NButton :loading="extractLoading" :disabled="extractLoading" @click="emit('extractTo')">
        {{ $t('page.disk.contextMenu.extractTo') }}
      </NButton>
      <NButton :loading="extractLoading" :disabled="extractLoading" @click="emit('extractHere')">
        {{ $t('page.disk.contextMenu.extractHere') }}
      </NButton>
      <NButton type="primary" @click="emit('preview')">
        {{ $t('page.disk.contextMenu.previewArchive') }}
      </NButton>
    </div>
  </NModal>
</template>
