<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useUploader } from '@/hooks/business/upload/use-uploader';

defineOptions({
  name: 'UploadTrigger'
});

const route = useRoute();
const { upload } = useUploader();

/** 仅在"我的网盘"页面启用拖拽上传 */
const dragEnabledRoutes = ['/disk'];

const isDragging = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let folderIdCounter = 0;

function generateFolderId(): string {
  folderIdCounter += 1;
  return `dnd_folder_${Date.now()}_${folderIdCounter}`;
}

function showOverlay() {
  if (!dragEnabledRoutes.some(r => route.path.startsWith(r))) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  isDragging.value = true;
}

function hideOverlay() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    isDragging.value = false;
    hideTimer = null;
  }, 100);
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer?.types.includes('Files')) return;
  showOverlay();
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer?.types.includes('Files')) return;
  showOverlay();
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  if (!dragEnabledRoutes.some(r => route.path.startsWith(r))) return;
  hideOverlay();
}

/** Recursively read a FileSystemEntry, collecting files with their relative paths */
function readEntry(entry: FileSystemEntry, pathPrefix: string = ''): Promise<{ file: File; relativePath: string }[]> {
  return new Promise(resolve => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        file => {
          const relativePath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
          resolve([{ file, relativePath }]);
        },
        () => resolve([])
      );
    } else if (entry.isDirectory) {
      const subPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const allFiles: { file: File; relativePath: string }[] = [];

      const readBatch = () => {
        reader.readEntries(async entries => {
          if (entries.length === 0) {
            resolve(allFiles);
            return;
          }
          for (const e of entries) {
            const files = await readEntry(e, subPath);
            allFiles.push(...files);
          }
          readBatch();
        }, () => resolve(allFiles));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

/** Extract files from a drop event, grouping by folder */
async function extractAndUpload(dataTransfer: DataTransfer) {
  const items = dataTransfer.items;

  // Prefer webkitGetAsEntry for folder support.
  // IMPORTANT: dataTransfer.items 仅在 drop 事件同步派发期间有效。一旦首个 await 让出执行权，
  // 浏览器就会清空拖拽数据存储，后续的 webkitGetAsEntry() 将返回 null（这正是多文件拖拽
  // 只产生一个上传任务的根因）。因此必须在任何 await 之前，同步地把所有 entry 引用收集起来——
  // FileSystemEntry 是稳定引用，之后再异步读取是安全的。
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    // 1. 同步快照所有 entry（此时仍在 drop 事件同步派发期内）
    const entries: FileSystemEntry[] = [];
    for (const item of Array.from(items)) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    // 2. 逐个异步读取（entry 引用已脱离 dataTransfer，读取安全）
    const looseFiles: { file: File; relativePath?: string }[] = [];
    for (const entry of entries) {
      const fileEntries = await readEntry(entry);
      if (fileEntries.length === 0) continue;

      if (entry.isDirectory) {
        // 每个文件夹是独立的上传分组（各自的 folderId / name）
        upload(fileEntries, undefined, {
          id: generateFolderId(),
          name: entry.name
        });
      } else {
        looseFiles.push(...fileEntries);
      }
    }

    // 3. 所有散文件合并为一次 upload()：单次配额校验、批量入队，任务数量正确
    if (looseFiles.length > 0) {
      upload(looseFiles);
    }
    return;
  }

  // Fallback: plain FileList
  const files = Array.from(dataTransfer.files);
  if (files.length > 0) upload(files);
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (!dragEnabledRoutes.some(r => route.path.startsWith(r))) return;
  if (!e.dataTransfer) return;
  extractAndUpload(e.dataTransfer);
}

function handleOverlayDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (!e.dataTransfer) return;
  extractAndUpload(e.dataTransfer);
}

onMounted(() => {
  document.addEventListener('dragenter', handleDragEnter);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragleave', handleDragLeave);
  document.addEventListener('drop', handleDrop);
});

onUnmounted(() => {
  document.removeEventListener('dragenter', handleDragEnter);
  document.removeEventListener('dragover', handleDragOver);
  document.removeEventListener('dragleave', handleDragLeave);
  document.removeEventListener('drop', handleDrop);
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="upload-overlay">
      <div
        v-if="isDragging"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-[var(--primary-color)]/8 backdrop-blur-4px"
        @dragover.prevent.stop="showOverlay"
        @dragleave.prevent.stop="hideOverlay"
        @drop.prevent.stop="handleOverlayDrop"
      >
        <div class="flex flex-col items-center gap-12px">
          <SvgIcon icon="material-symbols:cloud-upload-outline" class="text-64px text-[var(--primary-color)]" />
          <span class="text-18px font-500 text-[var(--primary-color)]">释放文件以上传到网盘</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.upload-overlay-enter-active {
  transition: all 0.2s ease-out;
}
.upload-overlay-leave-active {
  transition: all 0.15s ease-in;
}
.upload-overlay-enter-from,
.upload-overlay-leave-to {
  opacity: 0;
}
</style>
