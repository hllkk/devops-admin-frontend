<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';
import { fetchWecomQrCode, fetchQrCodeStatus } from '@/service/api';

defineOptions({
  name: 'WecomLogin'
});

const router = useRouter();
const authStore = useAuthStore();

const iframeSrc = ref('');
const sceneId = ref('');
const loading = ref(false);
const expired = ref(false);
const countdown = ref(120);
const errorMessage = ref('');
const pollInterval = ref(3000);
const lastStatus = ref('');
const scanned = ref(false);

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
    const { data, error } = await fetchWecomQrCode('pc');
    if (error || !data) {
      errorMessage.value = $t('page.login.wecomLogin.qrCodeLoadFailed');
      return;
    }

    sceneId.value = data.sceneId;
    countdown.value = data.countdown || 120;
    iframeSrc.value = data.oauthUrl;

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
      if (data.status === 'scanned' && lastStatus.value !== 'scanned') {
        pollInterval.value = 1000;
        scanned.value = true;
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
    <div v-if="loading" class="flex-col-center h-400px">
      <NSpin size="large" />
      <p class="mt-12px text-14px text-gray-400">{{ $t('page.login.wecomLogin.loading') }}</p>
    </div>

    <div v-else-if="errorMessage" class="flex-col-center h-400px">
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
        <iframe
          v-if="iframeSrc && !expired"
          :src="iframeSrc"
          class="qr-code-iframe"
          frameborder="0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
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
  width: 300px;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 2px solid #e5e7eb;
}

:root.dark .qr-code-wrapper {
  border-color: #374151;
}

.qr-code-iframe {
  width: 100%;
  height: 100%;
  border: none;
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
