<script setup lang="ts">
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/format';

defineOptions({
  name: 'FileAuditDetailDrawer'
});

interface Props {
  rowData: Api.Disk.FileAuditLog | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { default: false });

const title = '文件操作日志详情';

const operationTypeMap: Record<string, string> = {
  upload: '上传',
  download: '下载',
  stream: '流媒体',
  preview: '预览',
  create_folder: '新建文件夹',
  delete: '删除',
  restore: '还原',
  purge: '彻底删除',
  rename: '重命名',
  move: '移动',
  copy: '复制',
  share_create: '创建分享',
  share_revoke: '取消分享',
  share_access: '访问分享',
  favorite: '收藏',
  unfavorite: '取消收藏',
  permission: '权限变更',
  quota: '配额变更'
};

const statusTypeMap: Record<string, 'success' | 'error' | 'warning'> = {
  success: 'success',
  failed: 'error',
  partial: 'warning'
};

function closeDrawer() {
  visible.value = false;
}
</script>

<script lang="ts">
const isMobile = window.innerWidth < 640;
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="800" class="max-w-90%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NDescriptions label-placement="left" :column="isMobile ? 1 : 2" size="small" bordered>
        <NDescriptionsItem :label="$t('page.system.fileLog.operationType')">
          <NTag size="small">{{ operationTypeMap[props.rowData?.operationType ?? ''] ?? props.rowData?.operationType }}</NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.status')">
          <NTag :type="statusTypeMap[props.rowData?.status ?? ''] ?? 'default'" size="small">
            {{ props.rowData?.status }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.operName')">{{ props.rowData?.operName }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.source')">{{ props.rowData?.source }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.fileName')" :span="2">{{ props.rowData?.fileName }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.filePath')" :span="2">{{ props.rowData?.filePath }}</NDescriptionsItem>
        <NDescriptionsItem v-if="props.rowData?.targetFilePath" :label="$t('page.system.fileLog.targetFilePath')" :span="2">
          {{ props.rowData?.targetFilePath }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.fileSize')">{{ props.rowData?.fileSize }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.duration')">{{ props.rowData?.duration }}ms</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.operIp')">{{ props.rowData?.ip }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.operLocation')">{{ props.rowData?.location }}</NDescriptionsItem>
        <NDescriptionsItem v-if="props.rowData?.errorMessage" :label="$t('page.system.fileLog.errorMessage')" :span="2">
          <NText type="error">{{ props.rowData?.errorMessage }}</NText>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.system.fileLog.createdAt')" :span="2">
          {{ formatDateTime(props.rowData?.createdAt) }}
        </NDescriptionsItem>
      </NDescriptions>

      <template #footer>
        <NSpace :size="16">
          <NButton @click="closeDrawer">{{ $t('common.close') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
