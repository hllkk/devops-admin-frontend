import type { AxiosError, AxiosResponse } from 'axios';
import type { FlatResponseData } from '@sa/axios';

export interface MockOptions {
  /** 最小延迟 ms */
  min?: number;
  /** 最大延迟 ms */
  max?: number;
  /** 模拟失败概率 0-1（演示错误态用，默认 0） */
  failureRate?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Mock 请求助手：返回与 `createFlatRequest` 相同的 FlatResponseData 形态。
 * 后端就绪后，把 service 函数体从 `mockRequest(...)` 改为 `request<T>({...})` 即可，调用方零改动。
 */
export async function mockRequest<T>(
  factory: () => T,
  opts: MockOptions = {}
): Promise<FlatResponseData<App.Service.Response<T>, T>> {
  const { min = 120, max = 360, failureRate = 0 } = opts;
  const ms = Math.floor(min + (max - min) * (Math.abs(Math.sin(Date.now())) % 1));
  await delay(ms);

  if (failureRate > 0 && Math.random() < failureRate) {
    const error = new Error('mock: simulated failure') as AxiosError<App.Service.Response<T>>;
    const response = { data: { code: '500', msg: 'mock error', data: null } } as AxiosResponse<App.Service.Response<T>>;
    return { data: null, error, response };
  }

  const result = factory();
  const response = {
    data: { code: '0000', msg: 'ok', data: result }
  } as AxiosResponse<App.Service.Response<T>>;
  return { data: result, error: null, response };
}
