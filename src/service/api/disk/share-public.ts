import { request } from '@/service/request';

/** 获取公开分享信息 */
export function fetchGetSharePublic(shortId: string) {
  return request<Api.Disk.SharePublicInfo>({
    url: `/share/public/${shortId}`,
    method: 'get'
  });
}

/** 验证私密分享提取码 */
export function fetchVerifyShare(data: { shortId: string; extractionCode: string }) {
  return request<Api.Disk.SharePublicInfo>({
    url: '/share/verify',
    method: 'post',
    data
  });
}

/** 下载分享文件 */
export function fetchDownloadShareFile(
  shortId: string,
  fileId: CommonType.IdType,
  extractionCode?: string
) {
  return request<{ downloadUrl: string }>({
    url: `/share/download/${shortId}/${fileId}`,
    method: 'get',
    headers: extractionCode ? { 'X-Extraction-Code': extractionCode } : undefined
  });
}

/** 打包下载全部分享文件 */
export function fetchDownloadSharePackage(shortId: string, extractionCode?: string) {
  return request<{ downloadUrl: string }>({
    url: `/share/package/${shortId}`,
    method: 'get',
    headers: extractionCode ? { 'X-Extraction-Code': extractionCode } : undefined
  });
}