<script setup lang="ts">
import VideoPreview from '@/components/preview/video-preview.vue';
import AudioPreview from '@/components/preview/audio-preview.vue';
import FilePreviewOverlay from '@/components/preview/file-preview-overlay.vue';
import TextPreview from '@/components/preview/text-preview.vue';

defineOptions({ name: 'FilePreviewOverlays' });

defineProps<{
  videoPreviewFile: Api.Disk.FileItem | null;
  videoPreviewVisible: boolean;
  videoStreamToken: string;
  videoStreamBaseUrl: string;
  audioPreviewFile: Api.Disk.FileItem | null;
  audioPreviewVisible: boolean;
  audioPlaylist: any[];
  currentAudioIndex: number;
  isAudioCompact: boolean;
  previewVisible: boolean;
  previewFile: Api.Disk.PreviewFileInfo | null;
}>();

defineEmits<{
  'closeVideo': [];
  'videoTokenUpdate': [token: string];
  'closeAudio': [];
  'audioOverlayClick': [];
  'update:isAudioCompact': [value: boolean];
  'update:previewVisible': [value: boolean];
}>();
</script>

<template>
  <!-- Office/PDF preview -->
  <FilePreviewOverlay
    :visible="previewVisible"
    :file="previewFile"
    @update:visible="$emit('update:previewVisible', $event)"
    @close="$emit('update:previewVisible', false)"
  />

  <!-- Video preview -->
  <Teleport to="body">
    <VideoPreview
      v-if="videoPreviewVisible && videoPreviewFile && videoStreamToken"
      :src="videoStreamBaseUrl"
      :file-name="videoPreviewFile.fileName || videoPreviewFile.name || ''"
      :stream-token="videoStreamToken"
      @close="$emit('closeVideo')"
      @token-update="$emit('videoTokenUpdate', $event)"
    />
  </Teleport>

  <!-- Audio preview -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="audioPreviewVisible"
        class="fixed inset-0 z-9999 flex items-center justify-center"
        :class="isAudioCompact ? 'pointer-events-none' : 'bg-black/40 backdrop-blur-sm'"
        @click.self="$emit('audioOverlayClick')"
      >
        <AudioPreview
          v-if="audioPreviewFile && audioPlaylist.length > 0"
          :playlist="audioPlaylist"
          :initial-index="currentAudioIndex"
          @close="$emit('closeAudio')"
          @compact-change="$emit('update:isAudioCompact', $event)"
        />
      </div>
    </Transition>
  </Teleport>

  <TextPreview />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
