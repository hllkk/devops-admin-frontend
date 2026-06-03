<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '@/locales';

defineOptions({
  name: 'SharePermissionChecker'
});

interface Props {
  permissions: string[];
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

interface Emits {
  (e: 'update:permissions', value: string[]): void;
}

const emit = defineEmits<Emits>();

const permissionOptions = computed(() => [
  { label: $t('page.disk.sharedWithMe.permDownload'), value: 'DOWNLOAD' },
  { label: $t('page.disk.sharedWithMe.permUpload'), value: 'UPLOAD' },
  { label: $t('page.disk.sharedWithMe.permEdit'), value: 'PUT' },
  { label: $t('page.disk.sharedWithMe.permDelete'), value: 'DELETE' }
]);

function handleCheck(checked: boolean, value: string) {
  const updated = [...props.permissions];
  if (checked) {
    if (!updated.includes(value)) {
      updated.push(value);
    }
  } else {
    const idx = updated.indexOf(value);
    if (idx >= 0) {
      updated.splice(idx, 1);
    }
  }
  emit('update:permissions', updated);
}
</script>

<template>
  <NCheckboxGroup :value="permissions">
    <NSpace :size="16">
      <NCheckbox
        v-for="opt in permissionOptions"
        :key="opt.value"
        :checked="permissions.includes(opt.value)"
        :disabled="disabled"
        @update:checked="(checked: boolean) => handleCheck(checked, opt.value)"
      >
        {{ opt.label }}
      </NCheckbox>
    </NSpace>
  </NCheckboxGroup>
</template>
