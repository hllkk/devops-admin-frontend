import { request } from '@/service/request';

export interface ArchiveEntry {
  name: string;
  path: string;
  isFolder: boolean;
  suffix: string;
  size: number;
  children?: ArchiveEntry[];
}

/** 列出归档文件顶层内容 */
export function fetchListArchive(fileId: string) {
  return request<ArchiveEntry[]>({
    url: `/archive/list/${fileId}`,
    method: 'get'
  });
}

/** 列出归档内子目录内容 */
export function fetchListSubArchive(fileId: string, path: string) {
  return request<ArchiveEntry[]>({
    url: '/archive/list-sub',
    method: 'get',
    params: { fileId, path }
  });
}

/** 解压归档到目标目录 */
export function fetchExtractArchive(fileId: string, destFolderId: string) {
  return request<void>({
    url: '/archive/extract',
    method: 'post',
    data: { fileId, destFolderId }
  });
}
