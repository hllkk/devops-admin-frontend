import { $t } from '@/locales';
import { fetchCheckQuota } from '@/service/api/disk/quota';
import { useDiskStore } from '@/store/modules/disk';
import { getFileExtension, getMaxUploadSize } from './chunk-manager';
import { UploaderEngine } from './uploader-engine';

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

/** Generate a sequential folder name to avoid collision: MyFolder → MyFolder(1) */
function resolveFolderName(folderName: string, existingItems: { fileName: string; isFolder: boolean }[]): string {
  const existingFolderNames = new Set(existingItems.filter(item => item.isFolder).map(item => item.fileName));

  if (!existingFolderNames.has(folderName)) return folderName;

  let counter = 1;
  let newName: string;
  do {
    newName = `${folderName}(${counter})`;
    counter += 1;
  } while (existingFolderNames.has(newName));

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

/** Show a simple folder upload conflict dialog. Returns 'overwrite' | 'keepBoth' | 'cancel' */
function showFolderConflictDialog(folderName: string): Promise<'overwrite' | 'keepBoth' | 'cancel'> {
  return new Promise(resolve => {
    const dialog = window.$dialog?.warning({
      title: $t('page.disk.duplicateFile.title'),
      content: $t('page.disk.duplicateFile.folderConflictMessage', { folderName }),
      positiveText: $t('page.disk.duplicateFile.keepBoth'),
      negativeText: $t('page.disk.duplicateFile.overwrite'),
      onPositiveClick: () => resolve('keepBoth'),
      onNegativeClick: () => resolve('overwrite'),
      onClose: () => resolve('cancel'),
      onMaskClick: () => resolve('cancel')
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
    let effectiveFolderInfo = folderInfo;
    const targetParentId = parentId ?? Number(diskStore.currentParentId ?? 0);

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

    if (effectiveFolderInfo) {
      // === 文件夹上传：简单冲突确认 ===
      // 后端 merge 阶段会自动调用 ensureFolderRecords 懒创建文件夹结构，
      // 无需前端预建文件夹。只需检测同名文件夹并让用户一键决定。
      const { id: folderId, name: folderName } = effectiveFolderInfo;
      const existingFolder = diskStore.currentFileList.find(
        item => item.isFolder && item.fileName === folderName
      );

      if (existingFolder) {
        const choice = await showFolderConflictDialog(folderName);

        if (choice === 'cancel') {
          return;
        }

        if (choice === 'keepBoth') {
          // 保留两者：重命名文件夹前缀（MyFolder → MyFolder(1)）
          // 将所有文件的 relativePath 中第一级目录名改为新名
          const newFolderName = resolveFolderName(folderName, diskStore.currentFileList);
          for (const entry of entries) {
            const relPath = entry.relativePath || entry.file.webkitRelativePath || '';
            // relativePath 格式如 "MyFolder/sub/readme.txt"，替换第一级目录名
            const newRelativePath = relPath
              ? `${newFolderName}${relPath.slice(folderName.length)}`
              : undefined;
            resolvedFiles.push({
              file: entry.file,
              override: false,
              relativePath: newRelativePath
            });
          }
          // 更新 effectiveFolderInfo 的 name，以便引擎传递给后端
          effectiveFolderInfo = { id: folderId, name: newFolderName };
        } else {
          // 覆盖：文件上传到已有文件夹下，override=true
          for (const entry of entries) {
            resolvedFiles.push({
              file: entry.file,
              override: true,
              relativePath: entry.relativePath
            });
          }
        }
      } else {
        // 无同名文件夹：直接上传
        for (const entry of entries) {
          resolvedFiles.push({ file: entry.file, relativePath: entry.relativePath });
        }
      }
    } else {
      // === 普通文件上传：当前目录冲突检测（保持现有逻辑） ===
      const existingNames = getExistingFileNames();

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
    }

    if (resolvedFiles.length > 0) {
      engine.addFiles(resolvedFiles, targetParentId, effectiveFolderInfo);
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

  return { upload, triggerFile, triggerFolder, pause, resume, cancel, retry, reupload, pauseAll, resumeAll };
}
