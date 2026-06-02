<script setup lang="ts">
import { computed, ref } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { useAppStore } from '@/store/modules/app';
import { useSvgIcon } from '@/hooks/common/icon';
import { useUploader } from '@/hooks/business/upload/use-uploader';
import type { DropdownOption } from 'naive-ui';

defineOptions({
  name: 'DiskToolbar'
});

interface Emits {
  (e: 'search', keyword: string): void;
  (e: 'refresh'): void;
  (e: 'share'): void;
  (e: 'batchShare'): void;
  (e: 'download'): void;
  (e: 'delete'): void;
  (e: 'rename'): void;
  (e: 'showTransfer'): void;
  (e: 'addFavorite'): void;
  (e: 'removeFavorite'): void;
}

const emit = defineEmits<Emits>();

const diskStore = useDiskStore();
const appStore = useAppStore();
const { SvgIconVNode } = useSvgIcon();
const { triggerFile, triggerFolder } = useUploader();

const showMobileSearch = ref(false);
const searchKeyword = ref('');

// 最近搜索记录（最多保存10条）
const RECENT_SEARCH_KEY = 'disk_recent_search';
const recentSearches = ref<string[]>([]);

function loadRecentSearches() {
  const saved = localStorage.getItem(RECENT_SEARCH_KEY);
  if (saved) {
    try {
      recentSearches.value = JSON.parse(saved);
    } catch {
      recentSearches.value = [];
    }
  }
}

function saveRecentSearch(keyword: string) {
  if (!keyword.trim() || keyword.trim().length < 2) return;

  const trimmed = keyword.trim();
  const exists = recentSearches.value.includes(trimmed);
  if (exists) {
    // 移到最前面
    recentSearches.value = [trimmed, ...recentSearches.value.filter(k => k !== trimmed)];
  } else {
    recentSearches.value = [trimmed, ...recentSearches.value.slice(0, 9)];
  }
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches.value));
}

function clearRecentSearches() {
  recentSearches.value = [];
  localStorage.removeItem(RECENT_SEARCH_KEY);
}

// 页面加载时读取最近搜索
loadRecentSearches();
const currentSort = computed({
  get: () => {
    const { field, order } = diskStore.sortSettings;
    return field ? `${field}-${order}` : '';
  },
  set: (_val: string) => {
    // setter is unused but required by computed writable
  }
});

// 选中数量
const selectedCount = computed(() => diskStore.selectedFiles.length);
// 是否有选中文件
const hasSelection = computed(() => selectedCount.value > 0);
// 是否多选
const isMultipleSelection = computed(() => selectedCount.value > 1);

// 选中文件中已收藏的数量
const selectedFavoriteCount = computed(() => {
  const selectedFiles = diskStore.currentFileList.filter(f => diskStore.selectedFiles.includes(f.fileId));
  return selectedFiles.filter(f => f.isFavorite).length;
});

// 是否全部已收藏
const allSelectedAreFavorite = computed(() => {
  if (selectedCount.value === 0) return false;
  return selectedFavoriteCount.value === selectedCount.value;
});
// 上传下拉选项
const uploadOptions = computed<DropdownOption[]>(() => [
  {
    key: 'uploadFile',
    label: $t('page.disk.toolbar.uploadFile'),
    icon: SvgIconVNode({ localIcon: 'disk-upload-file', fontSize: 18 })
  },
  {
    key: 'uploadFolder',
    label: $t('page.disk.toolbar.uploadFolder'),
    icon: SvgIconVNode({ localIcon: 'disk-upload-folder', fontSize: 18 })
  }
]);

// 新建下拉选项
const createOptions = computed<DropdownOption[]>(() => [
  {
    key: 'createFile',
    label: $t('page.disk.toolbar.createFile'),
    icon: SvgIconVNode({ localIcon: 'disk-create-file', fontSize: 18 })
  },
  {
    key: 'createFolder',
    label: $t('page.disk.toolbar.createFolder'),
    icon: SvgIconVNode({ localIcon: 'disk-create-folder', fontSize: 18 })
  }
]);

// 排序下拉选项
const sortOptions = computed<DropdownOption[]>(() => [
  {
    key: 'name-asc',
    label: $t('page.disk.sort.nameAsc'),
    icon: SvgIconVNode({ icon: 'mdi:sort-alphabetical-ascending', fontSize: 18 })
  },
  {
    key: 'name-desc',
    label: $t('page.disk.sort.nameDesc'),
    icon: SvgIconVNode({ icon: 'mdi:sort-alphabetical-descending', fontSize: 18 })
  },
  {
    key: 'size-asc',
    label: $t('page.disk.sort.sizeAsc'),
    icon: SvgIconVNode({ icon: 'mdi:sort-numeric-ascending', fontSize: 18 })
  },
  {
    key: 'size-desc',
    label: $t('page.disk.sort.sizeDesc'),
    icon: SvgIconVNode({ icon: 'mdi:sort-numeric-descending', fontSize: 18 })
  },
  {
    key: 'modifyTime-asc',
    label: $t('page.disk.sort.timeAsc'),
    icon: SvgIconVNode({ icon: 'mdi:clock-outline', fontSize: 18 })
  },
  {
    key: 'modifyTime-desc',
    label: $t('page.disk.sort.timeDesc'),
    icon: SvgIconVNode({ icon: 'mdi-sort-reverse-variant', fontSize: 18 })
  },
  {
    key: 'type-asc',
    label: $t('page.disk.sort.typeAsc'),
    icon: SvgIconVNode({ icon: 'mdi:folder-outline', fontSize: 18 })
  },
  {
    key: 'type-desc',
    label: $t('page.disk.sort.typeDesc'),
    icon: SvgIconVNode({ icon: 'mdi:file-outline', fontSize: 18 })
  }
]);

// 更多操作下拉选项
const moreOptions = computed<DropdownOption[]>(() => [
  {
    key: 'move',
    label: $t('page.disk.toolbar.move'),
    icon: SvgIconVNode({ icon: 'mdi:folder-move-outline', fontSize: 18 })
  },
  {
    key: 'copy',
    label: $t('page.disk.toolbar.copy'),
    icon: SvgIconVNode({ icon: 'mdi:content-copy', fontSize: 18 })
  },
  {
    key: 'info',
    label: $t('page.disk.toolbar.info'),
    icon: SvgIconVNode({ icon: 'mdi:information-outline', fontSize: 18 })
  }
]);

// 处理上传选择
function handleUploadSelect(key: string) {
  if (key === 'uploadFile') {
    triggerFile();
  } else if (key === 'uploadFolder') {
    triggerFolder();
  }
}

// 处理新建选择
function handleCreateSelect(key: string) {
  if (key === 'createFile') {
    diskStore.startCreating('file');
  } else if (key === 'createFolder') {
    diskStore.startCreating('folder');
  }
}

// 移动端+号合并下拉选项：上传 + 新建
const mobilePlusOptions = computed(() => [
  ...uploadOptions.value,
  { type: 'divider' as const, key: 'plus-upload-divider' },
  ...createOptions.value
]);

function handleMobilePlusSelect(key: string) {
  if (key.startsWith('upload')) {
    handleUploadSelect(key);
  } else if (key.startsWith('create')) {
    handleCreateSelect(key);
  }
}

// 处理排序选择
function handleSortSelect(key: string) {
  currentSort.value = key;
  const [field, order] = key.split('-');
  diskStore.setSort(field as 'name' | 'size' | 'modifyTime' | 'type', order as 'asc' | 'desc');
}

// 处理搜索
function handleSearch() {
  const keyword = searchKeyword.value.trim();
  if (keyword) {
    saveRecentSearch(keyword);
  }
  emit('search', keyword);
}

// 移动端搜索
function handleMobileSearch() {
  const keyword = searchKeyword.value.trim();
  if (keyword) {
    saveRecentSearch(keyword);
  }
  showMobileSearch.value = false;
  emit('search', keyword);
}

// 点击最近搜索
function handleRecentSearchClick(keyword: string) {
  searchKeyword.value = keyword;
  handleSearch();
}

// 清除最近搜索
function handleClearRecent() {
  clearRecentSearches();
}

// 取消选中
function handleClearSelection() {
  diskStore.clearSelection();
}

// 分享
function handleShare() {
  emit('share');
}

// 批量分享
function handleBatchShare() {
  emit('batchShare');
}

// 下载
function handleDownload() {
  emit('download');
}

// 删除
function handleDelete() {
  emit('delete');
}

// 重命名
function handleRename() {
  emit('rename');
}

// 添加收藏
function handleAddFavorite() {
  emit('addFavorite');
}

// 取消收藏
function handleRemoveFavorite() {
  emit('removeFavorite');
}

// 处理更多操作
function handleMoreSelect(key: string) {
  const selectedFileItems = diskStore.currentFileList.filter(f => diskStore.selectedFiles.includes(f.fileId));
  if (selectedFileItems.length === 0) return;

  if (key === 'move') {
    diskStore.openMoveCopyDialog('move', selectedFileItems);
  } else if (key === 'copy') {
    diskStore.openMoveCopyDialog('copy', selectedFileItems);
  }
}

// 移动端选中状态"更多"选项
const mobileSelectedMoreOptions = computed(() => [
  {
    key: 'download',
    label: $t('page.disk.toolbar.download'),
    icon: SvgIconVNode({ icon: 'mdi:download-outline', fontSize: 18 })
  },
  {
    key: 'share',
    label: $t('page.disk.toolbar.share'),
    icon: SvgIconVNode({ icon: 'mdi:share-outline', fontSize: 18 })
  },
  ...(isMultipleSelection.value
    ? [{
        key: 'batchShare' as const,
        label: $t('page.disk.toolbar.batchShare'),
        icon: SvgIconVNode({ icon: 'mdi:share-variant-outline', fontSize: 18 })
      }]
    : []),
  ...(!isMultipleSelection.value
    ? [{
        key: 'rename' as const,
        label: $t('page.disk.toolbar.rename'),
        icon: SvgIconVNode({ icon: 'mdi:pencil-outline', fontSize: 18 })
      }]
    : []),
  { type: 'divider' as const, key: 'ms-div-1' },
  allSelectedAreFavorite.value
    ? {
        key: 'removeFavorite' as const,
        label: $t('page.disk.contextMenu.removeFavorite'),
        icon: SvgIconVNode({ icon: 'mdi:star-off-outline', fontSize: 18 })
      }
    : {
        key: 'addFavorite' as const,
        label: $t('page.disk.contextMenu.addFavorite'),
        icon: SvgIconVNode({ icon: 'mdi:star-outline', fontSize: 18 })
      },
  { type: 'divider' as const, key: 'ms-div-2' },
  {
    key: 'copy',
    label: $t('page.disk.toolbar.copy'),
    icon: SvgIconVNode({ icon: 'mdi:content-copy', fontSize: 18 })
  },
  {
    key: 'move',
    label: $t('page.disk.toolbar.move'),
    icon: SvgIconVNode({ icon: 'mdi:folder-move-outline', fontSize: 18 })
  }
]);

function handleMobileSelectedMore(key: string) {
  switch (key) {
    case 'download': handleDownload(); break;
    case 'share': handleShare(); break;
    case 'batchShare': handleBatchShare(); break;
    case 'rename': handleRename(); break;
    case 'addFavorite': handleAddFavorite(); break;
    case 'removeFavorite': handleRemoveFavorite(); break;
    case 'copy': handleMoreSelect('copy'); break;
    case 'move': handleMoreSelect('move'); break;
  }
}

// 切换视图模式
function toggleViewMode() {
  diskStore.setViewMode(diskStore.viewMode === 'grid' ? 'list' : 'grid');
}

// 打开传输列表
function handleTransferList() {
  emit('showTransfer');
}

// 刷新列表
function handleRefresh() {
  emit('refresh');
}
</script>

<template>
  <div class="flex items-center gap-8px px-8px py-12px flex-wrap sm:gap-16px sm:px-16px">
    <!-- 未选中状态 -->
    <template v-if="!hasSelection">
      <!-- 移动端：+号合并下拉（上传+新建） + 搜索 -->
      <template v-if="appStore.isMobile">
        <div class="flex items-center gap-8px flex-1">
          <NButtonGroup>
            <NDropdown :options="mobilePlusOptions" trigger="click" @select="handleMobilePlusSelect">
              <NButton type="primary">
                <template #icon>
                  <SvgIcon icon="mdi:plus" :size="18" />
                </template>
              </NButton>
            </NDropdown>
            <NButton @click="showMobileSearch = true">
              <template #icon>
                <SvgIcon icon="mdi:magnify" :size="18" />
              </template>
            </NButton>
          </NButtonGroup>
        </div>
      </template>

      <!-- 桌面端：上传、新建、搜索 -->
      <template v-else>
        <div class="flex items-center gap-8px flex-1">
          <NDropdown :options="uploadOptions" trigger="click" @select="handleUploadSelect">
            <NButton type="primary">
              <template #icon>
                <SvgIcon icon="mdi:cloud-upload" :size="18" class="dark:text-white" />
              </template>
              <span class="hidden sm:inline dark:text-white">{{ $t('page.disk.toolbar.upload') }}</span>
            </NButton>
          </NDropdown>

          <NDropdown :options="createOptions" trigger="click" @select="handleCreateSelect">
            <NButton type="primary">
              <template #icon>
                <SvgIcon icon="mdi:plus" :size="18" class="dark:text-white" />
              </template>
              <span class="hidden sm:inline text-white dark:text-white">{{ $t('page.disk.toolbar.create') }}</span>
            </NButton>
          </NDropdown>

          <!-- 搜索框：平板及以上显示 -->
          <NInputGroup class="hidden sm:flex w-180px lg:w-240px">
          <NPopover
            trigger="focus"
            placement="bottom-start"
            :show-arrow="false"
            :disabled="recentSearches.length === 0"
            :style="{ width: '100%' }"
            content-style="padding: 8px 0;"
          >
            <template #trigger>
              <NInput
                v-model:value="searchKeyword"
                :placeholder="$t('page.disk.toolbar.searchPlaceholder')"
                clearable
                @keydown.enter="handleSearch"
              />
            </template>
            <div class="flex flex-col gap-4px min-w-150px">
              <div class="flex items-center justify-between px-8px mb-4px text-12px text-gray-500">
                <span>{{ $t('page.disk.toolbar.recentSearch') }}</span>
                <NButton text size="tiny" @click.stop="handleClearRecent">
                  {{ $t('common.clear') }}
                </NButton>
              </div>
              <div
                v-for="item in recentSearches"
                :key="item"
                class="flex items-center gap-8px px-8px py-6px cursor-pointer hover:bg-primary/10 rd-4px text-13px"
                @click="handleRecentSearchClick(item)"
              >
                <SvgIcon icon="mdi:clock-outline" :size="14" class="text-gray-400" />
                <span class="flex-1 truncate">{{ item }}</span>
              </div>
            </div>
          </NPopover>
          <NButton type="primary" @click="handleSearch">
            <template #icon>
              <SvgIcon icon="mdi:magnify" :size="18" class="dark:text-white" />
            </template>
          </NButton>
        </NInputGroup>
      </div>
    </template>
    </template>

    <!-- 选中状态 -->
    <template v-else>
      <!-- 移动端：已选N项 + 取消 | 删除 + 更多 -->
      <template v-if="appStore.isMobile">
        <div class="flex items-center gap-8px flex-1">
          <NTag type="info" round>
            {{ $t('page.disk.toolbar.selectedCount', { count: selectedCount }) }}
          </NTag>
          <NButton quaternary size="small" @click="handleClearSelection">
            <template #icon>
              <SvgIcon icon="mdi:close" :size="16" />
            </template>
          </NButton>
          <NButtonGroup>
            <NButton type="error" @click="handleDelete">
              <template #icon>
                <SvgIcon icon="mdi:delete-outline" :size="18" />
              </template>
            </NButton>
            <NDropdown :options="mobileSelectedMoreOptions" trigger="click" @select="handleMobileSelectedMore">
              <NButton>
                <template #icon>
                  <SvgIcon icon="mdi:dots-horizontal" :size="18" />
                </template>
              </NButton>
            </NDropdown>
          </NButtonGroup>
        </div>
      </template>

      <!-- 桌面端：选中信息 + 完整操作按钮组 -->
      <template v-else>
        <div class="flex items-center gap-8px">
          <NTag type="info" round>
            {{ $t('page.disk.toolbar.selectedCount', { count: selectedCount }) }}
          </NTag>
          <NButton quaternary size="small" @click="handleClearSelection">
            <template #icon>
              <SvgIcon icon="mdi:close" :size="16" />
            </template>
          </NButton>
        </div>

        <div class="flex items-center gap-8px sm:flex-1">
          <NButtonGroup>
            <!-- 分享 -->
            <NButton @click="handleShare">
              <template #icon>
                <SvgIcon icon="mdi:share-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.toolbar.share') }}</span>
            </NButton>

            <!-- 批量分享：仅多选时显示 -->
            <NButton v-if="isMultipleSelection" @click="handleBatchShare">
              <template #icon>
                <SvgIcon icon="mdi:share-variant-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.toolbar.batchShare') }}</span>
            </NButton>

            <!-- 收藏 -->
            <NButton v-if="allSelectedAreFavorite" @click="handleRemoveFavorite">
              <template #icon>
                <SvgIcon icon="mdi:star-off-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.contextMenu.removeFavorite') }}</span>
            </NButton>
            <NButton v-else @click="handleAddFavorite">
              <template #icon>
                <SvgIcon icon="mdi:star-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.contextMenu.addFavorite') }}</span>
            </NButton>

            <!-- 下载 -->
            <NButton @click="handleDownload">
              <template #icon>
                <SvgIcon icon="mdi:download-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.toolbar.download') }}</span>
            </NButton>

            <!-- 删除 -->
            <NButton type="error" @click="handleDelete">
              <template #icon>
                <SvgIcon icon="mdi:delete-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.toolbar.delete') }}</span>
            </NButton>

            <!-- 重命名：仅单选时显示 -->
            <NButton v-if="!isMultipleSelection" @click="handleRename">
              <template #icon>
                <SvgIcon icon="mdi:pencil-outline" :size="18" />
              </template>
              <span class="hidden sm:inline">{{ $t('page.disk.toolbar.rename') }}</span>
            </NButton>

            <!-- 更多 -->
            <NDropdown :options="moreOptions" trigger="click" @select="handleMoreSelect">
              <NButton>
                <template #icon>
                  <SvgIcon icon="mdi:dots-horizontal" :size="18" />
                </template>
                <span class="hidden sm:inline">{{ $t('page.disk.toolbar.more') }}</span>
              </NButton>
            </NDropdown>
          </NButtonGroup>
        </div>
      </template>
    </template>

    <!-- 右侧：功能按钮组（未选中时同行右侧，选中时手机端自然换行到第二行） -->
    <div class="flex items-center gap-4px sm:gap-8px flex-shrink-0">
      <NButtonGroup>
        <!-- 传输列表（移动端隐藏） -->
        <NTooltip v-if="!appStore.isMobile" trigger="hover">
          <template #trigger>
            <NButton @click="handleTransferList">
              <template #icon>
                <NBadge :value="diskStore.uploadingCount" :max="99" :show="diskStore.uploadingCount > 0" :offset="[4, -2]">
                  <SvgIcon icon="mdi:swap-vertical" :size="18" />
                </NBadge>
              </template>
            </NButton>
          </template>
          {{ $t('page.disk.toolbar.transferList') }}
        </NTooltip>

        <!-- 排序 -->
        <NDropdown :options="sortOptions" trigger="click" @select="handleSortSelect">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton>
                <template #icon>
                  <SvgIcon icon="mdi:sort" :size="18" />
                </template>
              </NButton>
            </template>
            {{ $t('page.disk.toolbar.sort') }}
          </NTooltip>
        </NDropdown>

        <!-- 视图切换（移动端隐藏，固定列表模式） -->
        <NTooltip v-if="!appStore.isMobile" trigger="hover">
          <template #trigger>
            <NButton @click="toggleViewMode">
              <template #icon>
                <SvgIcon :icon="diskStore.viewMode === 'grid' ? 'mdi:view-grid' : 'mdi:view-list'" :size="18" />
              </template>
            </NButton>
          </template>
          {{ diskStore.viewMode === 'grid' ? $t('page.disk.toolbar.gridView') : $t('page.disk.toolbar.listView') }}
        </NTooltip>

        <!-- 刷新 -->
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton @click="handleRefresh">
              <template #icon>
                <SvgIcon icon="mdi:refresh" :size="18" />
              </template>
            </NButton>
          </template>
          {{ $t('page.disk.toolbar.refresh') }}
        </NTooltip>
      </NButtonGroup>
    </div>

    <!-- 移动端搜索弹窗 -->
    <NModal v-model:show="showMobileSearch" preset="card" style="width: 90%; max-width: 400px" :bordered="false">
      <div class="flex flex-col gap-12px">
        <NInputGroup>
          <NInput v-model:value="searchKeyword" :placeholder="$t('page.disk.toolbar.searchPlaceholder')" clearable autofocus @keydown.enter="handleMobileSearch" />
          <NButton type="primary" @click="handleMobileSearch">
            <template #icon>
              <SvgIcon icon="mdi:magnify" :size="18" />
            </template>
          </NButton>
        </NInputGroup>
        <!-- 最近搜索 -->
        <div v-if="recentSearches.length > 0" class="flex flex-col gap-8px">
          <div class="flex items-center justify-between text-12px text-gray-500">
            <span>{{ $t('page.disk.toolbar.recentSearch') }}</span>
            <NButton text size="tiny" @click.stop="handleClearRecent">
              {{ $t('common.clear') }}
            </NButton>
          </div>
          <div class="flex flex-wrap gap-8px">
            <NTag
              v-for="item in recentSearches"
              :key="item"
              size="small"
              round
              cursor-pointer
              @click="handleRecentSearchClick(item); showMobileSearch = false;"
            >
              <template #avatar>
                <SvgIcon icon="mdi:clock-outline" :size="12" class="text-gray-400" />
              </template>
              {{ item }}
            </NTag>
          </div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
</style>
