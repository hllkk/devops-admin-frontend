<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchTransferStorageLibrary } from '@/service/api/disk/storage';
import { fetchGetUserList } from '@/service/api/system/user';
import { $t } from '@/locales';

defineOptions({ name: 'TransferModal' });

const props = defineProps<{
  visible: boolean;
  library: Api.Disk.StorageAdmin.LibraryItem | null;
}>();
const emit = defineEmits<{
  'update:visible': [boolean];
  submitted: [];
}>();

const visibleModel = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v)
});

const targetUserId = ref<number | null>(null);
const includeTrash = ref(false);
const inheritShares = ref(true);
const folderName = ref('');
const submitting = ref(false);
const lastResult = ref<Api.Disk.StorageAdmin.TransferLibraryResponse | null>(null);
const userOptions = ref<{ label: string; value: number }[]>([]);

watch(
  () => props.visible,
  async v => {
    if (v && props.library) {
      targetUserId.value = null;
      includeTrash.value = false;
      inheritShares.value = true;
      folderName.value = `${props.library.nickName}的交接文件`;
      lastResult.value = null;
      await loadUsers();
    }
  }
);

async function loadUsers() {
  try {
    const res = await fetchGetUserList({ pageNum: 1, pageSize: 999 });
    const paginated = res.data as { rows?: { id: number; userName: string; nickName: string; status: string }[] } | null;
    const rows = paginated?.rows ?? [];
    userOptions.value = rows
      .filter(u => u.status === '1' && (!props.library || u.id !== props.library.userId))
      .map(u => ({ label: `${u.nickName}(${u.userName})`, value: u.id }));
  } catch {
    userOptions.value = [];
  }
}

async function handleSubmit() {
  if (!props.library || !targetUserId.value) return;
  submitting.value = true;
  try {
    const { data, error } = await fetchTransferStorageLibrary({
      sourceUserId: props.library.userId,
      targetUserId: targetUserId.value,
      options: {
        includeTrash: includeTrash.value,
        inheritShares: inheritShares.value,
        folderName: folderName.value
      }
    });
    if (error) return;
    lastResult.value = data;
    window.$message?.success('转让成功');
    emit('submitted');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="visibleModel" preset="card" title="转让资料库(所有权交接)" class="w-600px">
    <NSpace v-if="library" vertical :size="16">
      <NDescriptions label-placement="left" bordered :column="1" size="small">
        <NDescriptionsItem label="源用户">{{ library.nickName }}({{ library.userName }})</NDescriptionsItem>
        <NDescriptionsItem label="文件数">{{ library.totalFiles }}</NDescriptionsItem>
        <NDescriptionsItem label="总大小">{{ library.totalSize }} B</NDescriptionsItem>
      </NDescriptions>

      <NForm label-placement="left" :label-width="100">
        <NFormItem label="接手人" required>
          <NSelect v-model:value="targetUserId" :options="userOptions" placeholder="选择接手用户" filterable />
        </NFormItem>
        <NFormItem label="交接文件夹">
          <NInput v-model:value="folderName" placeholder="留空使用默认名" />
        </NFormItem>
        <NFormItem label="继承共享">
          <NSwitch v-model:value="inheritShares" />
          <span class="ml-8px text-12px">目标用户成为新共享发起人</span>
        </NFormItem>
        <NFormItem label="含回收站">
          <NSwitch v-model:value="includeTrash" />
          <span class="ml-8px text-12px">关闭则清空源用户回收站</span>
        </NFormItem>
      </NForm>

      <NAlert v-if="lastResult" type="success" :show-icon="false">
        已转移 {{ lastResult.fileCount }} 个文件到「{{ lastResult.folderName }}」
        <span v-if="lastResult.quotaExceeded" class="text-error">(接手人配额已超额)</span>
      </NAlert>
    </NSpace>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="visibleModel = false">取消</NButton>
        <NPopconfirm @positive-click="handleSubmit">
          <template #trigger>
            <NButton type="error" :loading="submitting" :disabled="!targetUserId">确认转让</NButton>
          </template>
          确认将资料库所有权转让给接手人?此操作不可逆。
        </NPopconfirm>
      </NSpace>
    </template>
  </NModal>
</template>
