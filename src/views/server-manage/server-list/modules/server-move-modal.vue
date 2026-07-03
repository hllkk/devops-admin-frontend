<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchMoveServers } from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerMoveModal' });

interface Props {
  serverCount: number;
  serverIds: CommonType.IdType[];
  excludeGroupId: CommonType.IdType;
  groupOptions: { id: CommonType.IdType; name: string }[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });
const targetGroupId = ref<CommonType.IdType | null>(null);
const submitting = ref(false);

watch(visible, val => {
  if (val) {
    targetGroupId.value = null;
  }
});

async function handleConfirm() {
  if (!targetGroupId.value) {
    window.$message?.warning($t('page.server.form.groupId.required'));
    return;
  }
  if (targetGroupId.value === props.excludeGroupId) {
    window.$message?.warning($t('page.server.move.excludeCurrent'));
    return;
  }
  submitting.value = true;
  const { error } = await fetchMoveServers({
    ids: props.serverIds,
    targetGroupId: targetGroupId.value
  });
  submitting.value = false;
  if (error) {
    window.$message?.error(error.message);
    return;
  }
  window.$message?.success($t('page.server.move.success'));
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="$t('page.server.move.title')" :style="{ width: '420px' }">
    <NAlert type="info" :show-icon="false" class="mb-12px">
      {{ $t('page.server.move.description', { count: serverCount }) }}
    </NAlert>
    <NFormItem :label="$t('page.server.move.target')">
      <NSelect
        v-model:value="targetGroupId"
        :options="groupOptions"
        label-field="name"
        value-field="id"
        :placeholder="$t('page.server.move.target')"
      />
    </NFormItem>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">{{ $t('page.server.move.cancel') }}</NButton>
        <NButton type="primary" :loading="submitting" @click="handleConfirm">
          {{ $t('page.server.move.confirm') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
