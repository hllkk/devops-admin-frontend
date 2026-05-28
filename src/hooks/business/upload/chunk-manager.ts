import { fetchUploadConfig } from '@/service/api/disk/file';

const MB = 1024 * 1024;

/** 默认分片配置（后端未返回时使用） */
const DEFAULT_CHUNK_SIZES = { small: 10, medium: 20, large: 50, huge: 100 };

let cachedConfig: Api.Disk.UploadConfig | null = null;
let configPromise: Promise<Api.Disk.UploadConfig> | null = null;

const DEFAULT_CONFIG: Api.Disk.UploadConfig = {
  chunkConcurrency: 6,
  chunkSizeSmall: DEFAULT_CHUNK_SIZES.small,
  chunkSizeMedium: DEFAULT_CHUNK_SIZES.medium,
  chunkSizeLarge: DEFAULT_CHUNK_SIZES.large,
  chunkSizeHuge: DEFAULT_CHUNK_SIZES.huge,
  maxUploadSize: 100
};

/** 从后端获取上传配置（带缓存） */
async function loadUploadConfig(): Promise<Api.Disk.UploadConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    const { data, error } = await fetchUploadConfig();
    if (!error && data) {
      cachedConfig = data;
      return data;
    }
    return DEFAULT_CONFIG;
  })();

  return configPromise;
}

/** 获取分片大小配置（异步） */
export async function getChunkSizes(): Promise<{ small: number; medium: number; large: number; huge: number }> {
  const config = await loadUploadConfig();
  return {
    small: config.chunkSizeSmall || DEFAULT_CHUNK_SIZES.small,
    medium: config.chunkSizeMedium || DEFAULT_CHUNK_SIZES.medium,
    large: config.chunkSizeLarge || DEFAULT_CHUNK_SIZES.large,
    huge: config.chunkSizeHuge || DEFAULT_CHUNK_SIZES.huge
  };
}

/** 获取并发数配置（异步） */
export async function getConcurrency(): Promise<number> {
  const config = await loadUploadConfig();
  return config.chunkConcurrency || 6;
}

/** 动态分片策略：根据文件大小和后端配置确定分片大小 */
export async function getChunkSize(fileSize: number): Promise<number> {
  const sizes = await getChunkSizes();
  if (fileSize < 10 * MB) return 0;
  if (fileSize < 100 * MB) return sizes.small * MB;
  if (fileSize < 1024 * MB) return sizes.medium * MB;
  if (fileSize < 5 * 1024 * MB) return sizes.large * MB;
  return sizes.huge * MB;
}

/** 是否需要分片 */
export function needsChunking(fileSize: number): boolean {
  return fileSize >= 10 * MB;
}

/** 计算总分片数 */
export function getTotalChunks(fileSize: number, chunkSize: number): number {
  if (chunkSize === 0) return 1;
  return Math.ceil(fileSize / chunkSize);
}

/** 获取最大上传大小（MB），联动网盘系统设置 */
export async function getMaxUploadSize(): Promise<number> {
  const config = await loadUploadConfig();
  return config.maxUploadSize ?? 100;
}

/** 切出指定分片 */
export function sliceChunk(file: File, chunkIndex: number, chunkSize: number): Blob {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  return file.slice(start, end);
}

/** 获取文件扩展名（小写，无点） */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}
