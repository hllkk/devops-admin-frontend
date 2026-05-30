/**
 * Office 文档配置工具函数
 * 用于生成 OnlyOffice 编辑器所需的各类 URL 和配置
 */

import type { DocumentType } from '@/types/office';

/** 默认文档服务器地址 */
const DEFAULT_DOCUMENT_SERVER = '/office';

/** 默认回调服务器地址 */
const DEFAULT_CALLBACK_SERVER = '/api';

/**
 * 文档类型映射
 */
const DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
  // Word 文档类型
  doc: 'text',
  docm: 'text',
  docx: 'text',
  docxf: 'text',
  dot: 'text',
  dotm: 'text',
  dotx: 'text',
  odt: 'text',
  ott: 'text',
  rtf: 'text',
  txt: 'text',
  pdf: 'text',
  epub: 'text',
  fb2: 'text',
  htm: 'text',
  html: 'text',
  mht: 'text',
  fodt: 'text',
  // Excel 文档类型
  csv: 'spreadsheet',
  xls: 'spreadsheet',
  xlsb: 'spreadsheet',
  xlsm: 'spreadsheet',
  xlsx: 'spreadsheet',
  xlt: 'spreadsheet',
  xltm: 'spreadsheet',
  xltx: 'spreadsheet',
  ods: 'spreadsheet',
  ots: 'spreadsheet',
  fods: 'spreadsheet',
  // PPT 文档类型
  ppt: 'presentation',
  pptm: 'presentation',
  pptx: 'presentation',
  pot: 'presentation',
  potm: 'presentation',
  potx: 'presentation',
  pps: 'presentation',
  ppsm: 'presentation',
  ppsx: 'presentation',
  odp: 'presentation',
  otp: 'presentation',
  fodp: 'presentation'
};

/**
 * 文件类型标准化映射
 * 将旧格式映射为新格式 (doc -> docx, xls -> xlsx, ppt -> pptx)
 */
const FILE_TYPE_NORMALIZE: Record<string, string> = {
  doc: 'docx',
  word: 'docx',
  xls: 'xlsx',
  excel: 'xlsx',
  ppt: 'pptx',
  pot: 'pptx',
  pps: 'pptx'
};

/**
 * 获取 OnlyOffice API 地址
 * @param documentServer 文档服务器地址
 * @returns API JS 文件完整 URL
 */
export function getOfficeApiUrl(documentServer?: string): string {
  const server = (documentServer || DEFAULT_DOCUMENT_SERVER).replace(/\/$/, '');
  return `${server}/web-apps/apps/api/documents/api.js`;
}

/**
 * 获取 Office 回调基础 URL
 * @param callbackServer 回调服务器地址
 * @returns 回调服务器基础 URL (末尾不带斜杠)
 */
export function getOfficeCallbackBaseUrl(callbackServer?: string): string {
  return (callbackServer || DEFAULT_CALLBACK_SERVER).replace(/\/$/, '');
}

/**
 * 获取 Office 回调 URL
 * @param callbackServer 回调服务器地址 (如 http://172.21.10.40:8888/api/v1)
 * @param fileId 文件 ID
 * @returns 回调 URL
 */
export function getOfficeCallbackUrl(
  callbackServer?: string,
  fileId?: CommonType.IdType
): string {
  const baseUrl = getOfficeCallbackBaseUrl(callbackServer);
  const params = new URLSearchParams();

  if (fileId) params.set('fileId', String(fileId));

  return `${baseUrl}/office/callback?${params.toString()}`;
}

/**
 * 获取文档预览 URL
 * @param userId 用户ID (数字)
 * @param filePath 文件路径 (如 "/Ai 给出的逻辑")
 * @param fileName 文件名 (如 "角色_1774948863323.xlsx")
 * @param token 用户 token
 * @param baseUrl API 基础 URL (如 http://172.21.10.40:8888/api/v1)
 * @returns 预览 URL
 */
export function getOfficePreviewUrl(
  userId: CommonType.IdType,
  filePath: string,
  fileName: string,
  token?: string,
  baseUrl?: string
): string {
  const apiBase = baseUrl || DEFAULT_CALLBACK_SERVER;

  // 规范化路径：确保以 / 开头，去掉末尾的 /
  let normalizedPath = filePath;
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  normalizedPath = normalizedPath.replace(/\/+$/, '');

  // 编码路径（保留 / 作为分隔符）
  const encodedPath = normalizedPath
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');

  // 编码文件名
  const encodedName = encodeURIComponent(fileName);

  // 完整路径: /{userId}/{path}/{filename}
  // 例如: /424818778103877/Ai%20给出的逻辑/角色_1774948863323.xlsx
  const fullPath = `${userId}${encodedPath}/${encodedName}`;

  let url = `${apiBase}/file/${fullPath}`;

  if (token) {
    url += `?token=${token}`;
  }

  return url;
}

/**
 * 获取共享文件预览 URL
 * @param fileId 文件 ID
 * @param shareId 分享 ID
 * @param shareToken 分享 token
 * @param fileName 文件名
 * @param baseUrl API 基础 URL
 * @returns 共享预览 URL
 */
export function getOfficeSharePreviewUrl(
  fileId: CommonType.IdType,
  shareId: string,
  shareToken: string,
  fileName: string,
  baseUrl?: string
): string {
  const apiBase = baseUrl || DEFAULT_CALLBACK_SERVER;
  const encodedName = encodeURIComponent(fileName);
  return `${apiBase}/share-file/${fileId}/${shareToken}/${encodedName}`;
}

/**
 * 获取历史版本预览 URL
 * @param callbackServer 回调服务器地址
 * @param historyId 历史 ID
 * @param username 用户名
 * @param token 用户 token
 * @returns 历史版本预览 URL
 */
export function getOfficeHistoryPreviewUrl(
  callbackServer?: string,
  historyId?: CommonType.IdType,
  username?: string,
  token?: string
): string {
  const baseUrl = getOfficeCallbackBaseUrl(callbackServer);
  const params = new URLSearchParams();

  if (historyId) params.set('id', String(historyId));
  if (username) params.set('name', username);
  if (token) params.set('token', token);  // 使用 token 参数名

  return `${baseUrl}/history/preview/file?${params.toString()}`;
}

/**
 * 根据文件后缀获取文档类型
 * @param fileType 文件后缀 (不含点)
 * @returns 文档类型: text, spreadsheet, presentation
 */
export function getDocumentType(fileType: string): DocumentType {
  const normalizedType = fileType.toLowerCase();
  return DOCUMENT_TYPE_MAP[normalizedType] || 'text';
}

/**
 * 标准化文件类型
 * @param suffix 文件后缀 (不含点)
 * @returns 标准化后的文件类型
 */
export function normalizeFileType(suffix: string): string {
  const lower = suffix.toLowerCase();
  return FILE_TYPE_NORMALIZE[lower] || lower;
}

/**
 * 生成文档唯一标识 (key)
 * @param updateDate 更新时间
 * @param fileId 文件 ID
 * @param baseUrl 基础 URL (用于增加唯一性)
 * @returns 文档 key
 */
export function generateDocumentKey(
  updateDate: string | Date | number,
  fileId: CommonType.IdType | string,
  baseUrl?: string
): string {
  const timestamp = typeof updateDate === 'string'
    ? new Date(updateDate).getTime()
    : typeof updateDate === 'number'
      ? updateDate
      : updateDate.getTime();

  const uniquePart = baseUrl ? `${fileId}${baseUrl}` : String(fileId);
  // 使用简单哈希生成唯一标识
  const hash = simpleHash(uniquePart);

  return `${timestamp}-${hash}`;
}

/**
 * 简单哈希函数
 * @param str 输入字符串
 * @returns 哈希值
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 判断文件是否为 Office 类型
 * @param suffix 文件后缀 (不含点)
 * @returns 是否为 Office 文件
 */
export function isOfficeFile(suffix: string): boolean {
  const lower = suffix.toLowerCase();
  return Object.keys(DOCUMENT_TYPE_MAP).includes(lower);
}

/**
 * 获取支持的 Office 文件格式列表
 * @returns 支持的格式列表
 */
export function getSupportedOfficeFormats(): string[] {
  return Object.keys(DOCUMENT_TYPE_MAP);
}

/**
 * 动态加载 OnlyOffice API
 * @param url API URL
 * @returns Promise，加载成功时 resolve，失败时 reject
 */
export function loadOfficeApi(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    if (window.DocsAPI) {
      resolve();
      return;
    }

    // 创建 script 元素
    const script = document.createElement('script');
    script.src = url;
    script.type = 'text/javascript';
    script.async = true;

    script.addEventListener('load', () => {
      if (window.DocsAPI) {
        resolve();
      } else {
        reject(new Error('DocsAPI not available after script load'));
      }
    });

    script.addEventListener('error', () => {
      reject(new Error(`Failed to load OnlyOffice API from ${url}`));
    });

    document.head.appendChild(script);
  });
}