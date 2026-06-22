<script setup lang="ts">
import { useFullScreenLoading } from '@/hooks/business/use-full-screen-loading';

defineOptions({
  name: 'FullScreenLoading'
});

const { visible, loadingText } = useFullScreenLoading();
</script>

<template>
  <Teleport to="body">
    <Transition name="fsl-fade">
      <div v-if="visible" class="fsl-overlay">
        <div class="fsl-card">
          <NSpin size="large" />
          <p v-if="loadingText" class="fsl-text">{{ loadingText }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fsl-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.fsl-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.fsl-text {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.fsl-fade-enter-active,
.fsl-fade-leave-active {
  transition: opacity 0.2s ease;
}

.fsl-fade-enter-from,
.fsl-fade-leave-to {
  opacity: 0;
}
</style>

<style scoped>
:global(.dark) .fsl-card {
  background-color: rgba(30, 30, 30, 0.96);
}

:global(.dark) .fsl-text {
  color: #eee;
}
</style>
