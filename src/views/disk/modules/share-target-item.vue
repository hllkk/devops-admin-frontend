<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { $t } from '@/locales';

defineOptions({
  name: 'ShareTargetItem'
});

interface Props {
  id: number;
  fileShareId: number;
  targetName: string;
  targetType: 'user' | 'dept';
  role: Api.Disk.ShareRole;
  avatar?: string;
  editing?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  avatar: undefined,
  editing: false
});

interface Emits {
  (e: 'update', fileShareId: number, role: Api.Disk.ShareRole): void;
  (e: 'remove', id: number): void;
}

const emit = defineEmits<Emits>();

const isEditing = ref(props.editing);
const currentRole = ref<Api.Disk.ShareRole>(props.role);

const roleOptions = computed(() => [
  { label: $t('page.disk.sharedWithMe.roleViewer'), value: 'viewer' as const },
  { label: $t('page.disk.sharedWithMe.roleEditor'), value: 'editor' as const },
  { label: $t('page.disk.sharedWithMe.roleOwner'), value: 'owner' as const }
]);

const roleTagTypeMap: Record<Api.Disk.ShareRole, 'success' | 'warning' | 'error'> = {
  viewer: 'success',
  editor: 'warning',
  owner: 'error'
};

const roleLabel = computed(() => {
  const map: Record<Api.Disk.ShareRole, string> = {
    viewer: $t('page.disk.sharedWithMe.roleViewer'),
    editor: $t('page.disk.sharedWithMe.roleEditor'),
    owner: $t('page.disk.sharedWithMe.roleOwner')
  };
  return map[props.role];
});

function handleStartEdit() {
  currentRole.value = props.role;
  isEditing.value = true;
}

function handleCancelEdit() {
  isEditing.value = false;
  currentRole.value = props.role;
}

function handleSaveEdit() {
  emit('update', props.fileShareId, currentRole.value);
  isEditing.value = false;
}

function handleRemove() {
  window.$dialog?.warning({
    title: $t('common.confirm'),
    content: $t('page.disk.myShare.cancelConfirm'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: () => {
      emit('remove', props.id);
    }
  });
}

function renderTargetIcon() {
  if (props.targetType === 'dept') {
    return h('div', { class: 'w-20px h-20px rd-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-11px shrink-0' }, [
      h('span', { class: 'icon-[mdi--office-building] text-14px' })
    ]);
  }

  if (props.avatar) {
    return h('img', {
      src: props.avatar,
      class: 'w-20px h-20px rd-full object-cover shrink-0 bg-gray-200'
    });
  }

  return h('div', { class: 'w-20px h-20px rd-full bg-primary/20 text-primary flex items-center justify-center text-11px shrink-0' }, [
    props.targetName.charAt(0).toUpperCase()
  ]);
}
</script>

<template>
  <div class="flex items-center gap-8px px-12px py-8px rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
    <component :is="renderTargetIcon()" />
    <span class="flex-1 truncate text-13px">{{ targetName }}</span>

    <template v-if="isEditing">
      <NSelect
        v-model:value="currentRole"
        size="small"
        :options="roleOptions"
        class="w-100px"
      />
      <NButton size="tiny" class="ml-12px" @click="handleCancelEdit">
        {{ $t('common.cancel') }}
      </NButton>
      <NButton size="tiny" type="primary" @click="handleSaveEdit">
        {{ $t('common.save') }}
      </NButton>
    </template>

    <template v-else>
      <NTag
        size="tiny"
        :bordered="false"
        :type="roleTagTypeMap[role]"
      >
        {{ roleLabel }}
      </NTag>
      <NButton size="tiny" class="ml-12px" @click="handleStartEdit">
        {{ $t('common.modify') }}
      </NButton>
      <NButton size="tiny" type="error" @click="handleRemove">
        {{ $t('page.disk.share.cancelShare') }}
      </NButton>
    </template>
  </div>
</template>
