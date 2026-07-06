import { request } from '@/service/request';

/** 按用户维度获取 AI 身份列表 */
export function fetchGetAiKeyIdentityList(params: Api.Gateway.AiKeySearchParams) {
  return request<Api.Gateway.AiKeyIdentityList>({
    url: '/gateway/ai-key/identity',
    method: 'get',
    params
  });
}

/** 获取 AI Key 详情 */
export function fetchGetAiKeyById(id: number) {
  return request<Api.Gateway.AiKey>({
    url: `/gateway/ai-key/${id}`,
    method: 'get'
  });
}

/** 创建 AI Key */
export function fetchCreateAiKey(data: Api.Gateway.AiKeyOperateParams) {
  return request<boolean>({
    url: '/gateway/ai-key',
    method: 'post',
    data
  });
}

/** 更新 AI Key */
export function fetchUpdateAiKey(data: Api.Gateway.AiKeyOperateParams) {
  return request<boolean>({
    url: '/gateway/ai-key',
    method: 'put',
    data
  });
}

/** 切换 AI Key 启用状态 */
export function fetchToggleAiKey(id: number) {
  return request<boolean>({
    url: `/gateway/ai-key/${id}/toggle`,
    method: 'put'
  });
}

/** 删除 AI Key */
export function fetchDeleteAiKey(id: number) {
  return request<boolean>({
    url: `/gateway/ai-key/${id}`,
    method: 'delete'
  });
}
