<script setup lang="ts">
import { $t } from '@/locales';
import { formatDateTime } from '@/utils/format';

defineOptions({
  name: 'OperationDetailDrawer'
});

interface Props {
  rowData: Api.System.OperationLog | null;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const title = '操作日志详情';

const businessTypeMap: Record<number, string> = {
  0: '其他',
  1: '新增',
  2: '修改',
  3: '删除',
  4: '授权',
  5: '导出',
  6: '导入',
  7: '强退',
  8: '生成代码',
  9: '清空数据'
};

function closeDrawer() {
  visible.value = false;
}
</script>

<script lang="ts">
function formatJson(str: string | undefined): string {
  if (!str) return '';
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

const isMobile = window.innerWidth < 640;
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="800" class="max-w-90%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NDescriptions label-placement="left" :column="isMobile ? 1 : 2" size="small" bordered>
        <NDescriptionsItem label="系统模块">
          {{ props.rowData?.title }}
        </NDescriptionsItem>
        <NDescriptionsItem label="操作类型">
          <NSpace :size="8">
            <NTag
              :type="props.rowData?.businessType === 1 ? 'success' : props.rowData?.businessType === 3 ? 'error' : props.rowData?.businessType === 2 ? 'primary' : 'default'"
              size="small"
            >
              {{ businessTypeMap[props.rowData?.businessType ?? 0] || '未知' }}
            </NTag>
            <NTag :bordered="false" size="small">
              {{ props.rowData?.requestMethod }}
            </NTag>
          </NSpace>
        </NDescriptionsItem>
        <NDescriptionsItem label="操作人员">
          {{ props.rowData?.operName }}
        </NDescriptionsItem>
        <NDescriptionsItem label="操作IP">
          {{ props.rowData?.operIp }}
        </NDescriptionsItem>
        <NDescriptionsItem label="操作地点">
          {{ props.rowData?.operLocation }}
        </NDescriptionsItem>
        <NDescriptionsItem label="请求路径" :span="2">
          {{ props.rowData?.operUrl }}
        </NDescriptionsItem>
        <NDescriptionsItem label="执行时长">
          {{ props.rowData?.costTime }}ms
        </NDescriptionsItem>
        <NDescriptionsItem label="状态">
          <NTag :type="props.rowData?.status === 0 ? 'success' : 'error'" size="small">
            {{ props.rowData?.status === 0 ? '成功' : '失败' }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem v-if="props.rowData?.errorMsg" label="错误信息" :span="2">
          <NText type="error">{{ props.rowData?.errorMsg }}</NText>
        </NDescriptionsItem>
        <NDescriptionsItem label="操作时间" :span="2">
          {{ formatDateTime(props.rowData?.operTime) }}
        </NDescriptionsItem>
      </NDescriptions>

      <NDivider v-if="props.rowData?.operParam" title-placement="left">请求参数</NDivider>
      <NCode v-if="props.rowData?.operParam" :code="formatJson(props.rowData?.operParam)" language="json" word-wrap />

      <NDivider v-if="props.rowData?.jsonResult" title-placement="left">响应结果</NDivider>
      <NCode v-if="props.rowData?.jsonResult" :code="formatJson(props.rowData?.jsonResult)" language="json" word-wrap />

      <template #footer>
        <NSpace :size="16">
          <NButton @click="closeDrawer">{{ $t('common.close') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
