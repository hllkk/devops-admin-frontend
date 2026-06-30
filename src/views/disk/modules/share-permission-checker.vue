<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '@/locales';

defineOptions({
  name: 'SharePermissionChecker'
});

interface Props {
  role: Api.Disk.ShareRole;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

interface Emits {
  (e: 'update:role', value: Api.Disk.ShareRole): void;
}

const emit = defineEmits<Emits>();

const roleOptions = computed(() => [
  { label: $t('page.disk.sharedWithMe.roleViewer'), value: 'viewer' as const },
  { label: $t('page.disk.sharedWithMe.roleEditor'), value: 'editor' as const },
  { label: $t('page.disk.sharedWithMe.roleOwner'), value: 'owner' as const }
]);

function handleChange(value: Api.Disk.ShareRole) {
  emit('update:role', value);
}
</script>

<template>
  <NRadioGroup :value="props.role" :disabled="disabled" @update:value="handleChange">
    <NSpace :size="16">
      <NRadio v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </NRadio>
    </NSpace>
  </NRadioGroup>
</template>
