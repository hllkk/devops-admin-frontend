<script lang="tsx" setup>
import { computed, defineAsyncComponent, h, ref, watch } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useDialog } from 'naive-ui';
import type { TreeOption } from 'naive-ui';
import * as monaco from 'monaco-editor';
import { fetchGetFileList } from '@/service/api/disk/list';
import { fetchSaveWithHistory, fetchRestoreHistory, fetchHistoryList } from '@/service/api/disk/editor';
import { fetchRefreshToken } from '@/service/api';
import { useDiskStore } from '@/store/modules/disk';
import { useAuthStore } from '@/store/modules/auth';
import { getServiceBaseURL } from '@/utils/service';
import { formatFileSize, formatTime } from '@/utils/file';
import { $t } from '@/locales';
import FileIcon from '@/views/disk/modules/file-icon.vue';
import HistoryVersionPopover from './history-version-popover.vue';

const VditorEditor = defineAsyncComponent(() => import('@/components/preview/vditor-editor.vue'));
const MonacoEditor = defineAsyncComponent(() => import('@/components/preview/monaco-editor.vue'));
const MonacoDiffEditor = defineAsyncComponent(() => import('@/components/preview/monaco-diff-editor.vue'));

defineOptions({
  name: 'TextPreview'
});

interface TabItem {
  path: string;
  title: string;
  fileId: string | number;
  language: string;
  content: string;
  originalContent: string;
  isModified: boolean;
  hasHistoryVersion?: boolean;
}

/** 后端返回的文件项格式 */
interface BackendFileItem {
  id: number;
  name: string;
  size: number;
  isDir: boolean;
  extendName?: string;
  contentType?: string;
  filePath: string;
  createTime: string;
  updateTime: string;
  mediaCover?: boolean;
  showCover?: boolean;
  music?: Api.Disk.MusicInfo;
  video?: Api.Disk.VideoInfo;
  /** 兼容属性: 文件ID别名 */
  fileId?: number;
  /** 兼容属性: 文件名别名 */
  fileName?: string;
  /** 兼容属性: 文件大小别名 */
  fileSize?: number;
  /** 兼容属性: 是否文件夹别名 */
  isFolder?: boolean;
  /** 兼容属性: 扩展名别名 */
  fileExtension?: string;
}

interface TabNode extends TreeOption {
  file?: BackendFileItem | Api.Disk.FileItem;
  fullPath?: string;
}

interface Props {
  shareId?: string;
}

const props = defineProps<Props>();

const dialog = useDialog();
const diskStore = useDiskStore();
const authStore = useAuthStore();
const { textPreviewVisible, textPreviewRow } = storeToRefs(diskStore);

const isFullscreen = ref(false);
const markdownMode = ref(false);
const saving = ref(false);
const tabs = ref<TabItem[]>([]);
const activeTab = ref('');
const treeSelectedKeys = ref<Array<string | number>>([]);
const treeExpandedKeys = ref<Array<string | number>>([]);
const currentDirectory = ref('/');
const currentContent = ref('');
const cursorLine = ref(1);
const cursorColumn = ref(1);
const lastSaved = ref<Date | null>(null);
const collapsed = ref(true);
const treeData = ref<TabNode[]>([]);
const abortControllerMap = new Map<string, AbortController>();
let refreshTokenPromise: Promise<boolean> | null = null;

// 授权错误码配置
const AUTH_ERROR_CODES = {
  success: '0000',
  expiredToken: ['9999', '9998', '3333'],
  logout: ['8888', '8889', '7'],
  modalLogout: ['7777', '7778']
};

// 处理授权错误
async function handleAuthError(code: string, msg: string): Promise<boolean> {
  // Token 过期，尝试刷新
  if (AUTH_ERROR_CODES.expiredToken.includes(code)) {
    if (!refreshTokenPromise) {
      refreshTokenPromise = handleRefreshToken();
    }
    const success = await refreshTokenPromise;
    setTimeout(() => {
      refreshTokenPromise = null;
    }, 1000);
    return success;
  }

  // 弹窗提示登出
  if (AUTH_ERROR_CODES.modalLogout.includes(code)) {
    window.$dialog?.error({
      title: $t('common.error'),
      content: msg,
      positiveText: $t('common.confirm'),
      maskClosable: false,
      closeOnEsc: false,
      onPositiveClick() {
        authStore.resetStore();
      },
      onClose() {
        authStore.resetStore();
      }
    });
    return false;
  }

  // 直接登出
  if (AUTH_ERROR_CODES.logout.includes(code)) {
    authStore.resetStore();
    return false;
  }

  // 其他错误，显示提示
  window.$message?.error(msg);
  return false;
}

// 刷新 Token
async function handleRefreshToken(): Promise<boolean> {
  const { error } = await fetchRefreshToken();
  if (!error) {
    return true;
  }

  authStore.resetStore();
  return false;
}

const visible = computed({
  get: () => textPreviewVisible.value,
  set: val => {
    textPreviewVisible.value = val;
  }
});
const currentFile = computed(() => textPreviewRow.value);
const dialogStyle = computed(() => {
  return isFullscreen.value
    ? {
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        borderRadius: '0'
      }
    : {
        width: '900px',
        maxWidth: '95vw',
        height: '80vh',
        maxHeight: '80vh'
      };
});
const modalContentStyle = {
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden'
} as const;
const modalSectionStyle = {
  flex: 'none'
} as const;
// const siderContentStyle = {
//   height: '100%',
//   minHeight: 0,
//   overflow: 'auto'
// } as const;

const currentTab = computed(() => {
  return tabs.value.find(tab => tab.path === activeTab.value);
});

const isMarkdown = computed(() => {
  return activeTab.value.toLowerCase().endsWith('.md');
});

const isModified = computed(() => {
  return currentTab.value?.isModified ?? false;
});

// 监听 tab 内容变化，更新 isModified 状态
watch(
  () => tabs.value,
  newTabs => {
    newTabs.forEach(tab => {
      // 只有当 content 和 originalContent 都存在时才比较
      if (tab.originalContent !== undefined && tab.content !== undefined) {
        tab.isModified = tab.content !== tab.originalContent;
      }
    });
  },
  { deep: true }
);

const isShare = computed(() => Boolean(props.shareId));
const hasHistoryVersion = computed(() => {
  return currentTab.value?.hasHistoryVersion ?? false;
});

// 面包屑路径段
const breadcrumbSegments = computed(() => {
  if (currentDirectory.value === '/') return [];
  const segments = currentDirectory.value.split('/').filter(Boolean);
  return segments.map((name, index) => ({
    name,
    path: '/' + segments.slice(0, index + 1).join('/')
  }));
});

// 点击面包屑导航到指定目录
async function handleBreadcrumbClick(path: string) {
  currentDirectory.value = path;
  // 需要找到对应路径的节点 key 来展开
  // 由于树数据是懒加载的，可能需要先加载根目录
  if (treeData.value.length === 0) {
    treeData.value = await fetchFiles('/');
  }
  treeSelectedKeys.value = [];
}

const currentLanguage = computed(() => {
  const suffix = activeTab.value.split('.').pop() || 'txt';
  const languages = monaco.languages.getLanguages();
  const lang = languages.find(l => l.extensions?.includes(`.${suffix}`));
  return lang?.id || 'plaintext';
});

async function saveTab(tab: TabItem) {
  if (!tab.isModified) return;

  try {
    const { error } = await fetchSaveWithHistory({
      fileId: tab.fileId,
      content: tab.content
    });
    if (error) {
      window.$message?.error(`文件 ${tab.title} 保存失败`);
      throw error;
    }
    tab.originalContent = tab.content;
    tab.isModified = false;
    tab.hasHistoryVersion = true;
    lastSaved.value = new Date();
    window.$message?.success(`文件 ${tab.title} 保存成功`);
  } catch (error) {
    window.$message?.error(`文件 ${tab.title} 保存失败: ${error}`);
    throw error;
  }
}

async function handleSave() {
  const tab = currentTab.value;
  if (!tab || !tab.isModified) {
    return;
  }
  saving.value = true;
  try {
    await saveTab(tab);
  } finally {
    saving.value = false;
  }
}

async function handleClose() {
  const modifiedTabs = tabs.value.filter(tab => tab.isModified);
  if (modifiedTabs.length > 0) {
    return new Promise(resolve => {
      dialog.warning({
        title: '警告',
        content: '检测到未保存的内容，是否在离开前保存修改？',
        positiveText: '保存并关闭',
        negativeText: '放弃修改',
        onPositiveClick: async () => {
          try {
            for (const tab of modifiedTabs) {
              await saveTab(tab);
            }
            textPreviewVisible.value = false;
            resolve(true);
          } catch {
            resolve(false);
          }
        },
        onNegativeClick: () => {
          textPreviewVisible.value = false;
          resolve(true);
        },
        onClose: () => {
          resolve(false);
        }
      });
    });
  }
  textPreviewVisible.value = false;
  return true;
}

function handleAfterLeave() {
  tabs.value = [];
  activeTab.value = '';
  currentContent.value = '';
}

function toggleMarkdownMode() {
  markdownMode.value = !markdownMode.value;
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

// 历史版本处理
interface HistoryVersion {
  id: CommonType.IdType;
  fileId: CommonType.IdType;
  fileName: string;
  size: number;
  operator: string;
  createTime: string;
}

const diffMode = ref(false);
const diffOriginalContent = ref('');
const diffModifiedContent = ref('');
const diffVersionInfo = ref<HistoryVersion | null>(null);

const activeDiffVersionId = computed(() => (diffMode.value && diffVersionInfo.value?.id) || undefined);

function handleHistoryPreview(content: string, version: HistoryVersion) {
  const tab = currentTab.value;
  if (!tab) return;

  diffOriginalContent.value = tab.content;
  diffModifiedContent.value = content;
  diffVersionInfo.value = version;
  diffMode.value = true;
}

function handleExitDiffMode() {
  diffMode.value = false;
  diffOriginalContent.value = '';
  diffModifiedContent.value = '';
  diffVersionInfo.value = null;
}

async function handleHistoryRestore(version: HistoryVersion) {
  const tab = currentTab.value;
  if (!tab) return;

  try {
    const { error } = await fetchRestoreHistory(version.id);
    if (error) {
      window.$message?.error('恢复历史版本失败');
      return;
    }
    // 更新编辑器内容为恢复后的内容（diffModifiedContent 即历史版本内容）
    tab.content = diffModifiedContent.value;
    tab.originalContent = tab.content;
    tab.isModified = false;
    handleExitDiffMode();
    window.$message?.success('已恢复到历史版本');
  } catch {
    window.$message?.error('恢复历史版本失败');
  }
}

function handleHistoryDelete(_versionId: CommonType.IdType) {
  // 删除历史版本后，如果当前没有其他历史版本，隐藏按钮
  // 这里不需要额外处理，HistoryVersionPopover 会自动更新列表
}

function handleHistoryEmptied() {
  // 所有历史版本被清空，隐藏历史版本按钮
  const tab = currentTab.value;
  if (tab) {
    tab.hasHistoryVersion = false;
  }
}

// 判断是否为文本文件
const isTextFile = (file: BackendFileItem | Api.Disk.FileItem) => {
  const textExtensions = [
    'txt',
    'md',
    'json',
    'xml',
    'yml',
    'yaml',
    'js',
    'ts',
    'vue',
    'jsx',
    'tsx',
    'py',
    'java',
    'go',
    'rs',
    'cpp',
    'c',
    'h',
    'css',
    'scss',
    'less',
    'html',
    'htm',
    'sh',
    'bash',
    'zsh',
    'ps1',
    'sql',
    'dockerfile',
    'nginx'
  ];
  // 兼容两种属性名，处理扩展名前导点号
  const suffix = (file.extendName ?? file.fileExtension)?.toLowerCase().replace(/^\./, '') || '';
  return textExtensions.includes(suffix) || file.contentType?.includes('text');
};

// 获取语言类型
const getLanguageBySuffix = (suffix: string): string => {
  const langMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    vue: 'html',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    json: 'json',
    xml: 'xml',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    md: 'markdown',
    txt: 'plaintext'
  };
  return langMap[suffix] || 'plaintext';
};

async function loadFileContent(file: BackendFileItem | Api.Disk.FileItem, tab: TabItem, retryCount = 0) {
  // 取消该文件之前的请求
  if (abortControllerMap.has(tab.path)) {
    abortControllerMap.get(tab.path)?.abort();
    abortControllerMap.delete(tab.path);
  }

  const abortController = new AbortController();
  abortControllerMap.set(tab.path, abortController);

  try {
    const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
    const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

    let url = '';
    const params: Record<string, string> = {};

    // 兼容两种属性名
    const fileId = (file.id ?? file.fileId) as string | number;

    if (props.shareId) {
      url = `${baseURL}/preview/shared/text/stream`;
      params.shareId = props.shareId;
      params.fileId = String(fileId);
    } else {
      url = `${baseURL}/preview/text/stream`;
      params.fileId = String(fileId);
    }

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}&t=${new Date().getTime()}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'include',
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 检查 Content-Type，判断是否是 JSON 错误响应
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // 读取完整响应内容
      const text = await response.text();
      try {
        const json = JSON.parse(text) as { code: string; data: null; msg: string };
        // 检查是否是错误响应
        if (json.code !== AUTH_ERROR_CODES.success) {
          // 处理授权错误
          const success = await handleAuthError(json.code, json.msg);
          // 如果 token 刷新成功且未超过重试次数，重新加载
          if (success && retryCount < 1) {
            return loadFileContent(file, tab, retryCount + 1);
          }
          throw new Error(json.msg);
        }
      } catch (parseError) {
        // JSON 解析失败或已处理错误，直接显示文本
        if (parseError instanceof Error && parseError.message !== 'JSON parse error') {
          throw parseError;
        }
        // 如果不是错误响应，当作普通 JSON 文件内容显示
        tab.content = text;
        tab.originalContent = text;
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder('utf-8');

    // 节流更新内容，避免频繁渲染导致卡顿
    const updateContent = useThrottleFn((text: string) => {
      tab.content = text;
    }, 150);

    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // 确保最后一次更新
        tab.content = result;
        tab.originalContent = result;
        break;
      }
      result += decoder.decode(value, { stream: true });
      updateContent(result);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // 请求被取消，不显示错误
      return;
    }
    const errorMsg = error instanceof Error ? error.message : '加载文件失败';
    window.$message?.error?.(errorMsg);
  } finally {
    abortControllerMap.delete(tab.path);
  }
}

async function initFile(file: BackendFileItem | Api.Disk.FileItem, fullPath?: string) {
  // 兼容两种属性名，处理扩展名前导点号
  const fileName = (file.name ?? file.fileName) as string;
  const fileSize = (file.size ?? file.fileSize) as number;
  const fileId = (file.id ?? file.fileId) as string | number;
  const fileExt = (file.extendName ?? file.fileExtension)?.replace(/^\./, '') ?? '';

  // filePath 是目录路径，不含文件名，需要组合构建完整路径
  let path = fullPath;
  if (!path) {
    const filePath = file.filePath || '';
    // 确保 filePath 不以 / 结尾，避免双斜杠
    const normalizedPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;
    path = normalizedPath ? `${normalizedPath}/${fileName}` : `/${fileName}`;
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  // 检查是否已打开
  const existingTab = tabs.value.find(tab => tab.path === path);
  if (existingTab) {
    activeTab.value = existingTab.path;
    return;
  }

  // 检查文件大小限制 (例如 2MB)
  if (fileSize && fileSize > 2 * 1024 * 1024) {
    window.$message?.warning(`文件 ${fileName} 过大，暂不支持预览`);
    return;
  }

  // 创建新标签
  const suffix = fileExt.toLowerCase();
  const newTab: TabItem = {
    path,
    title: fileName,
    fileId,
    language: getLanguageBySuffix(suffix),
    content: '',
    originalContent: '',
    isModified: false
  };
  tabs.value.push(newTab);
  activeTab.value = path;

  // 获取响应式对象，确保更新内容时触发视图更新
  const reactiveTab = tabs.value.find(t => t.path === path);
  if (reactiveTab) {
    // 加载文件内容
    await loadFileContent(file, reactiveTab);
    // 检查是否存在历史版本
    try {
      const { data: historyData } = await fetchHistoryList(fileId);
      if (historyData && historyData.length > 0) {
        reactiveTab.hasHistoryVersion = true;
      }
    } catch {
      // 检查历史版本失败不影响文件打开
    }
  }
}

// 获取文件列表
async function fetchFiles(directory: string): Promise<TabNode[]> {
  const params = {
    userId: Number(authStore.userInfo.userId),
    currentDirectory: encodeURIComponent(directory),
    queryType: 'all' as const,
    page: 1,
    size: 1000
  };
  const { data, error } = await fetchGetFileList(params);
  if (error || !data) return [];

  return data.list
    .filter(f => f.isDir || isTextFile(f))
    .map(f => {
      let fullPath = directory === '/' ? `/${f.name}` : `${directory}/${f.name}`;
      fullPath = fullPath.replace(/\/\//g, '/');
      return {
        key: f.id,
        label: f.name,
        isLeaf: !f.isDir,
        file: f,
        fullPath
      };
    });
}

// 懒加载目录
const handleLoad = async (node: TabNode) => {
  if (!node.fullPath || node.isLeaf) return;
  const children = await fetchFiles(node.fullPath);
  // 确保子节点有正确的 fullPath
  children.forEach(child => {
    if (!child.fullPath) {
      child.fullPath = node.fullPath === '/' ? `/${child.label}` : `${node.fullPath}/${child.label}`;
    }
  });
  node.children = children;
};

// 初始化树数据 - 从根目录加载，展开到当前文件
async function initTreeData(file: BackendFileItem | Api.Disk.FileItem) {
  const fileName = (file.name ?? file.fileName) as string;
  const fileId = (file.id ?? file.fileId) as string | number;

  let path = file.filePath || `/${fileName}`;
  if (!path.startsWith('/')) path = `/${path}`;

  // 计算文件所在目录
  const lastSlashIndex = path.lastIndexOf('/');
  const parentDir = lastSlashIndex <= 0 ? '/' : path.substring(0, lastSlashIndex);

  currentDirectory.value = parentDir;

  // 从根目录加载树数据
  treeData.value = await fetchFiles('/');

  // 选中当前文件
  treeSelectedKeys.value = [fileId];

  // 展开到当前文件所在的目录路径
  // 需要收集路径上所有文件夹的 key
  const pathSegments = parentDir.split('/').filter(Boolean);
  const expandedKeys: Array<string | number> = [];

  // 遍历树找到路径上的节点并展开
  // 由于树是懒加载的，需要逐步展开
  for (const segment of pathSegments) {
    // 在当前树数据或已加载的子节点中查找该 segment 对应的节点
    const node = findNodeByPathSegment(treeData.value, segment, expandedKeys);
    if (node && node.key) {
      expandedKeys.push(node.key);
      // 模拟展开以触发懒加载
      if (node.children === undefined && !node.isLeaf) {
        await handleLoad(node);
      }
    }
  }

  treeExpandedKeys.value = expandedKeys;
}

// 根据路径段查找节点
function findNodeByPathSegment(
  nodes: TabNode[],
  segment: string,
  currentExpandedKeys: Array<string | number>
): TabNode | null {
  for (const node of nodes) {
    if (node.label === segment) {
      return node;
    }
    // 如果节点已展开，检查子节点
    if (node.key && currentExpandedKeys.includes(node.key) && node.children) {
      const found = findNodeByPathSegment(node.children, segment, currentExpandedKeys);
      if (found) return found;
    }
  }
  return null;
}

// 上一级目录
async function handleGoUp() {
  if (currentDirectory.value === '/') return;
  const parentDir = currentDirectory.value.substring(0, currentDirectory.value.lastIndexOf('/')) || '/';
  currentDirectory.value = parentDir;
  treeSelectedKeys.value = [];
}

// 刷新当前目录 - 重新加载根目录树
async function handleRefresh() {
  treeData.value = await fetchFiles('/');
  treeExpandedKeys.value = [];
  treeSelectedKeys.value = [];
}

// 新建文件/文件夹
function handleCreate() {
  window.$message?.info('新建功能开发中...');
}

const renderTreeIcon = ({ option }: { option: TabNode }) => {
  if (option.file) {
    const isDir = (option.file.isDir ?? option.file.isFolder) ?? false;
    // 处理扩展名前导点号
    const extension = (option.file.extendName ?? option.file.fileExtension)?.replace(/^\./, '') ?? '';
    const fileId = (option.file.id ?? option.file.fileId) as string | number;

    return h(FileIcon, {
      fileType: isDir ? 'folder' : 'other',
      extension,
      size: 'small',
      fileId
    });
  }
  return h(FileIcon, { fileType: 'other', size: 'small' });
};

const closeTabLogic = (path: string) => {
  const index = tabs.value.findIndex(t => t.path === path);
  if (index > -1) {
    tabs.value.splice(index, 1);
    if (activeTab.value === path) {
      activeTab.value = tabs.value[Math.max(0, index - 1)]?.path || '';
    }
  }
};

const handleCloseTab = (path: string) => {
  const tab = tabs.value.find(t => t.path === path);
  if (!tab) return;

  if (tab.isModified) {
    dialog.warning({
      title: '警告',
      content: `文件 "${tab.title}" 有未保存的修改，是否保存？`,
      positiveText: '保存',
      negativeText: '放弃修改',
      onPositiveClick: async () => {
        try {
          await saveTab(tab);
          closeTabLogic(path);
        } finally {
          //
        }
      },
      onNegativeClick: () => {
        closeTabLogic(path);
      }
    });
    return;
  }

  closeTabLogic(path);
};

const renderTreeLabel = ({ option }: { option: TabNode }) => {
  return h('span', { class: 'text-sm' }, option.label);
};

// 树节点选择
const handleTreeSelect = async (keys: Array<string | number>, options: Array<TabNode | null>) => {
  treeSelectedKeys.value = keys;
  const node = options[0];
  if (node?.file) {
    const isDir = (node.file.isDir ?? node.file.isFolder) ?? false;
    const fileId = (node.file.id ?? node.file.fileId) as string | number;

    if (isDir) {
      // 点击文件夹：选中文件夹，展开其内容，更新面包屑
      currentDirectory.value = node.fullPath || '/';

      // 如果节点还没有子节点，先加载子节点
      if (!node.children || node.children.length === 0) {
        await handleLoad(node);
      }

      // 展开文件夹
      if (!treeExpandedKeys.value.includes(fileId)) {
        treeExpandedKeys.value = [...treeExpandedKeys.value, fileId];
      }
    } else {
      // 点击文件：选中文件，打开文件，更新面包屑为文件所在目录
      const filePath = node.fullPath || '';
      const lastSlash = filePath.lastIndexOf('/');
      const parentDir = lastSlash > 0 ? filePath.substring(0, lastSlash) : '/';
      currentDirectory.value = parentDir;
      initFile(node.file, node.fullPath);
    }
  }
};

// 监听 activeTab 变化，同步树节点选中状态
watch(activeTab, newPath => {
  const tab = tabs.value.find(t => t.path === newPath);
  if (tab) {
    treeSelectedKeys.value = [tab.fileId];
  } else {
    treeSelectedKeys.value = [];
  }
});

// 切换标签
function handleTabChange(path: string) {
  const tab = tabs.value.find(t => t.path === path);
  if (tab) {
    currentContent.value = tab.content;
    markdownMode.value = path.toLowerCase().endsWith('.md');
  }
  handleExitDiffMode();
}

// 监听当前文件变化
watch(currentFile, file => {
  if (file && visible.value) {
    initFile(file);
    initTreeData(file);
  }
});

// 监听显示状态
watch(visible, show => {
  if (show && currentFile.value) {
    initFile(currentFile.value);
    initTreeData(currentFile.value);
  }
});
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="currentFile?.name"
    :closable="true"
    preset="card"
    :mask-closable="false"
    class="text-preview-modal"
    :style="dialogStyle"
    :content-style="modalContentStyle"
    :header-style="modalSectionStyle"
    :footer-style="modalSectionStyle"
    :on-close="handleClose"
    @after-leave="handleAfterLeave"
  >
    <!-- 左侧：面包屑导航 -->
    <template #header>
      <div v-if="!isShare" class="flex items-center gap-1 text-sm overflow-x-auto">
        <NButton quaternary size="small" @click="handleBreadcrumbClick('/')">
          <template #icon>
            <icon-mdi-home />
          </template>
        </NButton>
        <template v-for="(segment, index) in breadcrumbSegments" :key="segment.path">
          <span class="text-gray-400 mx-1">/</span>
          <NButton
            quaternary
            size="small"
            :type="index === breadcrumbSegments.length - 1 ? 'primary' : 'default'"
            @click="handleBreadcrumbClick(segment.path)"
          >
            {{ segment.name }}
          </NButton>
        </template>
      </div>
    </template>
    <!-- 右侧：工具按钮 -->
    <template #header-extra>
      <div class="flex items-center gap-2">
        <NTag v-if="isModified" type="warning" size="small">已修改</NTag>
        <HistoryVersionPopover
          v-if="!isShare && hasHistoryVersion"
          :file-id="currentTab?.fileId"
          :active-version-id="activeDiffVersionId"
          @preview="handleHistoryPreview"
          @restore="handleHistoryRestore"
          @delete="handleHistoryDelete"
          @emptied="handleHistoryEmptied"
        >
          <NButton size="small">
            <template #icon>
              <icon-mdi-history />
            </template>
            历史版本
          </NButton>
        </HistoryVersionPopover>
        <NButton v-if="isModified" type="primary" size="small" :loading="saving" @click="handleSave">保存</NButton>
        <NButton v-if="isMarkdown" quaternary size="small" @click="toggleMarkdownMode">
          <template #icon>
            <icon-ic-baseline-remove-red-eye v-if="!markdownMode" />
            <icon-mdi-invoice-text-edit-outline v-else />
          </template>
        </NButton>
        <NButton quaternary size="small" @click="toggleFullscreen">
          <template #icon>
            <icon-gridicons-fullscreen-exit v-if="isFullscreen" />
            <icon-gridicons-fullscreen v-else />
          </template>
        </NButton>
      </div>
    </template>
    <!-- 内容区域 -->
    <NLayout has-sider class="h-full min-h-0 overflow-hidden">
      <NLayoutSider
        v-if="!isShare"
        v-model:collapsed="collapsed"
        collapse-mode="transform"
        :collapsed-width="0"
        :width="240"
        :show-collapsed-content="false"
        show-trigger="bar"
        bordered
        resizable
        :native-scrollbar="false"
      >
        <!-- 文件树顶部工具栏 -->
        <NButtonGroup class="w-full px-2 py-1 border-b border-gray-200 dark:border-gray-700">
          <NButton quaternary size="small" class="flex-1" @click="handleGoUp">
            <template #icon>
              <icon-mdi-arrow-up />
            </template>
            <span class="hidden sm:inline">上一级</span>
          </NButton>
          <NButton quaternary size="small" class="flex-1" @click="handleRefresh">
            <template #icon>
              <icon-mdi-refresh />
            </template>
            <span class="hidden sm:inline">刷新</span>
          </NButton>
          <NButton quaternary size="small" class="flex-1" @click="handleCreate">
            <template #icon>
              <icon-mdi-plus />
            </template>
            <span class="hidden sm:inline">新建</span>
          </NButton>
        </NButtonGroup>
        <NTree
          v-model:selected-keys="treeSelectedKeys"
          v-model:expanded-keys="treeExpandedKeys"
          :data="treeData"
          block-line
          selectable
          :on-load="handleLoad"
          :render-label="renderTreeLabel"
          :render-prefix="renderTreeIcon"
          @update:selected-keys="handleTreeSelect"
        />
      </NLayoutSider>
      <NLayoutContent class="h-full min-h-0 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-[#18181c]">
        <div v-if="currentTab" class="h-full min-h-0 flex flex-col overflow-hidden">
          <div class="border-b border-gray-200 dark:border-gray-700">
            <NTabs
              v-model:value="activeTab"
              type="card"
              closable
              class="flex-none"
              @close="handleCloseTab"
              @update:value="handleTabChange"
            >
              <NTabPane
                v-for="tabItem in tabs"
                :key="tabItem.path"
                :name="tabItem.path"
                :tab="tabItem.title"
                :closable="tabs.length > 0"
              >
                <template #tab>
                  <div class="flex items-center gap-1">
                    <span>{{ tabItem.title }}</span>
                    <NBadge v-if="tabItem.isModified" dot type="warning" />
                  </div>
                </template>
              </NTabPane>
            </NTabs>
          </div>
          <!-- Diff 对比模式 -->
          <template v-if="diffMode">
            <div class="flex-none flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3 py-1 bg-gray-50 dark:bg-[#252529]">
              <div class="flex items-center gap-3 text-xs text-gray-500">
                <NTag size="small" type="info">对比模式</NTag>
                <span>当前内容 (左) vs 历史版本：{{ diffVersionInfo?.createTime }} (右)</span>
              </div>
              <div class="flex items-center gap-2">
                <NButton size="tiny" type="primary" @click="handleHistoryRestore(diffVersionInfo!)">
                  恢复此版本
                </NButton>
                <NButton size="tiny" quaternary @click="handleExitDiffMode">
                  <template #icon>
                    <icon-mdi-close />
                  </template>
                  退出对比
                </NButton>
              </div>
            </div>
            <MonacoDiffEditor
              :original="diffOriginalContent"
              :modified="diffModifiedContent"
              :language="currentTab.language"
              class="min-h-0 flex-1 w-full"
            />
          </template>
          <!-- 正常编辑模式 -->
          <template v-else>
            <div
              class="relative min-h-0 flex-1 overflow-auto p-4"
              :class="{ '!p-0 !overflow-hidden': isMarkdown && markdownMode }"
            >
              <VditorEditor
                v-if="isMarkdown && markdownMode"
                v-model="currentTab.content"
                class="absolute inset-0 size-full"
              />
              <MonacoEditor v-else v-model="currentTab.content" :language="currentTab.language" class="h-full" />
            </div>
          </template>
        </div>
        <div v-else class="h-full flex items-center justify-center text-gray-400">
          <div class="flex flex-col items-center gap-2">
            <div class="i-mdi-file-document-outline text-6xl opacity-50"></div>
            <span>请选择文件查看</span>
          </div>
        </div>
      </NLayoutContent>
    </NLayout>
    <!-- 底部状态栏 -->
    <template #footer>
      <div class="flex items-center justify-between text-xs text-gray-500">
        <div class="flex items-center gap-4">
          <span>{{ currentLanguage }}</span>
          <span>行 {{ cursorLine }}, 列 {{ cursorColumn }}</span>
          <span>{{ currentFile?.size ? formatFileSize(currentFile.size) : '' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="lastSaved">上次保存: {{ formatTime(lastSaved) }}</span>
        </div>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.text-preview-modal {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.text-preview-modal .n-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

:deep(.text-preview-modal .n-card__content) {
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.text-preview-modal .n-card__header),
:deep(.text-preview-modal .n-card__footer) {
  flex: none;
}

:deep(.text-preview-modal .n-tabs-nav) {
  padding: 0 12px;
}
</style>
