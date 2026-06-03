<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { formatFileSize } from '@/utils/format';
import FileIcon from '../file-icon.vue';
import ShareToUser from './share-to-user.vue';
import ShareToDept from './share-to-dept.vue';

defineOptions({
  name: 'ShareDialogIndex'
});

const diskStore = useDiskStore();

const activeTab = ref<'user' | 'dept'>('user');

const shareFile = computed(() => diskStore.shareFile);

const fileInfo = computed(() => {
  if (!shareFile.value) return null;
  return {
    name: shareFile.value.fileName,
    type: shareFile.value.isFolder ? 'folder' : shareFile.value.fileType,
    extension: shareFile.value.fileExtension,
    size: shareFile.value.fileSize
  };
});

const fileId = computed(() => {
  if (!shareFile.value) return 0;
  return typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10)
    : shareFile.value.fileId;
});

function handleClose() {
  diskStore.closeShareDialog();
}

watch(() => diskStore.shareDialogVisible, visible => {
  if (visible) {
    activeTab.value = 'user';
  }
});
</script>

<template>
  <NModal
    v-model:show="diskStore.shareDialogVisible"
    preset="card"
    :title="$t('page.disk.share.configTitle')"
    style="width: 90%; max-width: 640px"
    :mask-closable="false"
    :bordered="false"
  >
    <div class="flex flex-col gap-16px">
      <!-- 文件信息 -->
      <div v-if="fileInfo" class="flex items-center gap-12px p-12px rounded bg-gray-50 dark:bg-gray-800">
        <FileIcon
          :file-type="fileInfo.type"
          :extension="fileInfo.extension"
          size="medium"
        />
        <div class="flex-1 min-w-0">
          <div class="text-14px font-medium truncate">{{ fileInfo.name }}</div>
          <div class="text-12px opacity-60">
            {{ fileInfo.type === 'folder' ? $t('page.disk.file.folder') : formatFileSize(fileInfo.size) }}
          </div>
        </div>
      </div>

      <!-- Share Type Tabs -->
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- Share to User Tab -->
        <NTabPane name="user" :tab="$t('page.disk.share.shareToUser')">
          <ShareToUser v-if="fileId > 0" :file-id="fileId" />
        </NTabPane>

        <!-- Share to Dept Tab -->
        <NTabPane name="dept" :tab="$t('page.disk.share.shareToDept')">
          <ShareToDept v-if="fileId > 0" :file-id="fileId" />
        </NTabPane>
      </NTabs>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <NButton @click="handleClose">{{ $t('common.close') }}</NButton>
      </div>
    </template>
  </NModal>
</template>
