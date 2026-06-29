<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getPaletteColorByNumber, mixColor } from '@sa/color';
import { fetchCheckDB, fetchInitDB, fetchAutoInitDB, fetchTestConnect } from '@/service/api/init';
import { useNaiveForm, createDynamicPwdRule, useFormRules } from '@/hooks/common/form';
import { useThemeStore } from '@/store/modules/theme';
import { clearInitStatusCache } from '@/router/guard/route';
import WaveBg from '@/components/custom/wave-bg.vue';

defineOptions({
  name: 'InitPage'
});

const router = useRouter();
const themeStore = useThemeStore();
const { formRef, validate } = useNaiveForm();
const { createConfirmPwdRule } = useFormRules();

// 背景颜色（与登录页面一致）
const bgThemeColor = computed(() =>
  themeStore.darkMode ? getPaletteColorByNumber(themeStore.themeColor, 600) : themeStore.themeColor
);

const bgColor = computed(() => {
  const COLOR_WHITE = '#ffffff';
  const ratio = themeStore.darkMode ? 0.5 : 0.2;
  return mixColor(COLOR_WHITE, themeStore.themeColor, ratio);
});

// 当前步骤
const currentStep = ref(1);

// 加载状态
const loading = ref(false);
const testing = ref(false); // 测试连接加载状态
const checking = ref(true);
const needInit = ref(false);
const autoInit = ref(false);      // Docker环境支持自动初始化
const configReady = ref(false);   // Docker配置是否完整
const autoInitMode = ref(false);  // 用户选择自动初始化模式

// 数据库类型选项
const dbTypeOptions = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'pgsql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'MSSQL', value: 'mssql' }
];

// 部署环境选项
const _deployEnvOptions = [
  { label: '本地部署', value: 'local' },
  { label: 'Docker部署', value: 'docker' }
];

// 表单数据
const model = reactive({
  // 部署环境
  deployEnv: 'local' as 'local' | 'docker',
  // 数据库配置
  dbType: 'mysql' as Api.Init.DBType,
  host: '127.0.0.1',
  port: '3306',
  userName: 'root',
  password: '',
  dbName: 'devops-admin',
  dbPath: '', // sqlite专用
  // Redis配置
  redisEnabled: false,
  redisAddr: '127.0.0.1:6379',
  redisPassword: '',
  redisDB: 0,
  // 管理员密码
  adminPassword: '',
  confirmPassword: ''
});

// 表单规则（分步骤验证）
const rules = computed(() => {
  const step1SQLite: Record<string, App.Global.FormRule[]> = {
    dbName: [{ required: true, message: '请输入数据库名' }],
    dbPath: [{ required: true, message: '请输入数据库文件路径' }]
  };

  const step1Other: Record<string, App.Global.FormRule[]> = {
    host: [{ required: true, message: '请输入数据库服务器地址' }],
    port: [{ required: true, message: '请输入数据库端口' }],
    userName: [{ required: true, message: '请输入数据库用户名' }],
    dbName: [{ required: true, message: '请输入数据库名' }]
  };

  // 密码策略配置（与系统默认配置一致）
  const passwordPolicy = {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: true,
    requireDigit: true,
    requireSpecial: true
  };

  const step3: Record<string, App.Global.FormRule[]> = {
    adminPassword: [
      { required: true, message: '请输入管理员密码' },
      createDynamicPwdRule(passwordPolicy)
    ],
    confirmPassword: createConfirmPwdRule(computed(() => model.adminPassword))
  };

  const empty: Record<string, App.Global.FormRule[]> = {};

  if (currentStep.value === 1) {
    return model.dbType === 'sqlite' ? step1SQLite : step1Other;
  }

  if (currentStep.value === 3) {
    return step3;
  }

  return empty;
});

// 监听数据库类型变化，自动设置默认端口
watch(() => model.dbType, (dbType) => {
  switch (dbType) {
    case 'mysql':
      model.port = '3306';
      break;
    case 'pgsql':
      model.port = '5432';
      break;
    case 'mssql':
      model.port = '1433';
      break;
    default:
      break;
  }
});

// 监听部署环境变化
watch(() => model.deployEnv, (env) => {
  if (env === 'docker') {
    // Docker环境下使用容器名称
    model.host = 'mysql';
    model.redisAddr = 'redis:6379';
  } else {
    // 本地部署使用localhost
    model.host = '127.0.0.1';
    model.redisAddr = '127.0.0.1:6379';
  }
});

// 检查数据库状态
async function checkDBStatus() {
  checking.value = true;
  const { data, error } = await fetchCheckDB();
  checking.value = false;

  if (!error && data) {
    needInit.value = data.needInit;
    autoInit.value = data.autoInit;
    configReady.value = data.configReady;

    if (!data.needInit) {
      // 已经初始化过，直接跳转到登录页
      router.replace('/login/pwd-login');
    } else if (data.autoInit && data.configReady) {
      // Docker环境配置完整，默认选择自动初始化模式
      autoInitMode.value = true;
    }
  }
}

// 切换初始化模式
function _toggleInitMode() {
  autoInitMode.value = !autoInitMode.value;
}

// 上一步
function handlePrev() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

// 下一步
async function handleNext() {
  try {
    await validate();
    if (currentStep.value < 3) {
      currentStep.value++;
    }
  } catch {
    // 验证失败，表单会自动显示错误信息
  }
}

// 执行自动初始化
async function handleAutoInit() {
  loading.value = true;
  const { error } = await fetchAutoInitDB();
  loading.value = false;

  if (!error) {
    clearInitStatusCache();
    window.$message?.destroyAll();
    window.$message?.success('自动初始化成功，请使用环境变量 INIT_ADMIN_PASSWORD 设置的密码登录');
    router.replace('/login/pwd-login');
  }
}

// 提交手动初始化
async function handleSubmit() {
  try {
    await validate();
  } catch {
    // 验证失败
    return;
  }

  loading.value = true;

  const params: Api.Init.InitDBRequest = {
    adminPassword: model.adminPassword,
    dbType: model.dbType,
    host: model.host,
    port: model.port,
    userName: model.userName,
    password: model.password,
    dbName: model.dbName
  };

  // SQLite特殊处理
  if (model.dbType === 'sqlite') {
    params.dbPath = model.dbPath;
  }

  // Redis配置
  if (model.redisEnabled) {
    params.redisAddr = model.redisAddr;
    params.redisPassword = model.redisPassword;
    params.redisDB = model.redisDB;
  }

  const { error } = await fetchInitDB(params);
  loading.value = false;

  if (!error) {
    clearInitStatusCache();
    window.$message?.destroyAll();
    window.$message?.success('初始化成功，请登录');
    router.replace('/login/pwd-login');
  }
}

// 返回登录
function goToLogin() {
  router.replace('/login/pwd-login');
}

// 测试连接（步骤1: 数据库, 步骤2: Redis）
async function handleTestConnect() {
  try {
    await validate();
  } catch {
    // 验证失败，表单会自动显示错误信息
    return;
  }

  testing.value = true;

  const params: Api.Init.TestConnectRequest = {
    connectType: currentStep.value === 1 ? 'db' : 'redis'
  };

  if (currentStep.value === 1) {
    params.dbType = model.dbType;
    params.host = model.host;
    params.port = model.port;
    params.userName = model.userName;
    params.password = model.password;
    params.dbName = model.dbName;
    if (model.dbType === 'sqlite') {
      params.dbPath = model.dbPath;
    }
  } else {
    params.redisAddr = model.redisAddr;
    params.redisPassword = model.redisPassword;
    params.redisDB = model.redisDB;
  }

  const { error } = await fetchTestConnect(params);
  testing.value = false;

  if (!error) {
    window.$message?.success('连接成功');
  }
  // 失败时错误消息由请求拦截器统一弹出
}

// 初始化检查
checkDBStatus();
</script>

<template>
  <div class="relative size-full flex-center overflow-hidden" :style="{ backgroundColor: bgColor }">
    <WaveBg :theme-color="bgThemeColor" />
    <NCard :bordered="false" class="relative z-4 w-auto rd-12px shadow-lg">
      <div class="w-500px lt-sm:w-350px">
        <!-- 头部 -->
        <header class="flex-y-center justify-between mb-24px">
          <SystemLogo class="size-48px" />
          <h3 class="text-24px text-primary font-500">系统初始化</h3>
          <div class="i-flex-col">
            <ThemeSchemaSwitch
              :theme-schema="themeStore.themeScheme"
              :show-tooltip="false"
              class="text-20px"
              @switch="themeStore.toggleThemeScheme"
            />
          </div>
        </header>

        <!-- 加载中 -->
        <div v-if="checking" class="flex-center py-100px">
          <NSpin size="large" />
          <span class="ml-12px text-gray-500">检查系统状态...</span>
        </div>

        <!-- 初始化表单 -->
        <div v-else-if="needInit">
          <!-- Docker环境自动初始化提示 -->
          <NAlert v-if="autoInit && configReady" type="success" class="mb-24px">
            <template #header>
              <div class="flex items-center gap-8px">
                <SvgIcon icon="mdi:docker" class="text-20px" />
                <span>Docker 环境自动初始化</span>
              </div>
            </template>
            检测到 Docker 环境配置完整，可一键完成初始化。管理员密码通过环境变量 INIT_ADMIN_PASSWORD 设置。
          </NAlert>

          <!-- 初始化模式选择 -->
          <div v-if="autoInit && configReady" class="mb-24px flex justify-center">
            <NRadioGroup v-model:value="autoInitMode">
              <NRadioButton :value="true">
                <div class="flex items-center gap-4px">
                  <SvgIcon icon="mdi:auto-fix" class="text-16px" />
                  <span>自动初始化</span>
                </div>
              </NRadioButton>
              <NRadioButton :value="false">
                <div class="flex items-center gap-4px">
                  <SvgIcon icon="mdi:cog" class="text-16px" />
                  <span>手动配置</span>
                </div>
              </NRadioButton>
            </NRadioGroup>
          </div>

          <!-- 自动初始化模式 -->
          <div v-if="autoInitMode && autoInit && configReady" class="flex-center flex-col py-40px">
            <SvgIcon icon="mdi:rocket-launch" class="text-80px text-primary" />
            <p class="mt-16px text-gray-600">
              Docker 环境已配置完成，点击下方按钮一键初始化
            </p>
            <p class="mt-8px text-gray-400 text-sm">
              默认管理员密码：<span class="text-primary font-medium">Admin@2026</span>
              （可通过环境变量 INIT_ADMIN_PASSWORD 自定义）
            </p>
            <NButton
              type="primary"
              size="large"
              class="mt-24px"
              :loading="loading"
              @click="handleAutoInit"
            >
              <template #icon>
                <SvgIcon icon="mdi:auto-fix" />
              </template>
              一键初始化
            </NButton>
          </div>

          <!-- 手动初始化模式 -->
          <div v-else>
            <!-- 步骤条 -->
            <NSteps :current="currentStep" class="mb-24px">
              <NStep title="数据库配置" description="配置数据库连接" />
              <NStep title="缓存配置" description="配置Redis（可选）" />
              <NStep title="管理员设置" description="设置管理员密码" />
            </NSteps>

            <NForm
              ref="formRef"
              :model="model"
              :rules="rules"
              label-placement="left"
              label-width="100px"
              size="large"
            >
              <!-- 步骤1: 数据库配置 -->
              <div v-show="currentStep === 1">
                <NFormItem label="数据库类型" path="dbType">
                  <NSelect v-model:value="model.dbType" :options="dbTypeOptions" />
                </NFormItem>

                <!-- SQLite配置 -->
                <template v-if="model.dbType === 'sqlite'">
                  <NFormItem label="数据库名" path="dbName">
                    <NInput v-model:value="model.dbName" placeholder="请输入数据库名" />
                  </NFormItem>
                  <NFormItem label="数据库路径" path="dbPath">
                    <NInput v-model:value="model.dbPath" placeholder="例如: /data/sqlite" />
                  </NFormItem>
                </template>

                <!-- 其他数据库配置 -->
                <template v-else>
                  <NFormItem label="服务器地址" path="host">
                    <NInput
                      v-model:value="model.host"
                      :placeholder="model.deployEnv === 'docker' ? '容器名称，如: mysql' : 'IP地址，如: 127.0.0.1'"
                    />
                  </NFormItem>
                  <NFormItem label="端口" path="port">
                    <NInput v-model:value="model.port" placeholder="数据库端口" />
                  </NFormItem>
                  <NFormItem label="用户名" path="userName">
                    <NInput v-model:value="model.userName" placeholder="数据库用户名" />
                  </NFormItem>
                  <NFormItem label="密码" path="password">
                    <NInput
                      v-model:value="model.password"
                      type="password"
                      show-password-on="click"
                      placeholder="数据库密码"
                    />
                  </NFormItem>
                  <NFormItem label="数据库名" path="dbName">
                    <NInput v-model:value="model.dbName" placeholder="数据库名称" />
                  </NFormItem>
                </template>
              </div>

              <!-- 步骤2: Redis配置 -->
              <div v-show="currentStep === 2">
                <NFormItem label="启用Redis">
                  <NSwitch v-model:value="model.redisEnabled" />
                </NFormItem>

                <template v-if="model.redisEnabled">
                  <NFormItem label="服务地址">
                    <NInput
                      v-model:value="model.redisAddr"
                      :placeholder="model.deployEnv === 'docker' ? '容器名:端口，如: redis:6379' : 'IP:端口，如: 127.0.0.1:6379'"
                    />
                  </NFormItem>
                  <NFormItem label="密码">
                    <NInput
                      v-model:value="model.redisPassword"
                      type="password"
                      show-password-on="click"
                      placeholder="Redis密码（可为空）"
                    />
                  </NFormItem>
                  <NFormItem label="数据库">
                    <NInputNumber v-model:value="model.redisDB" :min="0" :max="15" />
                  </NFormItem>
                </template>

                <NAlert v-if="!model.redisEnabled" type="info" title="提示">
                  不使用Redis将无法支持多点登录限制、Token黑名单等功能
                </NAlert>
              </div>

              <!-- 步骤3: 管理员设置 -->
              <div v-show="currentStep === 3">
                <NAlert type="warning" class="mb-16px">
                  请设置管理员密码，用于首次登录系统
                </NAlert>
                <NFormItem label="管理员密码" path="adminPassword">
                  <NInput
                    v-model:value="model.adminPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请输入管理员密码"
                  />
                </NFormItem>
                <NFormItem label="确认密码" path="confirmPassword">
                  <NInput
                    v-model:value="model.confirmPassword"
                    type="password"
                    show-password-on="click"
                    placeholder="请再次输入密码"
                  />
                </NFormItem>
              </div>
            </NForm>

            <!-- 操作按钮 -->
            <div class="flex justify-between mt-24px">
              <NButton v-if="currentStep > 1" size="large" @click="handlePrev">
                上一步
              </NButton>
              <div v-else></div>
              <div class="flex gap-12px">
                <NButton
                  v-if="currentStep === 1 || currentStep === 2"
                  size="large"
                  :loading="testing"
                  :disabled="currentStep === 2 && !model.redisEnabled"
                  @click="handleTestConnect"
                >
                  测试连接
                </NButton>
                <NButton
                  v-if="currentStep < 3"
                  type="primary"
                  size="large"
                  @click="handleNext"
                >
                  下一步
                </NButton>
                <NButton
                  v-else
                  type="primary"
                  size="large"
                  :loading="loading"
                  @click="handleSubmit"
                >
                  开始初始化
                </NButton>
              </div>
            </div>
          </div>
        </div>

        <!-- 无需初始化 -->
        <div v-else class="flex-center flex-col py-40px">
          <SvgIcon icon="mdi:check-circle" class="text-80px text-green-500" />
          <p class="mt-16px text-gray-500">系统已完成初始化</p>
          <NButton type="primary" class="mt-16px" @click="goToLogin">
            前往登录
          </NButton>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped></style>