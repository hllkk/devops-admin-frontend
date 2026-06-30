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

interface RoleOption {
  label: string;
  value: Api.Disk.ShareRole;
  hint: string;
}

const roleOptions = computed<RoleOption[]>(() => [
  { label: $t('page.disk.sharedWithMe.roleViewer'), value: 'viewer', hint: $t('page.disk.sharedWithMe.permHintViewer') },
  { label: $t('page.disk.sharedWithMe.roleEditor'), value: 'editor', hint: $t('page.disk.sharedWithMe.permHintEditor') }
]);

function handleChange(value: Api.Disk.ShareRole) {
  emit('update:role', value);
}
</script>

<template>
  <NRadioGroup :value="props.role" :disabled="disabled" @update:value="handleChange">
    <NSpace :size="16" align="center">
      <div v-for="opt in roleOptions" :key="opt.value" class="flex items-center gap-4px">
        <NRadio :value="opt.value">
          {{ opt.label }}
        </NRadio>
        <NTooltip>
          <template #trigger>
            <span class="icon-[mdi--help-circle-outline] text-14px text-gray-400 cursor-help" />
          </template>
          {{ opt.hint }}
        </NTooltip>
      </div>
    </NSpace>
  </NRadioGroup>
</template>
