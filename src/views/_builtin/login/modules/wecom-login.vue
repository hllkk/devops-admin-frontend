<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import QRCode from 'qrcode';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';
import { fetchWecomQrCode, fetchQrCodeStatus } from '@/service/api';

defineOptions({
  name: 'WecomLogin'
});

const router = useRouter();
const authStore = useAuthStore();

const qrCodeDataUrl = ref('');
const sceneId = ref('');
const loading = ref(false);
const expired = ref(false);
const countdown = ref(120);
const errorMessage = ref('');
const pollInterval = ref(3000);
const lastStatus = ref('');
const scanned = ref(false); // 用户已扫码状态

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

async function loadQrCode() {
  loading.value = true;
  expired.value = false;
  errorMessage.value = '';
  lastStatus.value = '';
  scanned.value = false;
  pollInterval.value = 3000;

  stopPolling();
  stopCountdown();

  try {
    const { data, error } = await fetchWecomQrCode();
    if (error || !data) {
      errorMessage.value = $t('page.login.wecomLogin.qrCodeLoadFailed');
      return;
    }

    sceneId.value = data.sceneId;
    countdown.value = data.countdown || 120;

    // 客户端生成 QR 码
    qrCodeDataUrl.value = await QRCode.toDataURL(data.oauthUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    startCountdown();
    scheduleNextPoll();
  } catch {
    errorMessage.value = $t('page.login.wecomLogin.qrCodeLoadFailed');
  } finally {
    loading.value = false;
  }
}

function scheduleNextPoll() {
  stopPolling();
  pollTimer = setTimeout(async () => {
    if (!sceneId.value) return;

    const { data, error } = await fetchQrCodeStatus(sceneId.value);
    if (!error && data) {
      // 已扫描但未确认，加速轮询并显示提示
      if (data.status === 'scanned' && lastStatus.value !== 'scanned') {
        pollInterval.value = 1000;
        scanned.value = true; // 显示"已扫码"提示
      }
      lastStatus.value = data.status;

      if (data.status === 'confirmed' && data.expiresAt) {
        stopCountdown();
        await authStore.wecomLogin(data.expiresAt);
        return;
      }
      if (data.status === 'expired') {
        stopCountdown();
        expired.value = true;
        return;
      }
      if (data.status === 'fail') {
        stopCountdown();
        errorMessage.value = $t('page.login.wecomLogin.qrCodeLoadFailed');
        return;
      }
    }
    scheduleNextPoll();
  }, pollInterval.value);
}

function startCountdown() {
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      stopCountdown();
      expired.value = true;
      stopPolling();
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function goBack() {
  router.push({ name: 'login', params: { module: 'pwd-login' } });
}

function refreshQrCode() {
  loadQrCode();
}

onUnmounted(() => {
  stopPolling();
  stopCountdown();
});

loadQrCode();
</script>

<template>
  <div class="flex-col-center gap-24px">
    <div v-if="loading" class="flex-col-center h-280px">
      <NSpin size="large" />
      <p class="mt-12px text-14px text-gray-400">{{ $t('page.login.wecomLogin.loading') }}</p>
    </div>

    <div v-else-if="errorMessage" class="flex-col-center h-280px">
      <div class="text-48px text-red-400">
        <SvgIcon icon="mdi:alert-circle-outline" />
      </div>
      <p class="mt-12px text-14px text-red-400">{{ errorMessage }}</p>
      <NButton type="primary" size="small" class="mt-16px" @click="refreshQrCode">
        {{ $t('page.login.wecomLogin.refresh') }}
      </NButton>
    </div>

    <div v-else class="flex-col-center">
      <div class="qr-code-wrapper relative" :class="{ expired }">
        <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="WeChat Work QR Code" class="qr-code-img" />
        <div v-if="expired" class="qr-code-overlay">
          <div class="flex-col-center gap-8px">
            <SvgIcon icon="mdi:refresh" class="text-32px text-white" />
            <NButton type="primary" size="small" @click="refreshQrCode">
              {{ $t('page.login.wecomLogin.refresh') }}
            </NButton>
          </div>
        </div>
      </div>

      <div class="mt-16px flex-col-center gap-8px">
        <!-- 已扫码提示 -->
        <div v-if="scanned && !expired" class="scanned-tip">
          <NSpin size="small" />
          <span class="ml-8px">{{ $t('page.login.wecomLogin.scanned') }}</span>
        </div>
        <p v-else class="text-14px text-gray-500">
          {{ $t('page.login.wecomLogin.scanTip') }}
        </p>
        <p v-if="!expired && !scanned" class="text-12px text-gray-400">
          {{ $t('page.login.wecomLogin.countdown', { seconds: countdown }) }}
        </p>
        <p v-else-if="expired" class="text-12px text-orange-500">
          {{ $t('page.login.wecomLogin.expired') }}
        </p>
      </div>
    </div>

    <NButton quaternary size="small" @click="goBack">
      <template #icon>
        <SvgIcon icon="mdi:arrow-left" />
      </template>
      {{ $t('page.login.wecomLogin.backToLogin') }}
    </NButton>
  </div>
</template>

<style scoped>
.qr-code-wrapper {
  width: 220px;
  height: 220px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 2px solid #e5e7eb;
}

:root.dark .qr-code-wrapper {
  border-color: #374151;
}

.qr-code-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-code-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.scanned-tip {
  display: flex;
  align-items: center;
  color: #52c41a;
  font-size: 14px;
}

:root.dark .scanned-tip {
  color: #73d13d;
}
</style>
