/**
 * Office 文档配置工具函数
 * 用于生成 OnlyOffice 编辑器所需的各类 URL 和配置
 */

import type { DocumentType } from '@/typings/office';

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
 * 获取文档预览 URL（通过文件ID，由后端解析实际存储路径）
 * @param fileId 文件ID
 * @param baseUrl API 基础 URL (如 http://172.21.10.40:8888/api/v1)
 * @returns 预览 URL
 */
export function getOfficePreviewUrl(
  fileId: CommonType.IdType,
  baseUrl?: string
): string {
  const apiBase = baseUrl || DEFAULT_CALLBACK_SERVER;
  return `${apiBase}/office/file/${fileId}`;
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
 * @param fileType 文件后缀（可能含前缀点号）
 * @returns 文档类型: text, spreadsheet, presentation
 */
export function getDocumentType(fileType: string): DocumentType {
  const normalizedType = fileType.toLowerCase().replace(/^\.+/, '');
  return DOCUMENT_TYPE_MAP[normalizedType] || 'text';
}

/**
 * 标准化文件类型（去掉前缀点号）
 * OnlyOffice 要求 fileType 为不含点的扩展名，且必须与文件实际格式一致
 * @param suffix 文件后缀（可能含前缀点号）
 * @returns 标准化后的文件类型（不含点）
 */
export function normalizeFileType(suffix: string): string {
  return suffix.toLowerCase().replace(/^\.+/, '');
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