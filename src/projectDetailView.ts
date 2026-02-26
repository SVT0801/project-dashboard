import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectsProvider } from './projectsProvider';
import { Project, WebViewMessage } from './types';
import { sanitizeColor, escapeHtml } from './utils';

export class ProjectDetailViewProvider {
  private _panel?: vscode.WebviewPanel;
  private _messageDisposable?: vscode.Disposable;
  private _verifyLocks = new Map<string, Promise<void>>();
  private _outputChannel: vscode.OutputChannel;

  constructor(
    private context: vscode.ExtensionContext,
    private projectsProvider: ProjectsProvider
  ) {
    this._outputChannel = vscode.window.createOutputChannel('Project Dashboard - Detail View');
  }

  public async show(projectId: string) {
    let project = this.projectsProvider.getProject(projectId);
    if (!project) {
      vscode.window.showErrorMessage('Проект не найден');
      return;
    }

    // Проверяем и обновляем путь к папке если она была переименована
    if (project.path && project.folderInode) {
      // Проверяем наличие lock для этого проекта
      let verifyPromise = this._verifyLocks.get(projectId);
      if (!verifyPromise) {
        // Создаем новую задачу проверки
        verifyPromise = this.verifyAndUpdateFolderPath(projectId, project).finally(() => {
          this._verifyLocks.delete(projectId);
        });
        this._verifyLocks.set(projectId, verifyPromise);
      }
      // Ждем завершения проверки
      await verifyPromise;
      // Получаем обновленный проект после проверки
      project = this.projectsProvider.getProject(projectId) || project;
    }

    // Обновляем дату последнего доступа
    this.projectsProvider.updateLastAccessed(projectId);

    if (this._panel) {
      this._panel.reveal();
    } else {
      this._panel = vscode.window.createWebviewPanel(
        'projectDetail',
        project.name,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this._panel.onDidDispose(() => {
        this._messageDisposable?.dispose();
        this._messageDisposable = undefined;
        this._panel = undefined;
      });
    }

    this._panel.title = project.name;
    this._panel.webview.html = this.getHtmlContent(project);

    // Обработка сообщений от WebView
    // Очищаем старый обработчик перед созданием нового
    this._messageDisposable?.dispose();
    this._messageDisposable = this._panel.webview.onDidReceiveMessage(async (message: WebViewMessage) => {
      if (message.command === 'openProject') {
        if (project.path) {
          const uri = vscode.Uri.file(project.path);
          await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
        } else {
          vscode.window.showInformationMessage('У проекта не указана папка');
        }
      } else if (message.command === 'saveField') {
        if ('field' in message && 'value' in message) {
          // Inline редактирование
          await this.projectsProvider.updateProject(projectId, {
            [message.field]: message.value
          });
          // Обновляем содержимое панели
          const updatedProject = this.projectsProvider.getProject(projectId);
          if (updatedProject && this._panel) {
            this._panel.webview.html = this.getHtmlContent(updatedProject);
          }
        }
      }
    });
  }

  /**
   * Проверяет существование папки и обновляет путь если папка была переименована
   */
  private async verifyAndUpdateFolderPath(projectId: string, project: Project): Promise<void> {
    if (!project.path || !project.folderInode) {
      return;
    }

    this._outputChannel.appendLine(`[Проверка] Проект: ${project.name}, Путь: ${project.path}`);

    try {
      // Проверяем существует ли текущий путь
      try {
        const stats = await fs.promises.stat(project.path);
        const currentInode = `${stats.ino}:${stats.dev}`;
        
        // Путь существует и inode совпадает - все ок
        if (currentInode === project.folderInode) {
          this._outputChannel.appendLine(`[Проверка] Путь валиден, inode совпадает`);
          return;
        }
        this._outputChannel.appendLine(`[Проверка] inode не совпадает: ${currentInode} !== ${project.folderInode}`);
      } catch (error) {
        // Путь не существует - продолжаем поиск
        this._outputChannel.appendLine(`[Проверка] Путь не существует, начинаем поиск`);
      }

      // Путь не существует или inode не совпадает - ищем папку по inode
      const parentDir = path.dirname(project.path);
      
      // Проверяем существует ли родительская директория
      try {
        await fs.promises.access(parentDir);
      } catch (error) {
        const message = `Родительская директория не найдена: ${parentDir}`;
        this._outputChannel.appendLine(`[Ошибка] ${message}`);
        console.warn(message);
        return;
      }

      // Ищем папку с нужным inode в родительской директории
      const files = await fs.promises.readdir(parentDir);
      this._outputChannel.appendLine(`[Поиск] Проверяем ${files.length} файлов в ${parentDir}`);
      
      for (const file of files) {
        const fullPath = path.join(parentDir, file);
        try {
          const stats = await fs.promises.stat(fullPath);
          const fileInode = `${stats.ino}:${stats.dev}`;
          
          if (fileInode === project.folderInode && stats.isDirectory()) {
            // Нашли папку с нужным inode - обновляем путь
            const message = `Обновляем путь проекта ${project.name}: ${project.path} -> ${fullPath}`;
            this._outputChannel.appendLine(`[Успех] ${message}`);
            console.log(message);
            
            await this.projectsProvider.updateProject(projectId, { path: fullPath });
            vscode.window.showInformationMessage(`Путь проекта "${project.name}" обновлен: ${path.basename(fullPath)}`);
            return;
          }
        } catch (error) {
          // Игнорируем ошибки для отдельных файлов
          continue;
        }
      }

      const message = `Не удалось найти папку с inode ${project.folderInode} для проекта ${project.name}`;
      this._outputChannel.appendLine(`[Предупреждение] ${message}`);
      console.warn(message);
    } catch (error) {
      const message = `Ошибка при проверке пути папки: ${error}`;
      this._outputChannel.appendLine(`[Критическая ошибка] ${message}`);
      console.error(message, error);
    }
  }

  private getHtmlContent(project: Project): string {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(project.name)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      line-height: 1.5;
      overflow-x: hidden;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Breadcrumb */
    .breadcrumb {
      padding: 12px 20px;
      background-color: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-widget-border);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .breadcrumb span {
      color: var(--vscode-foreground);
    }

    /* Header */
    .header {
      padding: 24px 20px;
      background-color: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .header-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .color-badge {
      width: 8px;
      height: 32px;
      background-color: ${sanitizeColor(project.color)};
      border-radius: 2px;
    }

    .project-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 3px;
      transition: background 0.2s;
      flex: 1;
    }

    .project-title:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .project-title input {
      font-size: 20px;
      font-weight: 600;
      color: var(--vscode-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      padding: 4px 8px;
      border-radius: 3px;
      font-family: var(--vscode-font-family);
      width: 100%;
    }

    .project-title input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    /* Actions Bar */
    .actions-bar {
      display: flex;
      gap: 8px;
      padding: 12px 20px;
      background-color: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .btn {
      padding: 6px 14px;
      border: none;
      border-radius: 2px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
      font-family: var(--vscode-font-family);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background-color: transparent;
      color: var(--vscode-button-foreground);
      border: 1px solid var(--vscode-button-border);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    /* Content */
    .content {
      padding: 20px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }

    .section-body {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 12px;
    }

    .editable-field {
      cursor: pointer;
      padding: 8px;
      border-radius: 3px;
      transition: background 0.2s;
      min-height: 60px;
    }

    .editable-field:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .editable-field.empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    textarea {
      width: 100%;
      min-height: 100px;
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
      resize: vertical;
    }

    textarea:focus {
      outline: none;
    }

    .field-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }

    .field-value {
      color: var(--vscode-foreground);
      white-space: pre-wrap;
    }

    .folder-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--vscode-foreground);
      padding: 8px;
      background-color: var(--vscode-sideBar-background);
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .folder-icon {
      color: var(--vscode-descriptionForeground);
    }

    .path-field {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      padding: 8px;
      background-color: var(--vscode-textCodeBlock-background);
      border-radius: 3px;
      word-break: break-all;
      color: var(--vscode-descriptionForeground);
    }

    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px;
    }

    .tag {
      background-color: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-widget-border);
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 0;
    }

    .metadata-item {
      padding: 0;
      background-color: transparent;
      border: none;
    }

    .metadata-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .metadata-value {
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .edit-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      margin-top: 8px;
    }

    .tags-container {
      min-height: 36px;
      cursor: pointer;
      padding: 8px;
      border-radius: 3px;
      transition: background 0.2s;
    }

    .tags-container:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .tags-input {
      width: 100%;
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
    }

    .tags-input:focus {
      outline: none;
    }

    .color-picker {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 8px;
    }

    .color-option {
      width: 40px;
      height: 40px;
      border-radius: 6px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s;
    }

    .color-option:hover {
      border-color: var(--vscode-focusBorder);
      transform: scale(1.1);
    }

    .color-option.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 2px var(--vscode-editor-background);
    }

    .editable-color {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 3px;
      transition: background 0.2s;
    }

    .editable-color:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="breadcrumb">
    Projects &gt; <span>${this.escapeHtml(project.name)}</span>
  </div>

  <div class="header">
    <div class="header-top">
      <div class="color-badge"></div>
      <div class="project-title" onclick="editTitle()" title="Кликните для редактирования">
        <span id="title-display">${this.escapeHtml(project.name)}</span>
      </div>
    </div>
  </div>

  <div class="actions-bar">
    ${project.path ? `
      <button class="btn btn-primary" onclick="openProject()">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l8 8-8 8V9H0V7h8V0z"/>
        </svg>
        Открыть проект
      </button>
    ` : ''}
  </div>

  <div class="content">
    <div class="section">
      <div class="section-header">Описание</div>
      <div class="section-body">
        <div class="editable-field ${project.description ? '' : 'empty'}" 
             onclick="editDescription()" 
             title="Кликните для редактирования">
          <div id="description-display">
            ${project.description ? this.escapeHtml(project.description) : 'Нет описания. Кликните чтобы добавить...'}
          </div>
        </div>
        <div class="edit-hint">Кликните чтобы редактировать</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">Теги</div>
      <div class="section-body">
        <div class="tags-container" onclick="editTags()" title="Кликните для редактирования" id="tags-container">
          ${project.tags.length > 0 
            ? project.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')
            : '<span style="color: var(--vscode-descriptionForeground); font-style: italic;">Нет тегов. Кликните чтобы добавить...</span>'
          }
        </div>
        <div class="edit-hint">Кликните чтобы редактировать. Разделяйте теги запятыми</div>
      </div>
    </div>

    ${project.path ? `
      <div class="section">
        <div class="section-header">Папка проекта</div>
        <div class="section-body">
          <div class="folder-name">
            <span class="folder-icon">📁</span>
            <span>${this.escapeHtml(project.path.split('/').pop() || '')}</span>
          </div>
          <div class="path-field">${this.escapeHtml(project.path)}</div>
        </div>
      </div>
    ` : ''}

    <div class="section">
      <div class="section-header">Информация</div>
      <div class="metadata-grid" style="padding: 12px;">
        <div class="metadata-item">
          <div class="metadata-label">Создан</div>
          <div class="metadata-value">${new Date(project.createdAt).toLocaleString('ru-RU')}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Обновлен</div>
          <div class="metadata-value">${new Date(project.updatedAt).toLocaleString('ru-RU')}</div>
        </div>
        ${project.lastAccessedAt ? `
          <div class="metadata-item">
            <div class="metadata-label">Последний доступ</div>
            <div class="metadata-value">${new Date(project.lastAccessedAt).toLocaleString('ru-RU')}</div>
          </div>
        ` : ''}
        <div class="metadata-item">
          <div class="metadata-label">Цвет</div>
          <div class="metadata-value editable-color" onclick="editColor()" title="Кликните для изменения" id="color-display">
            <span style="display: inline-block; width: 16px; height: 16px; background-color: ${sanitizeColor(project.color)}; border-radius: 3px; vertical-align: middle; margin-right: 6px;" id="color-indicator"></span>
            <span id="color-value">${this.escapeHtml(project.color)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function openProject() {
      vscode.postMessage({ command: 'openProject' });
    }

    function editTitle() {
      const display = document.getElementById('title-display');
      if (!display) return;
      
      const parent = display.parentElement;
      if (!parent) return;
      
      const currentValue = display.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
      
      parent.innerHTML = '';
      parent.appendChild(input);
      input.focus();
      input.select();

      input.addEventListener('blur', () => saveTitle(input.value, currentValue, parent));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveTitle(input.value, currentValue, parent);
        } else if (e.key === 'Escape') {
          parent.innerHTML = '<span id="title-display">' + escapeHtml(currentValue) + '</span>';
        }
      });
    }

    function saveTitle(value, oldValue, parent) {
      if (value && value.trim()) {
        vscode.postMessage({
          command: 'saveField',
          field: 'name',
          value: value.trim()
        });
      } else {
        // Если пустое значение, восстанавливаем старое
        if (parent) {
          parent.innerHTML = '<span id="title-display">' + escapeHtml(oldValue) + '</span>';
        }
      }
    }

    function editDescription() {
      const display = document.getElementById('description-display');
      const parent = display.parentElement;
      const currentValue = display.textContent.trim();
      const isEmpty = parent.classList.contains('empty');
      
      const textarea = document.createElement('textarea');
      textarea.value = isEmpty ? '' : currentValue;
      
      parent.innerHTML = '';
      parent.appendChild(textarea);
      textarea.focus();

      textarea.addEventListener('blur', () => saveDescription(textarea.value));
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          parent.innerHTML = '<div id="description-display">' + 
            (isEmpty ? 'Нет описания. Кликните чтобы добавить...' : escapeHtml(currentValue)) + 
            '</div>';
          if (isEmpty) parent.classList.add('empty');
        }
      });
    }

    function saveDescription(value) {
      vscode.postMessage({
        command: 'saveField',
        field: 'description',
        value: value.trim()
      });
    }

    function editTags() {
      const container = document.getElementById('tags-container');
      const tags = Array.from(container.querySelectorAll('.tag')).map(tag => tag.textContent);
      const currentValue = tags.join(', ');
      
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tags-input';
      input.value = currentValue;
      input.placeholder = 'Введите теги через запятую';
      
      container.innerHTML = '';
      container.appendChild(input);
      container.onclick = null;
      input.focus();

      input.addEventListener('blur', () => saveTags(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveTags(input.value);
        } else if (e.key === 'Escape') {
          location.reload();
        }
      });
    }

    function saveTags(value) {
      const tags = value.split(',').map(t => t.trim()).filter(t => t);
      vscode.postMessage({
        command: 'saveField',
        field: 'tags',
        value: tags
      });
    }

    function editColor() {
      const colorDisplay = document.getElementById('color-display');
      const currentColor = document.getElementById('color-value').textContent;
      
      const colors = [
        { name: 'Красный', value: '#ff6b6b' },
        { name: 'Оранжевый', value: '#ff9f43' },
        { name: 'Желтый', value: '#ffd93d' },
        { name: 'Зеленый', value: '#6bcf7f' },
        { name: 'Синий', value: '#4d96ff' },
        { name: 'Фиолетовый', value: '#a29bfe' },
        { name: 'Серый', value: '#95a5a6' }
      ];

      const picker = document.createElement('div');
      picker.className = 'color-picker';
      picker.innerHTML = colors.map(color => 
        '<div class="color-option ' + (color.value === currentColor ? 'selected' : '') + '" ' +
        'style="background-color: ' + color.value + ';" ' +
        'onclick="selectColor(\\'' + color.value + '\\')" ' +
        'title="' + color.name + '">' +
        '</div>'
      ).join('');

      colorDisplay.innerHTML = '';
      colorDisplay.appendChild(picker);
      colorDisplay.onclick = null;
    }

    function selectColor(color) {
      vscode.postMessage({
        command: 'saveField',
        field: 'color',
        value: color
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function sanitizeColor(color) {
      // Validate hex color format
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return color;
      }
      // Return default color if invalid
      return '#808080';
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return escapeHtml(text);
  }
}
