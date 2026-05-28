<script setup lang="ts">
import { computed, ref } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import FileIcon from './file-icon.vue';
import { formatFileSize } from '@/utils/format';

defineOptions({
  name: 'TransferModal'
});

interface Props {
  visible: boolean;
}

defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
}

const emit = defineEmits<Emits>();

const diskStore = useDiskStore();
const activeTab = ref<'upload' | 'download' | 'completed'>('upload');

const uploadItems = computed(() =>
  diskStore.transferList.filter(item => item.transferType === 'upload' && item.status !== 'completed')
);

const downloadItems = computed(() =>
  diskStore.transferList.filter(item => item.transferType === 'download' && item.status !== 'completed')
);

const completedItems = computed(() =>
  diskStore.transferList.filter(item => item.status === 'completed')
);

const currentItems = computed(() => {
  switch (activeTab.value) {
    case 'upload':
      return uploadItems.value;
    case 'download':
      return downloadItems.value;
    case 'completed':
      return completedItems.value;
    default:
      return [];
  }
});

function _handleClose() {
  emit('update:visible', false);
}

function handleClearCompleted() {
  diskStore.clearCompletedTransfers();
}

function handleRetry(_item: Api.Disk.TransferItem) {
  // TODO: 重试逻辑
}

function handleCancel(item: Api.Disk.TransferItem) {
  diskStore.removeTransferItem(item.transferId);
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    :title="$t('page.disk.transfer.title')"
    style="width: 400px; max-height: 500px"
    :bordered="false"
    @update:show="emit('update:visible', $event)"
  >
    <NTabs v-model:value="activeTab" type="line">
      <NTabPane name="upload" :tab="$t('page.disk.transfer.uploading') + ` (${uploadItems.length})`" />
      <NTabPane name="download" :tab="$t('page.disk.transfer.downloading') + ` (${downloadItems.length})`" />
      <NTabPane name="completed" :tab="$t('page.disk.transfer.completed') + ` (${completedItems.length})`" />
    </NTabs>

    <div class="transfer-list">
      <div v-for="item in currentItems" :key="item.transferId" class="transfer-item">
        <div class="transfer-item-header">
          <div class="transfer-item-info">
            <FileIcon :file-type="item.fileType" size="small" />
            <span class="transfer-item-name">{{ item.fileName }}</span>
          </div>
          <div class="transfer-item-status">
            <span v-if="item.status === 'completed'" class="status-success">
              {{ $t('page.disk.transfer.status.completed') }}
            </span>
            <span v-else-if="item.status === 'failed'" class="status-error">
              {{ $t('page.disk.transfer.status.failed') }}
            </span>
            <span v-else>{{ item.progress }}%</span>
          </div>
        </div>

        <NProgress
          v-if="item.status !== 'completed' && item.status !== 'failed'"
          type="line"
          :percentage="item.progress"
          :show-indicator="false"
          style="margin: 8px 0"
        />

        <div v-if="item.status !== 'completed'" class="transfer-item-detail">
          <span>{{ formatFileSize(item.speed) }}/s</span>
          <span>{{ $t('page.disk.transfer.remaining') }}: {{ item.remainingTime }}s</span>
        </div>

        <div v-if="item.status === 'failed'" class="transfer-item-actions">
          <NButton size="tiny" @click="handleRetry(item)">
            {{ $t('page.disk.transfer.actions.retry') }}
          </NButton>
          <NButton size="tiny" quaternary @click="handleCancel(item)">
            {{ $t('page.disk.transfer.actions.cancel') }}
          </NButton>
        </div>
      </div>

      <NEmpty v-if="currentItems.length === 0" :description="$t('common.noData')" />
    </div>

    <template #footer>
      <NSpace justify="space-between">
        <NButton quaternary size="small" @click="handleClearCompleted">
          {{ $t('page.disk.transfer.actions.clearCompleted') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.transfer-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}

.transfer-item {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: var(--n-color-hover);

  .transfer-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .transfer-item-info {
      display: flex;
      align-items: center;
      gap: 8px;

      .transfer-item-name {
        font-size: 13px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .transfer-item-status {
      font-size: 12px;

      .status-success {
        color: var(--n-success-color);
      }
      .status-error {
        color: var(--n-error-color);
      }
    }
  }

  .transfer-item-detail {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--n-text-color-disabled);
  }

  .transfer-item-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
}
</style>
