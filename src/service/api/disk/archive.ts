import { request } from '@/service/request';

export interface ArchiveEntry {
  name: string;
  path: string;
  isFolder: boolean;
  suffix: string;
  size: number;
  children?: ArchiveEntry[];
}

/** 大体积归档文件（ISO等）列出内容可能耗时较长 */
const ARCHIVE_LIST_TIMEOUT = 2 * 60 * 1000;

/** 解压大归档文件耗时更长 */
const ARCHIVE_EXTRACT_TIMEOUT = 10 * 60 * 1000;

/** 列出归档文件顶层内容 */
export function fetchListArchive(fileId: string) {
  return request<ArchiveEntry[]>({
    url: `/archive/list/${fileId}`,
    method: 'get',
    timeout: ARCHIVE_LIST_TIMEOUT
  });
}

/** 列出归档内子目录内容 */
export function fetchListSubArchive(fileId: string, path: string) {
  return request<ArchiveEntry[]>({
    url: '/archive/list-sub',
    method: 'get',
    params: { fileId, path },
    timeout: ARCHIVE_LIST_TIMEOUT
  });
}

/** 解压归档参数（与后端 ExtractArchiveRequest 一一对应） */
export interface ExtractArchiveParams {
  fileId: CommonType.IdType;
  destPath: string;
  intoSubfolder: boolean;
}

/** 解压归档到目标目录 */
export function fetchExtractArchive(params: ExtractArchiveParams) {
  return request<void>({
    url: '/archive/extract',
    method: 'post',
    data: params,
    timeout: ARCHIVE_EXTRACT_TIMEOUT
  });
}
