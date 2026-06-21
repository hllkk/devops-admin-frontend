<script setup lang="ts">
import { ref } from 'vue';

import type { DiskSettingConfig } from '../types';

import { fetchCheckOfficeHealth } from '@/service/api/disk/office';

defineOptions({
  name: 'DiskSetting'
});

const configModel = defineModel<DiskSettingConfig>('config', { required: true });

const transcodePresetOptions = [
  { label: 'ultrafast', value: 'ultrafast' },
  { label: 'superfast', value: 'superfast' },
  { label: 'veryfast', value: 'veryfast' },
  { label: 'faster', value: 'faster' },
  { label: 'fast', value: 'fast' },
  { label: 'medium', value: 'medium' },
  { label: 'slow', value: 'slow' },
  { label: 'slower', value: 'slower' },
  { label: 'veryslow', value: 'veryslow' }
];

const healthChecking = ref(false);
const healthResult = ref<{ available: boolean; message: string } | null>(null);

async function testConnection() {
  healthChecking.value = true;
  healthResult.value = null;
  try {
    const res = await fetchCheckOfficeHealth();
    const data = res.data;
    if (data?.available) {
      healthResult.value = { available: true, message: `连接成功 (${data.responseMs}ms)` };
    } else {
      healthResult.value = { available: false, message: data?.error || '连接失败' };
    }
  } catch {
    healthResult.value = { available: false, message: '请求失败，请检查后端服务' };
  } finally {
    healthChecking.value = false;
  }
}
</script>

<template>
  <div class="disk-setting">
    <NTabs type="line">
      <NTabPane name="basic" tab="基础配置">
        <NForm :model="configModel" label-placement="left" :label-width="120" class="mt-16px">
          <NFormItem label="最大上传大小" path="maxUploadSize">
            <NInputNumber v-model:value="configModel.maxUploadSize" :min="1" class="max-w-200px">
              <template #suffix>MB</template>
            </NInputNumber>
          </NFormItem>
          <NFormItem label="允许的文件类型" path="allowedFileTypes">
            <NInput v-model:value="configModel.allowedFileTypes" placeholder="空表示允许全部，多个用逗号分隔，如: jpg,png,pdf" class="max-w-400px" />
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    允许的文件类型
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                留空表示允许所有文件类型。填写文件扩展名（不含点号），多个用逗号分隔。
              </NTooltip>
            </template>
          </NFormItem>
          <NFormItem label="禁止的文件类型" path="blockedFileTypes">
            <NInput v-model:value="configModel.blockedFileTypes" placeholder="禁止上传的文件类型，多个用逗号分隔，如: exe,bat,sh" class="max-w-400px" />
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    禁止的文件类型
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                填写禁止上传的文件扩展名（不含点号），优先级高于"允许的文件类型"。留空表示不禁止任何类型。
              </NTooltip>
            </template>
          </NFormItem>
          <NFormItem label="存储配额" path="storageQuota">
            <NInputNumber v-model:value="configModel.storageQuota" :min="1" class="max-w-200px">
              <template #suffix>GB</template>
            </NInputNumber>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="personal" tab="个性化配置">
        <NForm :model="configModel" label-placement="left" :label-width="120" class="mt-16px">
          <NFormItem label="网盘名称" path="diskName">
            <NInput v-model:value="configModel.diskName" placeholder="请输入网盘名称" class="max-w-400px" />
          </NFormItem>
          <NFormItem label="网盘Logo" path="diskLogo">
            <NInput v-model:value="configModel.diskLogo" placeholder="请输入网盘Logo地址" class="max-w-400px" />
          </NFormItem>
          <NDivider />
          <div class="section-title">分享链接配置</div>
          <NFormItem label="分享需要密码" path="shareLinkPasswordRequired">
            <NSwitch v-model:value="configModel.shareLinkPasswordRequired" />
          </NFormItem>
          <NFormItem label="分享密码最小长度" path="shareLinkPasswordMinLength">
            <NInputNumber v-model:value="configModel.shareLinkPasswordMinLength" :min="4" :max="32" class="max-w-200px" />
          </NFormItem>
          <NDivider />
          <div class="section-title">上传链接配置</div>
          <NFormItem label="上传需要密码" path="uploadLinkPasswordRequired">
            <NSwitch v-model:value="configModel.uploadLinkPasswordRequired" />
          </NFormItem>
          <NFormItem label="上传密码最小长度" path="uploadLinkPasswordMinLength">
            <NInputNumber v-model:value="configModel.uploadLinkPasswordMinLength" :min="4" :max="32" class="max-w-200px" />
          </NFormItem>
          <NDivider />
          <NFormItem label="启用同步" path="syncEnabled">
            <NSwitch v-model:value="configModel.syncEnabled" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="onlyoffice" tab="OnlyOffice">
        <NForm :model="configModel" label-placement="left" :label-width="120" class="mt-16px">
          <NFormItem label="启用OnlyOffice" path="onlyOfficeEnabled">
            <NSwitch v-model:value="configModel.onlyOfficeEnabled" />
          </NFormItem>
          <NFormItem label="OnlyOffice地址" path="onlyOfficeUrl">
            <NInput v-model:value="configModel.onlyOfficeUrl" placeholder="如: /office 或 https://domain.com/office" class="max-w-400px" />
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    OnlyOffice地址
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                Document Server 的浏览器访问地址。开发环境填写 nginx 代理地址（如 https://j.chinargb.com.cn:3000/office），生产环境填写 nginx 代理路径（如 /office 或 http://域名/office）
              </NTooltip>
            </template>
          </NFormItem>
          <NFormItem label="Secret密钥" path="onlyOfficeSecret">
            <NInput v-model:value="configModel.onlyOfficeSecret" type="password" placeholder="与OnlyOffice容器JWT_SECRET一致" class="max-w-400px" />
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    Secret密钥
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                与 Document Server 容器的 JWT_SECRET 环境变量保持一致。留空则不使用 JWT 签名。
              </NTooltip>
            </template>
          </NFormItem>
          <NFormItem label="回调地址" path="onlyOfficeCallbackUrl">
            <NInput v-model:value="configModel.onlyOfficeCallbackUrl" placeholder="如: http://192.168.1.100:3000/api (OnlyOffice容器可访问的后端地址)" class="max-w-400px" />
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    回调地址
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                OnlyOffice容器需要能访问此地址来保存文档。请填写后端服务的完整地址（含协议和端口），如: http://后端IP:端口/api
              </NTooltip>
            </template>
          </NFormItem>
          <NFormItem label="连接状态">
            <NSpace align="center">
              <NButton
                type="primary"
                :loading="healthChecking"
                @click="testConnection"
              >
                测试连接
              </NButton>
              <NTag v-if="healthResult" :type="healthResult.available ? 'success' : 'error'">
                {{ healthResult.message }}
              </NTag>
            </NSpace>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="video" tab="视频转码">
        <NForm :model="configModel" label-placement="left" :label-width="120" class="mt-16px">
          <NFormItem label="启用视频转码" path="videoTranscodeEnabled">
            <NSwitch v-model:value="configModel.videoTranscodeEnabled" />
          </NFormItem>
          <NFormItem label="FFmpeg路径" path="ffmpegPath">
            <NInput v-model:value="configModel.ffmpegPath" placeholder="请输入FFmpeg可执行文件路径" class="max-w-400px" />
          </NFormItem>
          <NFormItem label="转码线程数" path="transcodeThreads">
            <NInputNumber v-model:value="configModel.transcodeThreads" :min="1" :max="64" class="max-w-200px" />
          </NFormItem>
          <NFormItem label="转码预设" path="transcodePreset">
            <NSelect v-model:value="configModel.transcodePreset" :options="transcodePresetOptions" placeholder="请选择转码预设" class="max-w-200px" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="archive" tab="解压缩">
        <NForm :model="configModel" label-placement="left" :label-width="150" class="mt-16px">
          <NFormItem path="maxConcurrentExtract">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    每用户并发解压数
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                每个用户同时进行的解压任务上限，超出后返回提示"有正在进行的解压任务"
              </NTooltip>
            </template>
            <NInputNumber v-model:value="configModel.maxConcurrentExtract" :min="1" :max="10" class="max-w-200px" />
          </NFormItem>
          <NFormItem path="archiveCmdTimeout">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    命令超时时间
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                7z/unar 命令的最大执行时间，超时后强制终止进程
              </NTooltip>
            </template>
            <NInputNumber v-model:value="configModel.archiveCmdTimeout" :min="5" :max="120" class="max-w-200px">
              <template #suffix>分钟</template>
            </NInputNumber>
          </NFormItem>
          <NDivider />
          <div class="section-title">安全限制（ZIP 炸弹防护）</div>
          <NFormItem path="maxArchiveFileCount">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    最大文件数
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                单次解压允许的最大文件数量，超过此限制将拒绝解压（防止 ZIP 炸弹攻击）
              </NTooltip>
            </template>
            <NInputNumber v-model:value="configModel.maxArchiveFileCount" :min="100" :max="500000" class="max-w-200px" />
          </NFormItem>
          <NFormItem path="maxArchiveTotalSize">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    最大解压大小
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                单次解压允许的最大总大小（所有文件解压后大小之和），超过此限制将拒绝解压
              </NTooltip>
            </template>
            <NInputNumber v-model:value="configModel.maxArchiveTotalSize" :min="1" :max="500" class="max-w-200px">
              <template #suffix>GB</template>
            </NInputNumber>
          </NFormItem>
          <NDivider />
          <NFormItem path="archiveCacheTtl">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="flex items-center gap-4px">
                    列表缓存时间
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  </span>
                </template>
                压缩包内容列表的缓存有效期，浏览子目录时从缓存读取（避免重复解析压缩包）
              </NTooltip>
            </template>
            <NInputNumber v-model:value="configModel.archiveCacheTtl" :min="1" :max="60" class="max-w-200px">
              <template #suffix>分钟</template>
            </NInputNumber>
          </NFormItem>
        </NForm>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.disk-setting {
  padding: 0;
}

.section-title {
  font-weight: 500;
  color: #333;
  font-size: 15px;
  margin-bottom: 16px;
}
</style>