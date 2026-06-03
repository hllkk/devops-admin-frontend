<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { $t } from '@/locales';

defineOptions({
  name: 'ShareTargetItem'
});

interface Props {
  id: number;
  targetId: number;
  targetName: string;
  targetType: 'user' | 'dept';
  permissions: string[];
  avatar?: string;
  editing?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  avatar: undefined,
  editing: false
});

interface Emits {
  (e: 'update', id: number, permissions: string[]): void;
  (e: 'remove', id: number): void;
}

const emit = defineEmits<Emits>();

const isEditing = ref(props.editing);
const currentPermissions = ref([...props.permissions]);

const permLabelMap: Record<string, string> = {
  DOWNLOAD: $t('page.disk.sharedWithMe.permDownload'),
  UPLOAD: $t('page.disk.sharedWithMe.permUpload'),
  PUT: $t('page.disk.sharedWithMe.permEdit'),
  DELETE: $t('page.disk.sharedWithMe.permDelete')
};

const permissionOptions = computed(() => {
  const all = [
    { label: permLabelMap.DOWNLOAD, value: 'DOWNLOAD' },
    { label: permLabelMap.UPLOAD, value: 'UPLOAD' },
    { label: permLabelMap.PUT, value: 'PUT' },
    { label: permLabelMap.DELETE, value: 'DELETE' }
  ];
  return all;
});

function handleStartEdit() {
  currentPermissions.value = [...props.permissions];
  isEditing.value = true;
}

function handleCancelEdit() {
  isEditing.value = false;
  currentPermissions.value = [...props.permissions];
}

function handleSaveEdit() {
  emit('update', props.id, currentPermissions.value);
  isEditing.value = false;
}

function handleTogglePermission(perm: string) {
  const idx = currentPermissions.value.indexOf(perm);
  if (idx >= 0) {
    currentPermissions.value.splice(idx, 1);
  } else {
    currentPermissions.value.push(perm);
  }
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
      <div class="flex gap-8px">
        <NCheckbox
          v-for="opt in permissionOptions"
          :key="opt.value"
          :checked="currentPermissions.includes(opt.value)"
          @update:checked="handleTogglePermission(opt.value)"
        >
          {{ opt.label }}
        </NCheckbox>
      </div>
      <NButton size="tiny" class="ml-12px" @click="handleCancelEdit">
        {{ $t('common.cancel') }}
      </NButton>
      <NButton size="tiny" type="primary" @click="handleSaveEdit">
        {{ $t('common.save') }}
      </NButton>
    </template>

    <template v-else>
      <div class="flex gap-4px">
        <NTag
          v-for="perm in permissions"
          :key="perm"
          size="tiny"
          :bordered="false"
          type="info"
        >
          {{ permLabelMap[perm] || perm }}
        </NTag>
      </div>
      <NButton size="tiny" class="ml-12px" @click="handleStartEdit">
        {{ $t('common.modify') }}
      </NButton>
      <NButton size="tiny" type="error" @click="handleRemove">
        {{ $t('page.disk.share.cancelShare') }}
      </NButton>
    </template>
  </div>
</template>
