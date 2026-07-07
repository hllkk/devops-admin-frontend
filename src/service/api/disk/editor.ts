import { request } from '@/service/request';
import type { Editor } from '@/typings/editor';

/** 获取文件树（懒加载） */
export function fetchFileTree(path?: string) {
  return request<Editor.FileTreeNode[]>({
    url: '/file-meta/file-tree',
    method: 'get',
    params: { path: path || '' }
  });
}

/** 保存文件并创建历史快照 */
export function fetchSaveWithHistory(data: { fileId: CommonType.IdType; content: string }) {
  // 确保 fileId 为数字类型（后端期望 int64）
  const fileIdNum = typeof data.fileId === 'string' ? parseInt(data.fileId, 10) : data.fileId;
  return request<Editor.SaveResult>({
    url: '/file-meta/history/save',
    method: 'post',
    data: { fileId: fileIdNum, content: data.content }
  });
}

/** 获取历史版本列表 */
export function fetchHistoryList(fileId: CommonType.IdType) {
  return request<Editor.HistoryVersion[]>({
    url: '/file-meta/history/list',
    method: 'get',
    params: { fileId }
  });
}

/** 获取历史版本内容 */
export function fetchHistoryContent(versionId: CommonType.IdType) {
  return request<string>({
    url: '/file-meta/history/content',
    method: 'get',
    params: { versionId }
  });
}

/** 恢复历史版本 */
export function fetchRestoreHistory(versionId: CommonType.IdType) {
  return request<Editor.RestoreResult>({
    url: '/file-meta/history/restore',
    method: 'post',
    data: { versionId }
  });
}

/** 删除历史版本 */
export function fetchDeleteHistory(versionIds: CommonType.IdType[]) {
  return request<boolean>({
    url: '/file-meta/history',
    method: 'delete',
    data: { versionIds }
  });
}