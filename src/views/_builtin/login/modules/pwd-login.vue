<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { useSystemConfigStore } from '@/store/modules/system-config';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { useLoginInit } from '@/hooks/business/useLoginInit';
import { $t } from '@/locales';
import ClickCaptcha from '@/components/captcha/ClickCaptcha.vue';

defineOptions({
  name: 'PwdLogin'
});

const router = useRouter();
const authStore = useAuthStore();
const systemConfigStore = useSystemConfigStore();
const { formRef, validate } = useNaiveForm();

// 第三方登录开关状态
const wecomEnabled = computed(() => systemConfigStore.isWecomEnabled());
const wechatEnabled = computed(() => systemConfigStore.isWechatEnabled());
const giteeEnabled = computed(() => systemConfigStore.isGiteeEnabled());
const hasThirdPartyLogin = computed(() => systemConfigStore.hasAnyThirdPartyLogin);

interface FormModel {
  userName: string;
  password: string;
}

const model: FormModel = reactive({
  userName: '',
  password: ''
});

// 使用整合的登录初始化 Hook
const {
  captchaEnabled,
  showCaptcha,
  rememberMe,
  rememberedUser,
  rememberedPassword,
  showInitButton,
  openCaptcha,
  saveRememberedUser
} = useLoginInit();

// 恢复记住的用户名
watch(rememberedUser, (value) => {
  if (value) {
    model.userName = value;
  }
});

// 恢复记住的密码
watch(rememberedPassword, (value) => {
  if (value) {
    model.password = value;
  }
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  const { formRules } = useFormRules();
  return {
    userName: formRules.userName,
    password: formRules.pwd
  };
});

async function handleSubmit() {
  await validate();
  if (captchaEnabled.value) {
    // 验证码开启，触发验证码弹窗
    openCaptcha();
  } else {
    // 验证码关闭，直接登录
    doLogin('');
  }
}

function onCaptchaSuccess(captchaToken: string) {
  doLogin(captchaToken);
}

function doLogin(captchaToken: string) {
  saveRememberedUser(model.userName, model.password);
  authStore.loginWithInfo(model.userName, model.password, captchaToken);
}

function handleThirdPartyLogin(type: 'wecom' | 'wechat' | 'gitee') {
  if (type === 'wecom') {
    router.push({ name: 'login', params: { module: 'wecom-login' } });
    return;
  }

  window.$notification?.destroyAll();
  window.$notification?.warning({
    title: $t('common.warning'),
    content: $t('page.login.pwdLogin.featureNotImplemented'),
    duration: 3000
  });
}

function goToInit() {
  router.push('/init');
}
</script>

<template>
  <div>
    <NForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
      <NFormItem path="userName">
        <NInput v-model:value="model.userName" :placeholder="$t('page.login.common.userNamePlaceholder')" :input-props="{ autocomplete: 'username' }" />
      </NFormItem>
      <NFormItem path="password">
        <NInput
          v-model:value="model.password"
          type="password"
          show-password-on="click"
          :input-props="{ autocomplete: 'current-password' }"
          :placeholder="$t('page.login.common.passwordPlaceholder')"
        />
      </NFormItem>
      <NSpace vertical :size="24">
        <div class="flex-y-center justify-between">
          <NCheckbox v-model:checked="rememberMe">{{ $t('page.login.pwdLogin.rememberMe') }}</NCheckbox>
        </div>
        <NButton type="primary" size="large" round block :loading="authStore.loginLoading" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </NButton>
        <!-- 初始化按钮 -->
        <NButton v-if="showInitButton" quaternary size="large" round block @click="goToInit">
          <template #icon>
            <SvgIcon icon="mdi:database-cog" class="text-18px" />
          </template>
          前往系统初始化
        </NButton>
        <template v-if="hasThirdPartyLogin">
          <NDivider class="text-14px text-#666 !m-0">{{ $t('page.login.pwdLogin.thirdPartyLogin') }}</NDivider>
          <div class="flex-center gap-24px">
            <NTooltip v-if="wecomEnabled" trigger="hover">
              <template #trigger>
                <NButton quaternary circle size="large" class="third-party-btn wecom" @click="handleThirdPartyLogin('wecom')">
                  <template #icon>
                    <icon-tdesign-logo-wecom class="size-5" />
                  </template>
                </NButton>
              </template>
              {{ $t('page.login.pwdLogin.wecomLogin') }}
            </NTooltip>
            <NTooltip v-if="wechatEnabled" trigger="hover">
              <template #trigger>
                <NButton quaternary circle size="large" class="third-party-btn wechat" @click="handleThirdPartyLogin('wechat')">
                  <template #icon>
                    <icon-mdi-wechat class="size-5" />
                  </template>
                </NButton>
              </template>
              {{ $t('page.login.pwdLogin.wechatLogin') }}
            </NTooltip>
            <NTooltip v-if="giteeEnabled" trigger="hover">
              <template #trigger>
                <NButton quaternary circle size="large" class="third-party-btn gitee" @click="handleThirdPartyLogin('gitee')">
                  <template #icon>
                    <icon-simple-icons-gitee class="size-5" />
                  </template>
                </NButton>
              </template>
              {{ $t('page.login.pwdLogin.giteeLogin') }}
            </NTooltip>
          </div>
        </template>
      </NSpace>
    </NForm>

    <!-- 点击验证码弹窗 -->
    <ClickCaptcha
      v-model:show="showCaptcha"
      @success="onCaptchaSuccess"
    />
  </div>
</template>

<style scoped>
/* 第三方登录按钮样式 */
.third-party-btn {
  transition: all 0.2s ease;
}

.third-party-btn:hover {
  transform: scale(1.1);
}

.third-party-btn.wecom { color: #2B7EF9; }
.third-party-btn.wecom:hover { background-color: rgba(43, 126, 249, 0.1); }
:root.dark .third-party-btn.wecom { color: #5B9DFA; }
:root.dark .third-party-btn.wecom:hover { background-color: rgba(91, 157, 250, 0.15); }

.third-party-btn.wechat { color: #07C160; }
.third-party-btn.wechat:hover { background-color: rgba(7, 193, 96, 0.1); }
:root.dark .third-party-btn.wechat { color: #2AAE67; }
:root.dark .third-party-btn.wechat:hover { background-color: rgba(42, 174, 103, 0.15); }

.third-party-btn.gitee { color: #C71D23; }
.third-party-btn.gitee:hover { background-color: rgba(199, 29, 35, 0.1); }
:root.dark .third-party-btn.gitee { color: #E85D62; }
:root.dark .third-party-btn.gitee:hover { background-color: rgba(232, 93, 98, 0.15); }
</style>
