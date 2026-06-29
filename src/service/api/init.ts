import { request } from '../request';

/**
 * 检查数据库是否需要初始化
 */
export function fetchCheckDB() {
  return request<Api.Init.CheckDBResponse>({
    url: '/init/checkDB',
    method: 'get'
  });
}

/**
 * 测试数据库或Redis连接是否可用
 * @param data 连接测试参数（connectType: 'db' | 'redis'）
 */
export function fetchTestConnect(data: Api.Init.TestConnectRequest) {
  return request<void>({
    url: '/init/testConnect',
    method: 'post',
    data,
    timeout: 15000
  });
}

/**
 * Docker环境自动初始化数据库
 * 使用docker-compose配置自动完成初始化
 */
export function fetchAutoInitDB() {
  return request<void>({
    url: '/init/autoInitDB',
    method: 'post',
    timeout: 5 * 60 * 1000 // 5分钟超时，初始化可能需要较长时间
  });
}

/**
 * 手动初始化数据库
 * @param data 初始化参数
 * 注意：初始化可能需要较长时间，设置较长的超时时间
 */
export function fetchInitDB(data: Api.Init.InitDBRequest) {
  return request<void>({
    url: '/init/initDB',
    method: 'post',
    data,
    timeout: 5 * 60 * 1000 // 5分钟超时，初始化可能需要较长时间
  });
}
