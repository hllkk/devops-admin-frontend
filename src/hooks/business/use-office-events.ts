/**
 * Office 编辑器事件处理 Hook
 */
import { type Ref } from 'vue';
import { useDialog } from 'naive-ui';
import { useOfficeHistory } from './use-office-history';
import type { DocumentStateEvent, HistoryDataEvent, DocEditorInstance } from '@/types/office';

interface UseOfficeEventsOptions {
  docEditor: () => DocEditorInstance | null;
  fileId: CommonType.IdType;
  token: string;
  username: string;
  isSaved: Ref<boolean>;
  isReady: Ref<boolean>;
  fileType: () => string;
  reloadDocument: (key?: string) => void;
  onClose: () => void;
  onReady: () => void;
}

export function useOfficeEvents(options: UseOfficeEventsOptions) {
  const dialog = useDialog();
  const historyHook = useOfficeHistory(options.fileId, options.token, options.username);

  function handleAppReady() {
    options.onReady();
  }

  function handleDocumentReady() {
    if (options.fileId) {
      historyHook.loadHistory();
    }
  }

  function handleDocumentStateChange(event: DocumentStateEvent) {
    options.isSaved.value = event.data;
  }

  function handleRequestHistory() {
    const editor = options.docEditor();
    if (editor) {
      historyHook.refreshHistory(editor);
    }
  }

  function handleRequestHistoryData(event: HistoryDataEvent) {
    const editor = options.docEditor();
    if (editor) {
      historyHook.getHistoryData(event.data, editor, options.fileType());
    }
  }

  function handleRequestHistoryClose() {
    historyHook.cancelViewHistory();
    options.reloadDocument();
  }

  function handleRequestClose() {
    if (options.isSaved.value) {
      options.onClose();
      return;
    }

    dialog.warning({
      title: '未保存的修改',
      content: '是否在关闭前保存修改？',
      positiveText: '保存并关闭',
      negativeText: '不保存关闭',
      onPositiveClick: () => {
        options.onClose();
      },
      onNegativeClick: () => {
        options.onClose();
      }
    });
  }

  return {
    handleAppReady,
    handleDocumentReady,
    handleDocumentStateChange,
    handleRequestHistory,
    handleRequestHistoryData,
    handleRequestHistoryClose,
    handleRequestClose,
    historyHook
  };
}
