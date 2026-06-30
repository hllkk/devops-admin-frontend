import { createApp } from 'vue';
import { $t } from '@/locales';
import { fetchCheckQuota } from '@/service/api/disk/quota';
import { fetchCheckConflicts, fetchEnsureFolder } from '@/service/api/disk/file';
import { useAuthStore } from '@/store/modules/auth';
import { useDiskStore } from '@/store/modules/disk';
import { getFileExtension, getMaxUploadSize } from './chunk-manager';
import { UploaderEngine } from './uploader-engine';
import UploadConflictDialog from '@/views/disk/modules/upload-conflict-dialog.vue';

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

/** Get the current directory path from disk store breadcrumbs */
function getCurrentDirectory(): string {
  const diskStore = useDiskStore();
  if (diskStore.currentPath.length === 0) return '/';
  const parts = diskStore.currentPath.map(item => item.fileName);
  return `/${parts.join('/')}`;
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

/** Show batch conflict dialog for folder uploads. Returns Map<key, action> */
function showBatchConflictDialog(
  conflicts: { fileName: string; targetPath: string }[]
): Promise<Map<string, 'keepBoth' | 'overwrite' | 'skip'>> {
  return new Promise(resolve => {
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    const app = createApp(UploadConflictDialog, {
      visible: true,
      conflicts,
      onConfirm(decisions: Map<string, 'keepBoth' | 'overwrite' | 'skip'>) {
        resolve(decisions);
        app.unmount();
        mountEl.remove();
      },
      'onUpdate:visible'(value: boolean) {
        if (!value) {
          // Dialog closed without confirm → default all to keepBoth
          const defaults = new Map<string, 'keepBoth' | 'overwrite' | 'skip'>();
          for (const c of conflicts) {
            defaults.set(`${c.fileName}@${c.targetPath}`, 'keepBoth');
          }
          resolve(defaults);
          app.unmount();
          mountEl.remove();
        }
      }
    });

    app.mount(mountEl);
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

    if (folderInfo) {
      // === 文件夹上传：先预建文件夹 + 精确冲突检测 ===
      const currentDirectory = getCurrentDirectory();
      const userId = Number(useAuthStore().userInfo.userId);

      // 1. 预建文件夹结构
      let ensureError = false;
      await fetchEnsureFolder({
        userId,
        currentDirectory,
        folderName: folderInfo.name
      }).catch(() => {
        // 预建失败不阻断上传，后续上传时会懒创建
        ensureError = true;
      });

      if (ensureError) {
        window.$message?.warning('预建文件夹失败，将在上传文件时自动创建');
      }

      // 2. 批量冲突检测
      const checkEntries = entries.map(e => ({
        fileName: e.file.name,
        relativePath: e.relativePath || e.file.name
      }));

      const { data: conflictsData, error: conflictsError } = await fetchCheckConflicts({
        userId,
        currentDirectory,
        entries: checkEntries
      });

      if (conflictsError || !conflictsData) {
        // 检测失败降级：不检查冲突，直接上传（后端有 Duplicate 兜底）
        for (const entry of entries) {
          resolvedFiles.push({ file: entry.file, relativePath: entry.relativePath });
        }
      } else if (conflictsData.conflicts.length === 0) {
        // 无冲突：直接上传
        for (const entry of entries) {
          resolvedFiles.push({ file: entry.file, relativePath: entry.relativePath });
        }
      } else {
        // 有冲突：弹出批量冲突弹窗
        const decisions = await showBatchConflictDialog(conflictsData.conflicts);

        // 构建冲突集，快速查找
        const conflictSet = new Set(
          conflictsData.conflicts.map(c => `${c.fileName}@${c.targetPath}`)
        );

        for (const entry of entries) {
          const fileName = entry.file.name;
          // relativePath 已包含文件夹名前缀（如 "docs/sub/readme.txt"），无需再加 folderInfo.name
          const relPath = entry.relativePath || entry.file.name;
          const relDir = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '';
          const targetPath = relDir ? `${currentDirectory}/${relDir}` : currentDirectory;
          const key = `${fileName}@${targetPath}`;

          if (conflictSet.has(key)) {
            const action = decisions.get(key) || 'keepBoth';
            if (action === 'overwrite') {
              resolvedFiles.push({ file: entry.file, override: true, relativePath: entry.relativePath });
            } else if (action === 'keepBoth') {
              // 为冲突文件生成新名（后端 resolveNameConflict 也可兜底）
              resolvedFiles.push({ file: entry.file, relativePath: entry.relativePath });
            }
            // 'skip' → don't add
          } else {
            resolvedFiles.push({ file: entry.file, relativePath: entry.relativePath });
          }
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

  return { upload, triggerFile, triggerFolder, pause, resume, cancel, retry, reupload, pauseAll, resumeAll };
}
