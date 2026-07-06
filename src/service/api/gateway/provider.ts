import { request } from '@/service/request';

/** 分页获取供应商列表 */
export function fetchGetProviderPage(params: Api.Gateway.ProviderSearchParams) {
  return request<Api.Gateway.ProviderList>({
    url: '/gateway/provider/page',
    method: 'get',
    params
  });
}

/** 根据 ID 获取供应商 */
export function fetchGetProviderById(id: CommonType.IdType) {
  return request<Api.Gateway.Provider>({
    url: `/gateway/provider/${id}`,
    method: 'get'
  });
}

/** 新增供应商 */
export function fetchCreateProvider(data: Api.Gateway.ProviderOperateParams) {
  return request<boolean>({
    url: '/gateway/provider',
    method: 'post',
    data
  });
}

/** 修改供应商 */
export function fetchUpdateProvider(data: Api.Gateway.ProviderOperateParams) {
  return request<boolean>({
    url: '/gateway/provider',
    method: 'put',
    data
  });
}

/** 批量删除供应商 */
export function fetchBatchDeleteProvider(ids: CommonType.IdType[]) {
  return request<boolean>({
    url: `/gateway/provider/${ids.join(',')}`,
    method: 'delete'
  });
}
