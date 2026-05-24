/**
 * Office 文档 API 接口
 */

import { request } from '@/service/request';
import type { ServerConfig, EditorConfig, HistoryVersion, HealthCheckResult } from '@/types/office';

/**
 * 获取 Office 服务器配置
 */
export function fetchGetOfficeConfig() {
  return request<ServerConfig>({
    url: '/office/config',
    method: 'get'
  });
}

/**
 * 检查 OnlyOffice 服务健康状态
 */
export function fetchCheckOfficeHealth() {
  return request<HealthCheckResult>({
    url: '/office/health',
    method: 'get'
  });
}

/**
 * 获取公共分享的 Office 服务器配置
 * @param shareId 分享 ID
 * @param shareToken 分享 token
 */
export function fetchGetPublicOfficeConfig(shareId: string, shareToken?: string) {
  return request<ServerConfig>({
    url: '/office/public/config',
    method: 'get',
    params: { shareId, shareToken }
  });
}

/**
 * 获取 Office JWT Token
 * @param config 编辑器配置
 */
export function fetchGetOfficeJwt(config: EditorConfig) {
  return request<string>({
    url: '/office/jwt',
    method: 'post',
    data: config
  });
}

/**
 * 获取公共分享的 Office JWT Token
 * @param shareId 分享 ID
 * @param shareToken 分享 token
 * @param config 编辑器配置
 */
export function fetchGetPublicOfficeJwt(shareId: string, shareToken: string, config: EditorConfig) {
  return request<string>({
    url: '/office/public/jwt',
    method: 'post',
    params: { shareId, shareToken },
    data: config
  });
}

/**
 * 获取 Office 文档历史版本列表
 * @param fileId 文件 ID
 * @param pageSize 每页数量
 * @param pageIndex 页码
 */
export function fetchGetOfficeHistoryList(
  fileId: CommonType.IdType,
  pageSize: number = 100,
  pageIndex: number = 1
) {
  return request<HistoryVersion[]>({
    url: '/office/history/list',
    method: 'get',
    params: { fileId, pageSize, pageIndex }
  });
}

/**
 * 获取历史版本 JWT Token
 * @param historyConfig 历史版本配置
 */
export function fetchGetOfficeJwtHistory(historyConfig: {
  fileType: string;
  key: string;
  url: string;
  version: string;
}) {
  return request<string>({
    url: '/office/jwt/history',
    method: 'post',
    data: historyConfig
  });
}

/**
 * 获取文件信息
 * @param fileId 文件 ID
 */
export function fetchGetFileInfoById(fileId: CommonType.IdType) {
  return request({
    url: '/file-meta/info',
    method: 'get',
    params: { id: fileId }
  });
}

/**
 * 获取公共分享文件信息
 * @param fileId 文件 ID
 * @param shareId 分享 ID
 */
export function fetchGetPublicFileInfoById(fileId: CommonType.IdType, shareId: string) {
  return request({
    url: '/file-meta/public/info',
    method: 'get',
    params: { fileId, shareId }
  });
}