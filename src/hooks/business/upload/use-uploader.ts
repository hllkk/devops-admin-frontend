import { $t } from '@/locales';
import { fetchCheckQuota } from '@/service/api/disk/quota';
import { useDiskStore } from '@/store/modules/disk';
import { getFileExtension, getMaxUploadSize } from './chunk-manager';
import { UploaderEngine } from './uploader-engine';
import { getUploadFile, deleteUploadFile } from './upload-persistence';

let engineInstance: UploaderEngine | null = null;
let folderIdCounter = 0;

function getEngine(): UploaderEngine {
  if (!engineInstance) {
    engineInstance = new UploaderEngine(3);
  }
  return engineInstance;
}

function generateFolderId(): string {
  folderIdCounter += 1;
  return `folder_${Date.now()}_${folderIdCounter}`;
}

/** Get the set of file names (non-folder) in the current directory */
function getExistingFileNames(): Set<string> {
  const diskStore = useDiskStore();
  const names = new Set<string>();
  for (const item of diskStore.currentFileList) {
    if (!item.isFolder) {
      names.add(item.fileName);
    }
  }
  return names;
}

/** Generate a sequential file name to avoid collision: report.pdf → report(1).pdf */
function resolveFileName(fileName: string, existingNames: Set<string>): string {
  if (!existingNames.has(fileName)) return fileName;

  const ext = getFileExtension(fileName);
  const baseName = ext ? fileName.slice(0, -(ext.length + 1)) : fileName;
  let counter = 1;
  let newName: string;
  do {
    newName = ext ? `${baseName}(${counter}).${ext}` : `${baseName}(${counter})`;
    counter += 1;
  } while (existingNames.has(newName));

  return newName;
}

/** Show a per-file duplicate dialog. Returns 'overwrite' | 'keepBoth' | 'skip' */
function showDuplicateDialog(fileName: string): Promise<'overwrite' | 'keepBoth' | 'skip'> {
  return new Promise(resolve => {
    const dialog = window.$dialog?.warning({
      title: $t('page.disk.duplicateFile.title'),
      content: $t('page.disk.duplicateFile.message', { fileName }),
      positiveText: $t('page.disk.duplicateFile.keepBoth'),
      negativeText: $t('page.disk.duplicateFile.overwrite'),
      onPositiveClick: () => resolve('keepBoth'),
      onNegativeClick: () => resolve('overwrite'),
      onClose: () => resolve('skip'),
      onMaskClick: () => resolve('skip')
    });

    // Fallback if dialog is unavailable
    if (!dialog) {
      resolve('keepBoth');
    }
  });
}

type FileEntry = { file: File; relativePath?: string };

export function useUploader() {
  const engine = getEngine();
  const diskStore = useDiskStore();

  async function upload(
    files: File[] | FileEntry[],
    parentId?: number,
    folderInfo?: { id: string; name: string }
  ) {
    const targetParentId = parentId ?? Number(diskStore.currentParentId ?? 0);
    const existingNames = getExistingFileNames();

    // Normalize to FileEntry array
    const entries: FileEntry[] = files.map(f =>
      f instanceof File ? { file: f } : (f as FileEntry)
    );

    // === 文件大小联动校验 - 从网盘系统设置读取最大上传大小 ===
    const maxUploadMB = await getMaxUploadSize();
    const maxUploadBytes = maxUploadMB * 1024 * 1024;
    const oversized = entries.filter(e => e.file.size > maxUploadBytes);
    if (oversized.length > 0) {
      window.$message?.error(`文件大小超过限制（最大 ${maxUploadMB}MB）`);
      return;
    }

    // === 配额校验 - 计算总大小并校验 ===
    const totalSize = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    const { data: checkResult, error: checkError } = await fetchCheckQuota(totalSize);

    if (checkError || !checkResult?.allowed) {
      window.$message?.error(checkResult?.reason || '存储空间不足，无法上传');
      return;
    }
    // === 配额校验结束 ===

    // Resolve duplicates
    const resolvedFiles: { file: File; resolvedName?: string; override?: boolean; relativePath?: string }[] = [];

    for (const entry of entries) {
      const fileName = entry.file.name;

      if (!existingNames.has(fileName)) {
        resolvedFiles.push({ file: entry.file, relativePath: entry.relativePath });
        continue;
      }

      // Duplicate found — ask user
      const choice = await showDuplicateDialog(fileName);

      if (choice === 'overwrite') {
        resolvedFiles.push({ file: entry.file, override: true, relativePath: entry.relativePath });
      } else if (choice === 'keepBoth') {
        const newName = resolveFileName(fileName, existingNames);
        existingNames.add(newName);
        resolvedFiles.push({ file: entry.file, resolvedName: newName, relativePath: entry.relativePath });
      }
      // 'skip' → don't add the file
    }

    if (resolvedFiles.length > 0) {
      engine.addFiles(resolvedFiles, targetParentId, folderInfo);
    }
  }

  function triggerFile(parentId?: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        upload(Array.from(files), parentId);
      }
      input.remove();
    });
    input.click();
  }

  function triggerFolder(parentId?: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const firstPath = files[0].webkitRelativePath || '';
        const folderName = firstPath.split('/')[0] || '文件夹';
        upload(Array.from(files), parentId, {
          id: generateFolderId(),
          name: folderName
        });
      }
      input.remove();
    });
    input.click();
  }

  function pause(taskId: string) {
    if (engine.getTask(taskId)) {
      engine.pause(taskId);
    } else {
      window.$message?.warning('页面刷新后无法暂停，请重新上传');
    }
  }
  function resume(taskId: string) {
    if (engine.getTask(taskId)) {
      engine.resume(taskId);
    } else {
      window.$message?.warning('页面刷新后无法继续，请重新上传');
    }
  }
  function cancel(taskId: string) {
    if (engine.getTask(taskId)) {
      engine.cancel(taskId);
    } else {
      diskStore.removeTransferItem(taskId);
    }
  }
  function retry(taskId: string) {
    if (engine.getTask(taskId)) {
      engine.retry(taskId);
    } else {
      reupload(taskId);
    }
  }
  function reupload(taskId: string) {
    const transferItem = diskStore.transferList.find(item => item.transferId === taskId);
    if (!transferItem) return;

    const input = document.createElement('input');
    input.type = 'file';
    if (transferItem.fileType) {
      const mimeMap: Record<string, string> = {
        image: 'image/*', video: 'video/*', audio: 'audio/*'
      };
      const mimeType = mimeMap[transferItem.fileType];
      if (mimeType) input.accept = mimeType;
    }
    input.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        diskStore.removeTransferItem(taskId);
        upload([files[0]]);
      }
      input.remove();
    });
    input.click();
  }
  function pauseAll() { engine.pauseAll(); }
  function resumeAll() {
    const tasks = engine.getAllTasks();
    for (const task of tasks) {
      if (task.status === 'paused') {
        engine.resume(task.taskId);
      }
    }
  }

  /**
   * Recover interrupted uploads from IndexedDB after page refresh.
   * Small files (< 500MB) are reconstructed from stored blobs and auto-resumed.
   * Large files (≥ 500MB) prompt the user to re-select the file (backend
   * chunk dedup will skip already-uploaded chunks).
   */
  async function recoverUploads() {
    const interruptedItems = diskStore.transferList.filter(
      item => item.transferType === 'upload' && item.status === 'pending' && item.error === '__recoverable__'
    );

    if (interruptedItems.length === 0) return;

    let recoveredCount = 0;
    let largeFileCount = 0;

    for (const item of interruptedItems) {
      const persisted = await getUploadFile(item.transferId);
      if (!persisted) {
        diskStore.updateTransferItem(item.transferId, {
          status: 'failed',
          error: '无法恢复上传，请重新选择文件'
        });
        continue;
      }

      // Large file: metadata only, user must re-select the file
      if (persisted.largeFile || persisted.blob.byteLength === 0) {
        largeFileCount += 1;
        // Mark as failed so the retry/reupload button appears, then auto-open file picker
        diskStore.updateTransferItem(item.transferId, {
          status: 'failed',
          error: '文件较大无法自动恢复，请重新选择文件后继续上传'
        });
        // Auto-trigger reupload to open file picker with correct type filter
        reupload(item.transferId);
        continue;
      }

      const file = new File([persisted.blob], persisted.meta.fileName, {
        type: persisted.meta.fileType || undefined
      });

      // Remove the old transfer item before re-adding
      diskStore.removeTransferItem(item.transferId);

      const folderInfo = persisted.meta.folderId
        ? { id: persisted.meta.folderId, name: persisted.meta.folderName || '文件夹' }
        : undefined;

      engine.addFiles(
        [{
          file,
          relativePath: persisted.meta.relativePath,
          override: persisted.meta.override
        }],
        persisted.meta.parentId,
        folderInfo
      );

      // Clean up old IndexedDB entry (engine will save a new one with the new taskId)
      await deleteUploadFile(item.transferId);

      recoveredCount += 1;
    }

    if (recoveredCount > 0) {
      window.$message?.success(`已恢复 ${recoveredCount} 个上传任务`);
    }
    if (largeFileCount > 0) {
      window.$message?.info(`${largeFileCount} 个文件较大需重新选择，上传进度将自动恢复`);
    }
  }

  return { upload, triggerFile, triggerFolder, pause, resume, cancel, retry, reupload, recoverUploads, pauseAll, resumeAll };
}
