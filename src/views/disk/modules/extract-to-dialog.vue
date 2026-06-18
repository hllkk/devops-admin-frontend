<script setup lang="ts">
import { ref, watch } from 'vue';
import { $t } from '@/locales';
import { fetchGetFolderList } from '@/service/api/disk';

defineOptions({
  name: 'ExtractToDialog'
});

interface Props {
  visible: boolean;
  fileName: string;
}
interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', destPath: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const folders = ref<Api.Disk.FolderItem[]>([]);
const currentBrowsePath = ref('/');
const breadcrumb = ref<{ name: string; path: string }[]>([{ name: $t('page.disk.moveCopy.currentDir'), path: '/' }]);
const selectedPath = ref<string | null>(null);

watch(
  () => props.visible,
  visible => {
    if (visible) {
      currentBrowsePath.value = '/';
      breadcrumb.value = [{ name: $t('page.disk.moveCopy.currentDir'), path: '/' }];
      selectedPath.value = null;
      loadFolders('/');
    }
  }
);

async function loadFolders(path: string) {
  loading.value = true;
  currentBrowsePath.value = path;
  const { data, error } = await fetchGetFolderList(path);
  folders.value = !error && data ? data.list || [] : [];
  loading.value = false;
}

function enterFolder(folder: Api.Disk.FolderItem) {
  breadcrumb.value.push({ name: folder.name, path: folder.path });
  selectedPath.value = null;
  loadFolders(folder.path);
}

function clickBreadcrumb(index: number) {
  const target = breadcrumb.value[index];
  breadcrumb.value = breadcrumb.value.slice(0, index + 1);
  selectedPath.value = null;
  loadFolders(target.path);
}

function toggleSelect(path: string) {
  selectedPath.value = selectedPath.value === path ? null : path;
}

function handleConfirm() {
  const targetPath = selectedPath.value || currentBrowsePath.value;
  if (!targetPath) return;
  emit('confirm', targetPath);
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    :title="$t('page.disk.extract.title')"
    style="width: 90%; max-width: 560px"
    :mask-closable="false"
    :bordered="false"
    @update:show="handleClose"
  >
    <div class="flex flex-col gap-12px">
      <div class="text-14px">
        <span class="opacity-60">{{ $t('page.disk.moveCopy.sourceLabel') }}: </span>
        <span class="font-medium">{{ fileName }}</span>
      </div>

      <NBreadcrumb separator="/">
        <NBreadcrumbItem
          v-for="(item, index) in breadcrumb"
          :key="item.path"
          @click="clickBreadcrumb(index)"
        >
          <span :class="{ 'cursor-pointer hover:text-primary': index < breadcrumb.length - 1 }">
            {{ item.name }}
          </span>
        </NBreadcrumbItem>
      </NBreadcrumb>

      <div
        class="flex items-center gap-8px p-8px rounded cursor-pointer transition-colors"
        :class="selectedPath === currentBrowsePath ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
        @click="toggleSelect(currentBrowsePath)"
      >
        <SvgIcon icon="mdi:folder" :size="20" class="text-amber-500" />
        <span class="text-14px font-medium">. ({{ $t('page.disk.extract.currentDir') }})</span>
      </div>

      <NScrollbar style="max-height: 300px">
        <NSpin :show="loading">
          <div v-if="folders.length === 0 && !loading" class="py-24px text-center opacity-50">
            {{ $t('page.disk.extract.noFolders') }}
          </div>
          <div class="flex flex-col gap-4px">
            <div
              v-for="folder in folders"
              :key="folder.id"
              class="flex items-center gap-8px p-8px rounded cursor-pointer transition-colors"
              :class="selectedPath === folder.path ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
              @click="toggleSelect(folder.path)"
              @dblclick="enterFolder(folder)"
            >
              <SvgIcon icon="mdi:folder" :size="20" class="text-amber-500" />
              <span class="flex-1 text-14px">{{ folder.name }}</span>
              <NButton quaternary size="tiny" @click.stop="enterFolder(folder)">
                <template #icon>
                  <SvgIcon icon="mdi:chevron-right" :size="16" />
                </template>
              </NButton>
            </div>
          </div>
        </NSpin>
      </NScrollbar>

      <div v-if="selectedPath" class="text-13px opacity-70">
        {{ $t('page.disk.extract.targetLabel') }}: {{ selectedPath }}
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-8px">
        <NButton @click="handleClose">{{ $t('common.cancel') }}</NButton>
        <NButton
          type="primary"
          :disabled="!selectedPath && currentBrowsePath === '/'"
          @click="handleConfirm"
        >
          {{ $t('common.confirm') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
