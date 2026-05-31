<script setup lang="ts">
import { computed, ref, nextTick, watch, onBeforeUnmount } from 'vue';
import type { DropdownOption } from 'naive-ui';

import { $t } from '@/locales';
import { formatDateShort, formatFileSize, formatDateTime } from '@/utils/format';
import { useDiskStore } from '@/store/modules/disk';

import FileIcon from './file-icon.vue';
import { useSvgIcon } from '@/hooks/common/icon';

defineOptions({
  name: 'FileCard'
});

interface Props {
  file: Api.Disk.FileItem;
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
});

interface Emits {
  (e: 'click', file: Api.Disk.FileItem): void;
  (e: 'dblclick', file: Api.Disk.FileItem): void;
  (e: 'select', file: Api.Disk.FileItem): void;
  (e: 'share', file: Api.Disk.FileItem): void;
  (e: 'download', file: Api.Disk.FileItem): void;
  (e: 'delete', file: Api.Disk.FileItem): void;
  (e: 'rename', file: Api.Disk.FileItem): void;
  (e: 'copy', file: Api.Disk.FileItem): void;
  (e: 'move', file: Api.Disk.FileItem): void;
  (e: 'renameConfirm', fileId: CommonType.IdType, newName: string): void;
  (e: 'renameCancel'): void;
}

const emit = defineEmits<Emits>();

const diskStore = useDiskStore();
const { SvgIconVNode } = useSvgIcon();

const moreDropdownShow = ref(false);
const renameInputRef = ref<InstanceType<typeof NInput>>();
const renameName = ref('');
const isRenaming = ref(false);

const formattedTime = computed(() => formatDateShort(props.file.modifyTime));

const formattedSize = computed(() => {
  if (props.file.isFolder) return '-';
  return formatFileSize(props.file.fileSize);
});

const isRenamingThis = computed(() => diskStore.renamingFileId === props.file.fileId);

// --- 悬停信息弹窗 ---
const fileNameRef = ref<HTMLElement>();
const hoverVisible = ref(false);
const hoverPos = ref({ x: 0, y: 0 });
const hoverPlacement = ref<'left' | 'right'>('left');
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

const isVideo = computed(() => props.file.fileType === 'video');
const isAudio = computed(() => props.file.fileType === 'audio');
const isImage = computed(() => props.file.fileType === 'image');

const videoInfo = computed(() => props.file.video);
const musicInfo = computed(() => props.file.music);

const _hasMediaSection = computed(() => {
  if (isVideo.value && videoInfo.value) return true;
  if (isAudio.value && musicInfo.value) return true;
  if (isImage.value) return true;
  return false;
});

function formatDuration(duration: string | undefined) {
  if (!duration) return '-';
  const seconds = Number.parseFloat(duration);
  if (Number.isNaN(seconds)) return duration;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBitrate(bitrate: string | undefined) {
  if (!bitrate) return '-';
  const num = Number.parseFloat(bitrate);
  if (Number.isNaN(num)) return bitrate;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} Mbps`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)} Kbps`;
  return `${bitrate} bps`;
}

const imageResolution = computed(() => {
  if (!isImage.value) return '';
  const ext = props.file.fileExtension?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
  if (!imageExts.includes(ext)) return '';
  return ext.toUpperCase();
});

function showHoverInfo() {
  if (isRenamingThis.value) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const el = fileNameRef.value;
    if (!el) return;
    const card = el.closest('.group') as HTMLElement;
    const anchor = card || el;
    const rect = anchor.getBoundingClientRect();
    const popW = 220;
    const spaceLeft = rect.left;
    const _spaceRight = window.innerWidth - rect.right;
    const centerY = rect.top + rect.height / 2;
    if (spaceLeft >= popW + 12) {
      hoverPlacement.value = 'left';
      hoverPos.value = { x: rect.left - 12, y: centerY };
    } else {
      hoverPlacement.value = 'right';
      hoverPos.value = { x: rect.right + 12, y: centerY };
    }
    hoverVisible.value = true;
  }, 300);
}

function hideHoverInfo() {
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverVisible.value = false;
}

onBeforeUnmount(() => {
  if (hoverTimer) clearTimeout(hoverTimer);
});

/** "..." 更多操作下拉选项 */
const moreOptions = computed<DropdownOption[]>(() => [
  {
    label: $t('page.disk.contextMenu.delete'),
    key: 'delete',
    icon: SvgIconVNode({ icon: 'mdi:delete-outline', fontSize: 16 })
  },
  {
    label: $t('page.disk.contextMenu.rename'),
    key: 'rename',
    icon: SvgIconVNode({ icon: 'mdi:pencil-outline', fontSize: 16 })
  },
  {
    label: $t('page.disk.toolbar.copy'),
    key: 'copy',
    icon: SvgIconVNode({ icon: 'mdi:content-copy', fontSize: 16 })
  },
  {
    label: $t('page.disk.toolbar.move'),
    key: 'move',
    icon: SvgIconVNode({ icon: 'mdi:folder-move-outline', fontSize: 16 })
  },
  {
    label: $t('page.disk.contextMenu.share'),
    key: 'share',
    icon: SvgIconVNode({ icon: 'mdi:share-outline', fontSize: 16 })
  }
]);

watch(isRenamingThis, val => {
  if (val) {
    renameName.value = props.file.fileName;
    isRenaming.value = false;
    nextTick(() => {
      renameInputRef.value?.focus();
    });
  }
});

function handleRenameConfirm() {
  if (isRenaming.value) return;
  const name = renameName.value.trim();
  if (!name) {
    diskStore.cancelRenaming();
    emit('renameCancel');
    return;
  }
  isRenaming.value = true;
  emit('renameConfirm', props.file.fileId, name);
}

function handleRenameCancel() {
  if (isRenaming.value) return;
  diskStore.cancelRenaming();
  emit('renameCancel');
}

function handleRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleRenameConfirm();
  } else if (e.key === 'Escape') {
    handleRenameCancel();
  }
}

function handleClick() {
  if (isRenamingThis.value) return;
  emit('click', props.file);
}

function handleDblClick() {
  if (isRenamingThis.value) return;
  emit('dblclick', props.file);
}

function handleSelect(e: MouseEvent) {
  e.stopPropagation();
  emit('select', props.file);
}

function handleShare(e: MouseEvent) {
  e.stopPropagation();
  emit('share', props.file);
}

function handleDownload(e: MouseEvent) {
  e.stopPropagation();
  emit('download', props.file);
}

function handleMoreSelect(key: string) {
  if (key === 'delete') emit('delete', props.file);
  else if (key === 'rename') emit('rename', props.file);
  else if (key === 'copy') emit('copy', props.file);
  else if (key === 'move') emit('move', props.file);
  else if (key === 'share') emit('share', props.file);
}
</script>

<template>
  <div
    class="group relative flex flex-col items-center px-8px py-16px rd-8px cursor-pointer overflow-hidden transition-colors duration-200 hover:bg-primary/10 dark:hover:bg-primary/20"
    :class="{ 'bg-primary/15 dark:bg-primary/25': selected }"
    @click="handleClick"
    @dblclick="handleDblClick"
    @mouseleave="hideHoverInfo"
  >
    <!-- 顶部操作栏：重命名模式下显示确认/取消按钮 -->
    <div
      v-if="isRenamingThis"
      class="absolute top-4px left-4px right-4px z-1 flex items-center justify-end gap-2px pointer-events-auto"
      @click.stop
    >
      <button
        class="p-4px rd-4px cursor-pointer hover:bg-primary/15 dark:hover:bg-primary/25 text-primary"
        @mousedown.prevent="handleRenameConfirm"
      >
        <SvgIcon icon="mdi:check" :size="14" />
      </button>
      <button
        class="p-4px rd-4px cursor-pointer hover:bg-primary/15 dark:hover:bg-primary/25 text-gray-500"
        @mousedown.prevent="handleRenameCancel"
      >
        <SvgIcon icon="mdi:close" :size="14" />
      </button>
    </div>
    <!-- 顶部操作栏：普通模式 -->
    <div
      v-else
      class="absolute top-4px left-4px right-4px z-1 flex items-center justify-between pointer-events-none opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100"
      :class="{ '!pointer-events-auto !opacity-100': selected || moreDropdownShow }"
    >
      <!-- 左侧：勾选框 -->
      <div class="pointer-events-auto" @click="handleSelect">
        <NCheckbox :checked="selected" />
      </div>
      <!-- 右侧：操作按钮组 -->
      <div class="flex items-center -mr-2px pointer-events-auto" @click.stop>
        <NTooltip trigger="hover">
          <template #trigger>
            <button class="p-3px rd-4px cursor-pointer opacity-80 hover:opacity-100 hover:bg-[var(--n-hover-color)]" @click="handleShare">
              <SvgIcon icon="mdi:share-outline" :size="12" />
            </button>
          </template>
          {{ $t('page.disk.toolbar.share') }}
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <button class="p-3px rd-4px cursor-pointer opacity-80 hover:opacity-100 hover:bg-[var(--n-hover-color)]" @click="handleDownload">
              <SvgIcon icon="mdi:download-outline" :size="12" />
            </button>
          </template>
          {{ $t('page.disk.toolbar.download') }}
        </NTooltip>
        <NDropdown
          :options="moreOptions"
          trigger="hover"
          placement="bottom-end"
          @select="handleMoreSelect"
          @update:show="val => (moreDropdownShow = val)"
        >
          <NTooltip trigger="hover">
            <template #trigger>
              <button class="p-3px rd-4px cursor-pointer opacity-80 hover:opacity-100 hover:bg-[var(--n-hover-color)]">
                <SvgIcon icon="mdi:dots-horizontal" :size="12" />
              </button>
            </template>
            {{ $t('page.disk.toolbar.more') }}
          </NTooltip>
        </NDropdown>
      </div>
    </div>

    <!-- 图标 -->
    <div class="mb-8px mt-16px relative">
      <FileIcon
        :file-type="file.isFolder ? 'folder' : file.fileType"
        :extension="file.fileExtension"
        :file-id="file.fileId"
        :media-cover="file.mediaCover"
        size="large"
      />
      <!-- 收藏星标（左上角，z-index 提高防止被盖住） -->
      <div
        v-if="file.isFavorite"
        class="absolute top-0 left-0 z-10 bg-yellow-400 dark:bg-yellow-500 rd-full p-2px shadow-sm"
      >
        <SvgIcon icon="mdi:star" :size="12" class="text-white" />
      </div>
      <!-- 分享图标（右上角） -->
      <div
        v-if="file.isShare"
        class="absolute top-0 right-0 z-10 bg-green-500 dark:bg-green-600 rd-full p-2px shadow-sm"
      >
        <SvgIcon icon="mdi:share-variant" :size="12" class="text-white" />
      </div>
    </div>

    <!-- 名称：内联重命名模式 -->
    <div v-if="isRenamingThis" class="w-full px-4px" @click.stop>
      <NInput
        ref="renameInputRef"
        v-model:value="renameName"
        size="small"
        @keydown="handleRenameKeydown"
      />
    </div>
    <!-- 名称：普通展示模式（悬停展示详情） -->
    <div
      v-else
      ref="fileNameRef"
      class="file-name-area w-full text-center text-13px px-4px"
      @mouseenter="showHoverInfo"
      @mouseleave="hideHoverInfo"
    >
      <NEllipsis :line-clamp="2" :tooltip="false">
        {{ file.fileName }}
      </NEllipsis>
    </div>

    <!-- 时间 -->
    <div class="text-12px mt-4px text-gray-500">
      {{ formattedTime }}
    </div>

    <!-- 悬停信息弹窗 (Teleport to body) -->
    <Teleport to="body">
      <Transition name="hover-pop">
        <div
          v-if="hoverVisible"
          class="fixed z-9999"
          :style="{
            left: `${hoverPos.x}px`,
            top: `${hoverPos.y}px`,
            transform: hoverPlacement === 'left' ? 'translate(-100%, -50%)' : 'translate(0, -50%)'
          }"
        >
          <div
            class="file-hover-pop min-w-200px max-w-320px rd-10px px-16px py-12px shadow-lg"
            @mouseenter="hoverVisible = true"
            @mouseleave="hideHoverInfo"
          >
            <!-- 基本信息 -->
            <div class="space-y-6px">
              <div class="flex">
                <span class="info-label">{{ $t('page.disk.file.name') }}</span>
                <span class="info-value flex-1 break-all">{{ file.fileName }}</span>
              </div>
              <div v-if="!file.isFolder" class="flex">
                <span class="info-label">{{ $t('page.disk.file.size') }}</span>
                <span class="info-value">{{ formattedSize }}</span>
              </div>
              <div class="flex">
                <span class="info-label">{{ $t('page.disk.file.path') }}</span>
                <span class="info-value flex-1 break-all">{{ file.filePath || '-' }}</span>
              </div>
              <div class="flex">
                <span class="info-label">{{ $t('page.disk.file.createTime') }}</span>
                <span class="info-value">{{ formatDateTime(file.createTime) || '-' }}</span>
              </div>
              <div class="flex">
                <span class="info-label">{{ $t('page.disk.file.modifyTime') }}</span>
                <span class="info-value">{{ formatDateTime(file.updateTime) }}</span>
              </div>
            </div>

            <!-- 视频信息 -->
            <template v-if="isVideo && videoInfo">
              <div class="divider-line" />
              <div class="space-y-6px">
                <div v-if="videoInfo.width && videoInfo.height" class="flex">
                  <span class="info-label">{{ $t('page.disk.file.resolution') }}</span>
                  <span class="info-value">{{ videoInfo.width }} x {{ videoInfo.height }}</span>
                </div>
                <div v-if="videoInfo.bitrate" class="flex">
                  <span class="info-label">{{ $t('page.disk.file.bitrate') }}</span>
                  <span class="info-value">{{ formatBitrate(videoInfo.bitrate) }}</span>
                </div>
                <div v-if="videoInfo.frameRate" class="flex">
                  <span class="info-label">{{ $t('page.disk.file.frameRate') }}</span>
                  <span class="info-value">{{ videoInfo.frameRate }} fps</span>
                </div>
                <div v-if="videoInfo.format" class="flex">
                  <span class="info-label">{{ $t('page.disk.file.format') }}</span>
                  <span class="info-value">{{ videoInfo.format }}</span>
                </div>
                <div v-if="videoInfo.duration" class="flex">
                  <span class="info-label">{{ $t('page.disk.file.duration') }}</span>
                  <span class="info-value">{{ formatDuration(videoInfo.duration) }}</span>
                </div>
              </div>
            </template>

            <!-- 图片信息 -->
            <template v-if="isImage && imageResolution">
              <div class="divider-line" />
              <div class="space-y-6px">
                <div class="flex">
                  <span class="info-label">{{ $t('page.disk.file.type') }}</span>
                  <span class="info-value">{{ imageResolution }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.file-name-area {
  :deep(.n-ellipsis) {
    transition: color 0.2s;
  }

  &:hover :deep(.n-ellipsis) {
    color: rgb(var(--primary-color));
  }
}

// 毛玻璃弹窗样式
.file-hover-pop {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);

  :root.dark & {
    background: rgba(30, 30, 30, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.info-label {
  flex-shrink: 0;
  width: 60px;
  font-size: 12px;
  color: #888;
  line-height: 1.6;

  :root.dark & {
    color: #999;
  }
}

.info-value {
  font-size: 12px;
  color: #333;
  line-height: 1.6;

  :root.dark & {
    color: #ddd;
  }
}

.divider-line {
  margin: 8px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);

  :root.dark & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}

// 弹窗过渡动画
.hover-pop-enter-active,
.hover-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.hover-pop-enter-from,
.hover-pop-leave-to {
  opacity: 0;
}
</style>
