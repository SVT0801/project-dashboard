export interface Project {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: string;
  path?: string;
  folderInode?: string; // Уникальный идентификатор папки (inode:dev) для отслеживания переименований
  projectUrl?: string; // Ссылка на проект
  clientName?: string; // Название клиента
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

export type ViewMode = 'table' | 'grouped-date' | 'grouped-tags' | 'grouped-clients' | 'cards' | 'explorer';

// WebView Message Types
export type WebViewMessage =
  | { command: 'webviewReady' }
  | { command: 'viewDetails'; projectId: string }
  | { command: 'editProject'; projectId: string }
  | { command: 'deleteProject'; projectId: string }
  | { command: 'openProject'; projectId: string }
  | { command: 'saveField'; field: string; value: string }
  | { command: 'switchView' }
  | { command: 'openSettings' }
  | { command: 'toggleRow'; projectId: string }
  | { command: 'getClients' }
  | { command: 'addClient'; client: string }
  | { command: 'deleteClient'; client: string };
