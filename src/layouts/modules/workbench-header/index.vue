<script setup lang="ts">
import { useFullscreen } from '@vueuse/core';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import GlobalBreadcrumb from '../../modules/global-breadcrumb/index.vue';
import UserAvatar from '../../modules/global-header/components/user-avatar.vue';
import MessageButton from '../../modules/global-header/components/message-button.vue';

defineOptions({
  name: 'DiskHeader'
});

const appStore = useAppStore();
const themeStore = useThemeStore();
const { isFullscreen, toggle } = useFullscreen();
</script>

<template>
  <DarkModeContainer class="h-full flex-y-center px-12px shadow-header">
    <MenuToggler v-if="appStore.isMobile" :collapsed="appStore.siderCollapse" @click="appStore.toggleSiderCollapse" />
    <div class="h-full flex-y-center flex-1-hidden">
      <GlobalBreadcrumb v-if="!appStore.isMobile" class="ml-12px" />
    </div>
    <div class="h-full flex-y-center justify-end">
      <MessageButton />
      <FullScreen v-if="!appStore.isMobile" :full="isFullscreen" @click="toggle" />
      <LangSwitch
        v-if="themeStore.header.multilingual.visible"
        :lang="appStore.locale"
        :lang-options="appStore.localeOptions"
        @change-lang="appStore.changeLocale"
      />
      <ThemeSchemaSwitch
        :theme-schema="themeStore.themeScheme"
        :is-dark="themeStore.darkMode"
        @switch="themeStore.toggleThemeScheme"
      />
      <UserAvatar />
    </div>
  </DarkModeContainer>
</template>

<style scoped></style>
