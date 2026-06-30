<script setup lang="ts">
import { ref, watch } from 'vue';
import { $t } from '@/locales';

defineOptions({
  name: 'UploadConflictDialog'
});

interface ConflictEntry {
  fileName: string;
  targetPath: string;
}

type ConflictAction = 'keepBoth' | 'overwrite' | 'skip';

interface Props {
  visible: boolean;
  conflicts: ConflictEntry[];
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', decisions: Map<string, ConflictAction>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

/** 每个文件的决策：fileName → action */
const decisions = ref<Record<string, ConflictAction>>({});

watch(
  () => props.visible,
  visible => {
    if (visible) {
      // 默认全部"保留两者"
      const map: Record<string, ConflictAction> = {};
      for (const c of props.conflicts) {
        map[c.fileName + '@' + c.targetPath] = 'keepBoth';
      }
      decisions.value = map;
    }
  }
);

function entryKey(entry: ConflictEntry): string {
  return entry.fileName + '@' + entry.targetPath;
}

function setAction(entry: ConflictEntry, action: ConflictAction) {
  decisions.value[entryKey(entry)] = action;
}

function setAllAction(action: ConflictAction) {
  for (const c of props.conflicts) {
    decisions.value[entryKey(c)] = action;
  }
}

function handleConfirm() {
  const result = new Map<string, ConflictAction>();
  for (const c of props.conflicts) {
    const key = entryKey(c);
    result.set(key, decisions.value[key] || 'keepBoth');
  }
  emit('confirm', result);
}

function handleClose() {
  emit('update:visible', false);
}

function getAction(entry: ConflictEntry): ConflictAction {
  return decisions.value[entryKey(entry)] || 'keepBoth';
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    :title="$t('page.disk.uploadConflict.title')"
    style="width: 90%; max-width: 640px"
    :mask-closable="false"
    :bordered="false"
    @update:show="handleClose"
  >
    <div class="flex flex-col gap-12px">
      <!-- 提示信息 -->
      <div class="text-14px opacity-70">
        {{ $t('page.disk.uploadConflict.description', { count: conflicts.length }) }}
      </div>

      <!-- 批量操作按钮 -->
      <div class="flex gap-8px">
        <NButton size="small" @click="setAllAction('keepBoth')">
          {{ $t('page.disk.uploadConflict.keepBothAll') }}
        </NButton>
        <NButton size="small" type="warning" @click="setAllAction('overwrite')">
          {{ $t('page.disk.uploadConflict.overwriteAll') }}
        </NButton>
        <NButton size="small" @click="setAllAction('skip')">
          {{ $t('page.disk.uploadConflict.skipAll') }}
        </NButton>
      </div>

      <!-- 冲突文件列表 -->
      <NScrollbar style="max-height: 360px">
        <div class="flex flex-col gap-6px">
          <div
            v-for="entry in conflicts"
            :key="entryKey(entry)"
            class="flex items-center gap-8px p-10px rounded border border-[var(--border-color)]"
          >
            <SvgIcon icon="mdi:file-alert-outline" :size="20" class="text-amber-500 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-14px font-medium truncate">{{ entry.fileName }}</div>
              <div class="text-12px opacity-50 truncate">{{ entry.targetPath }}</div>
            </div>
            <NButtonGroup size="tiny">
              <NButton
                :type="getAction(entry) === 'keepBoth' ? 'primary' : 'default'"
                @click="setAction(entry, 'keepBoth')"
              >
                {{ $t('page.disk.duplicateFile.keepBoth') }}
              </NButton>
              <NButton
                :type="getAction(entry) === 'overwrite' ? 'warning' : 'default'"
                @click="setAction(entry, 'overwrite')"
              >
                {{ $t('page.disk.duplicateFile.overwrite') }}
              </NButton>
              <NButton
                :type="getAction(entry) === 'skip' ? 'default' : 'default'"
                @click="setAction(entry, 'skip')"
              >
                {{ $t('page.disk.uploadConflict.skip') }}
              </NButton>
            </NButtonGroup>
          </div>
        </div>
      </NScrollbar>
    </div>

    <template #footer>
      <div class="flex justify-end gap-8px">
        <NButton @click="handleClose">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
