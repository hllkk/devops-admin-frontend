<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import type { SettingConfig } from './types';
import SettingMenu from './modules/setting-menu.vue';
import GeneralSetting from './modules/general-setting.vue';
import SecuritySetting from './modules/security-setting.vue';
import LdapSetting from './modules/ldap-setting.vue';
import DiskSetting from './modules/disk-setting.vue';
import NotifySetting from './modules/notify-setting.vue';
import AuthSetting from './modules/auth-setting.vue';
import { useAuth } from '@/hooks/business/auth';
import { fetchGetSystemSettings, fetchUpdateSystemSettings } from '@/service/api/system/setting';

defineOptions({
  name: 'SettingsPage'
});

const loading = ref(false);
const activeKey = ref('general');
const { hasAuth } = useAuth();

const breakpoints = useBreakpoints(breakpointsTailwind);
const isMobile = breakpoints.smaller('lg');

// Config data with all default values
const config = ref<SettingConfig>({
  general: {
    systemName: 'OPS管理系统',
    systemDescription: '企业运维管理平台',
    logoUrl: '',
    faviconUrl: '',
    userDefaultPassword: '',
    userDefaultRole: null,
    enableVerifyCode: false,
    verifyCodeType: 'click',
    verifyCodeLen: 4,
    verifyCodeExp: 5,
    verifyCodeTokenExp: 5,
    verifyInaccuracy: 40,
    loginLogRetentionDays: 90,
    operationLogRetentionDays: 90
  },
  security: {
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireLowercase: true,
    passwordRequireDigit: true,
    passwordRequireSpecial: true,
    loginFailLockCount: 5,
    loginFailLockTime: 30,
    ipValidationEnabled: false,
    ipValidationMode: 'blacklist',
    ipBlacklist: '',
    ipWhitelist: ''
  },
  ldap: {
    enabled: false,
    server: '',
    bindUser: '',
    bindPassword: '',
    baseOU: '',
    searchPageSize: 100,
    fieldMapping: '',
    syncEnabled: false,
    syncDefaultEnabled: true,
    syncStrategy: 'incremental',
    conflictStrategy: 'skip'
  },
  disk: {
    maxUploadSize: 5120,
    allowedFileTypes: '',
    blockedFileTypes: '',
    storageQuota: 10,
    diskName: '',
    diskLogo: '',
    shareLinkPasswordRequired: false,
    shareLinkPasswordMinLength: 4,
    uploadLinkPasswordRequired: false,
    uploadLinkPasswordMinLength: 4,
    syncEnabled: false,
    onlyOfficeEnabled: true,
    onlyOfficeUrl: '',
    onlyOfficeSecret: '',
    onlyOfficeCallbackUrl: '',
    videoTranscodeEnabled: false,
    ffmpegPath: '',
    transcodeThreads: 4,
    transcodePreset: 'medium'
  },
  notify: {
    smtpHost: '',
    smtpPort: 465,
    smtpUser: '',
    smtpPassword: '',
    smsEnabled: false,
    smsGateway: '',
    feishuEnabled: false,
    feishuAppId: '',
    feishuAppSecret: '',
    webhookUrl: ''
  },
  auth: {
    weworkEnabled: false,
    weworkDomainFileName: '',
    weworkDomainFileContent: '',
    wechatEnabled: false,
    giteeEnabled: false,
    githubEnabled: false
  }
});

const menuTitleMap: Record<string, string> = {
  general: '常规配置',
  security: '安全配置',
  ldap: 'LDAP配置',
  disk: '网盘配置',
  notify: '通知渠道',
  auth: '认证配置'
};

const currentTitle = computed(() => menuTitleMap[activeKey.value]);

// 初始化时加载配置
async function loadConfig() {
  try {
    const response = await fetchGetSystemSettings();
    const settings = response.data;
    if (settings?.general) {
      config.value.general = {
        systemName: settings.general.systemName || 'OPS管理系统',
        systemDescription: settings.general.systemDescription || '企业运维管理平台',
        logoUrl: settings.general.logoUrl || '',
        faviconUrl: settings.general.faviconUrl || '',
        userDefaultPassword: settings.general.userDefaultPassword || '',
        userDefaultRole: settings.general.userDefaultRole || null,
        enableVerifyCode: settings.general.enableVerifyCode || false,
        verifyCodeType: settings.general.verifyCodeType || 'click',
        verifyCodeLen: settings.general.verifyCodeLen || 4,
        verifyCodeExp: settings.general.verifyCodeExp || 5,
        verifyCodeTokenExp: settings.general.verifyCodeTokenExp || 5,
        verifyInaccuracy: settings.general.verifyInaccuracy || 40,
        loginLogRetentionDays: settings.general.loginLogRetentionDays || 90,
        operationLogRetentionDays: settings.general.operationLogRetentionDays || 90
      };
    }
    if (settings?.security) {
      const sec = settings.security;
      config.value.security = {
        passwordMinLength: sec.passwordMinLength || 8,
        passwordRequireUppercase: sec.passwordRequireUppercase ?? false,
        passwordRequireLowercase: sec.passwordRequireLowercase ?? true,
        passwordRequireDigit: sec.passwordRequireDigit ?? true,
        passwordRequireSpecial: sec.passwordRequireSpecial ?? true,
        loginFailLockCount: sec.loginFailLockCount || 5,
        loginFailLockTime: sec.loginFailLockTime || 30,
        ipValidationEnabled: sec.ipValidationEnabled ?? false,
        ipValidationMode: sec.ipValidationMode || 'blacklist',
        ipBlacklist: sec.ipBlacklist || '',
        ipWhitelist: sec.ipWhitelist || ''
      };
    }
    if (settings?.disk) {
      config.value.disk = {
        maxUploadSize: settings.disk.maxUploadSize || 5120,
        allowedFileTypes: (settings.disk.allowedExtensions || []).join(','),
        blockedFileTypes: (settings.disk.blockedExtensions || []).join(','),
        storageQuota: settings.disk.storageQuota || 10,
        diskName: settings.disk.diskName || '',
        diskLogo: settings.disk.diskLogo || '',
        shareLinkPasswordRequired: settings.disk.shareLinkPasswordRequired ?? false,
        shareLinkPasswordMinLength: settings.disk.shareLinkPasswordMinLength || 4,
        uploadLinkPasswordRequired: settings.disk.uploadLinkPasswordRequired ?? false,
        uploadLinkPasswordMinLength: settings.disk.uploadLinkPasswordMinLength || 4,
        syncEnabled: settings.disk.syncEnabled ?? false,
        onlyOfficeEnabled: settings.disk.onlyOffice?.enable ?? true,
        onlyOfficeUrl: settings.disk.onlyOffice?.serverUrl || '',
        onlyOfficeSecret: settings.disk.onlyOffice?.tokenSecret || '',
        onlyOfficeCallbackUrl: settings.disk.onlyOffice?.callbackUrl || '',
        videoTranscodeEnabled: settings.disk.videoTranscode?.enable ?? false,
        ffmpegPath: settings.disk.videoTranscode?.ffmpegPath || '',
        transcodeThreads: settings.disk.videoTranscode?.threads || 4,
        transcodePreset: settings.disk.videoTranscode?.preset || 'medium'
      };
    }
    // 加载认证配置
    if (settings?.authentication) {
      const auth = settings.authentication;
      config.value.auth = {
        weworkEnabled: auth.wecom?.enableWecom || false,
        weworkDomainFileName: auth.wecom?.validateDomainFileName || '',
        weworkDomainFileContent: auth.wecom?.validateDomainFileContent || '',
        wechatEnabled: auth.wechat?.enableWechat || false,
        giteeEnabled: auth.gitee?.enableGitee || false,
        githubEnabled: auth.github?.enableGithub || false
      };
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

async function handleSave() {
  loading.value = true;
  try {
    // 构建后端需要的 Settings 结构
    const disk = config.value.disk;
    const security = config.value.security;
    const auth = config.value.auth;
    const settings: Api.SystemManage.Settings = {
      general: {
        systemName: config.value.general.systemName,
        systemDescription: config.value.general.systemDescription,
        logoUrl: config.value.general.logoUrl,
        faviconUrl: config.value.general.faviconUrl,
        userDefaultPassword: config.value.general.userDefaultPassword,
        userDefaultRole: config.value.general.userDefaultRole,
        enableVerifyCode: config.value.general.enableVerifyCode,
        verifyCodeType: config.value.general.verifyCodeType,
        verifyCodeLen: config.value.general.verifyCodeLen,
        verifyCodeExp: config.value.general.verifyCodeExp,
        verifyCodeTokenExp: config.value.general.verifyCodeTokenExp,
        verifyInaccuracy: config.value.general.verifyInaccuracy,
        loginLogRetentionDays: config.value.general.loginLogRetentionDays,
        operationLogRetentionDays: config.value.general.operationLogRetentionDays
      },
      security: {
        passwordMinLength: security.passwordMinLength,
        passwordRequireUppercase: security.passwordRequireUppercase,
        passwordRequireLowercase: security.passwordRequireLowercase,
        passwordRequireDigit: security.passwordRequireDigit,
        passwordRequireSpecial: security.passwordRequireSpecial,
        loginFailLockCount: security.loginFailLockCount,
        loginFailLockTime: security.loginFailLockTime,
        ipValidationEnabled: security.ipValidationEnabled,
        ipValidationMode: security.ipValidationMode,
        ipBlacklist: security.ipBlacklist,
        ipWhitelist: security.ipWhitelist
      },
      authentication: {
        wecom: {
          enableWecom: auth.weworkEnabled,
          validateDomainFileName: auth.weworkDomainFileName,
          validateDomainFileContent: auth.weworkDomainFileContent
        },
        wechat: {
          enableWechat: auth.wechatEnabled
        },
        gitee: {
          enableGitee: auth.giteeEnabled
        },
        github: {
          enableGithub: auth.githubEnabled
        }
      },
      disk: {
        diskName: disk.diskName,
        diskLogo: disk.diskLogo,
        maxUploadSize: disk.maxUploadSize,
        allowedExtensions: disk.allowedFileTypes
          ? disk.allowedFileTypes.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        blockedExtensions: disk.blockedFileTypes
          ? disk.blockedFileTypes.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        storageQuota: disk.storageQuota,
        syncEnabled: disk.syncEnabled,
        shareLinkPasswordRequired: disk.shareLinkPasswordRequired,
        shareLinkPasswordMinLength: disk.shareLinkPasswordMinLength,
        uploadLinkPasswordRequired: disk.uploadLinkPasswordRequired,
        uploadLinkPasswordMinLength: disk.uploadLinkPasswordMinLength,
        onlyOffice: {
          enable: disk.onlyOfficeEnabled,
          serverUrl: disk.onlyOfficeUrl,
          tokenSecret: disk.onlyOfficeSecret,
          callbackUrl: disk.onlyOfficeCallbackUrl
        },
        videoTranscode: {
          enable: disk.videoTranscodeEnabled,
          ffmpegPath: disk.ffmpegPath,
          threads: disk.transcodeThreads,
          preset: disk.transcodePreset
        }
      }
    };

    await fetchUpdateSystemSettings(settings);
    window.$message?.success('配置已保存，刷新页面后生效');
  } catch {
    window.$message?.error('保存失败');
  } finally {
    loading.value = false;
  }
}

// 页面加载时获取配置
onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="h-full overflow-hidden">
    <!-- Mobile layout -->
    <template v-if="isMobile">
      <NCard :bordered="false" class="card-wrapper h-full">
        <NCollapse :default-expanded-names="['menu']">
          <NCollapseItem name="menu" title="配置选项">
            <SettingMenu v-model:active-key="activeKey" />
          </NCollapseItem>
        </NCollapse>

        <NDivider style="margin: 12px 0" />

        <div class="flex justify-between items-center mb-16px">
          <div class="text-16px font-600">{{ currentTitle }}</div>
          <NButton v-if="hasAuth('system:setting:save')" type="primary" :loading="loading" class="dark:text-white" @click="handleSave">保存</NButton>
        </div>

        <div class="overflow-auto" style="height: calc(100% - 180px)">
          <GeneralSetting v-if="activeKey === 'general'" v-model:config="config.general" />
          <SecuritySetting v-else-if="activeKey === 'security'" v-model:config="config.security" />
          <LdapSetting v-else-if="activeKey === 'ldap'" v-model:config="config.ldap" />
          <DiskSetting v-else-if="activeKey === 'disk'" v-model:config="config.disk" />
          <NotifySetting v-else-if="activeKey === 'notify'" v-model:config="config.notify" />
          <AuthSetting v-else-if="activeKey === 'auth'" v-model:config="config.auth" />
        </div>
      </NCard>
    </template>

    <!-- Desktop layout -->
    <template v-else>
      <div class="h-full flex flex-row">
        <!-- Left panel -->
        <div class="h-full w-1/5 flex-none">
          <SettingMenu v-model:active-key="activeKey" />
        </div>

        <!-- Right panel -->
        <NCard :bordered="false" class="card-wrapper ml-4 h-full flex-1 flex flex-col" :content-style="{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }">
          <!-- Header -->
          <template #header>
            <div class="flex justify-between items-center">
              <div class="text-16px font-600">{{ currentTitle }}</div>
              <NButton v-if="hasAuth('system:setting:save')" type="primary" :loading="loading" @click="handleSave">保存</NButton>
            </div>
          </template>

          <!-- Content area -->
          <div class="setting-content flex-1 overflow-y-auto overflow-x-hidden pr-1">
            <GeneralSetting v-if="activeKey === 'general'" v-model:config="config.general" />
            <SecuritySetting v-else-if="activeKey === 'security'" v-model:config="config.security" />
            <LdapSetting v-else-if="activeKey === 'ldap'" v-model:config="config.ldap" />
            <DiskSetting v-else-if="activeKey === 'disk'" v-model:config="config.disk" />
            <NotifySetting v-else-if="activeKey === 'notify'" v-model:config="config.notify" />
            <AuthSetting v-else-if="activeKey === 'auth'" v-model:config="config.auth" />
          </div>
        </NCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card-wrapper {
  border-radius: 8px;
}

/* 右侧内容区滚动条样式 - 只在hover时显示 */
.setting-content {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.setting-content:hover {
  scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

.setting-content::-webkit-scrollbar {
  width: 6px;
}

.setting-content::-webkit-scrollbar-track {
  background: transparent;
}

.setting-content::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
  transition: background-color 0.3s;
}

.setting-content:hover::-webkit-scrollbar-thumb {
  background-color: rgba(155, 155, 155, 0.5);
}

.setting-content:hover::-webkit-scrollbar-thumb:hover {
  background-color: rgba(155, 155, 155, 0.8);
}
</style>
