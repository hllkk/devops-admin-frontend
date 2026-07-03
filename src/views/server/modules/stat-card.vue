<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core';
import { useThemeStore } from '@/store/modules/theme';

defineOptions({ name: 'StatCard' });

interface CardColor {
  start: string;
  end: string;
}

interface Props {
  /** 卡片标题（已 i18n） */
  title: string;
  /** 数值 */
  value: number;
  /** 数值前缀（如 $、%） */
  unit?: string;
  /** iconify 图标名 */
  icon: string;
  /** 渐变色 */
  color: CardColor;
}

const props = withDefaults(defineProps<Props>(), { unit: '' });

interface GradientBgProps {
  gradientColor: string;
}

const [DefineGradientBg, GradientBg] = createReusableTemplate<GradientBgProps>();

const themeStore = useThemeStore();

function gradientOf(color: CardColor): string {
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}
</script>

<template>
  <!-- define component start: GradientBg -->
  <DefineGradientBg v-slot="{ $slots, gradientColor }">
    <div
      class="px-16px pb-4px pt-8px text-white"
      :style="{ backgroundImage: gradientColor, borderRadius: themeStore.themeRadius + 'px' }"
    >
      <component :is="$slots.default" />
    </div>
  </DefineGradientBg>
  <!-- define component end: GradientBg -->

  <GradientBg :gradient-color="gradientOf(props.color)" class="flex-1">
    <h3 class="text-16px">{{ title }}</h3>
    <div class="flex justify-between pt-12px">
      <SvgIcon :icon="icon" class="text-32px" />
      <CountTo
        :prefix="unit"
        :start-value="1"
        :end-value="value"
        class="text-30px text-white dark:text-dark"
      />
    </div>
  </GradientBg>
</template>

<style scoped></style>
