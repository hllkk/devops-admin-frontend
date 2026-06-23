import { request } from '@/service/request';

/** Sync WeChat Work organization structure (departments + users), returns sync statistics */
export function fetchSyncWecomStructure() {
  return request<Api.SystemManage.WecomSyncResult>({
    url: '/wecom/syncStructure',
    method: 'post'
  });
}
