import * as vscode from 'vscode';
import { ProjectsProvider } from './projectsProvider';
import { ViewMode, WebViewMessage } from './types';
import { sanitizeColor, escapeHtml, debounce } from './utils';

export class ProjectsViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _viewMode: ViewMode = 'table';
  private _debouncedRefresh: () => void;

  constructor(
    private context: vscode.ExtensionContext,
    private projectsProvider: ProjectsProvider
  ) {
    // Загружаем сохраненный режим отображения
    const savedViewMode = this.context.globalState.get<ViewMode>('viewMode');
    if (savedViewMode) {
      this._viewMode = savedViewMode;
    }
    
    // Создаем debounced версию refresh
    this._debouncedRefresh = debounce(() => this.refresh(), 100);
    
    // Слушаем изменения в проектах
    this.projectsProvider.onDidChangeProjects(() => {
      this._debouncedRefresh();
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Обработка сообщений от WebView
    webviewView.webview.onDidReceiveMessage(async (message: WebViewMessage) => {
      switch (message.command) {
        case 'webviewReady':
          // WebView сообщает о готовности принимать данные
          this.refresh();
          break;
        case 'viewDetails':
          if (message.projectId) {
            vscode.commands.executeCommand('projectDashboard.viewDetails', message.projectId);
          }
          break;
        case 'editProject':
          if (message.projectId) {
            vscode.commands.executeCommand('projectDashboard.editProject', message.projectId);
          }
          break;
        case 'deleteProject':
          if (message.projectId) {
            vscode.commands.executeCommand('projectDashboard.deleteProject', message.projectId);
          }
          break;
        case 'openProject':
          if (message.projectId) {
            const project = this.projectsProvider.getProject(message.projectId);
            if (project?.path) {
              const uri = vscode.Uri.file(project.path);
              await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
            } else {
              vscode.window.showInformationMessage('У проекта не указана папка');
            }
          }
          break;
      }
    });
  }

  toggleView() {
    // Циклическое переключение: table → grouped-date → grouped-tags → grouped-clients → cards → explorer → table
    if (this._viewMode === 'table') {
      this._viewMode = 'grouped-date';
    } else if (this._viewMode === 'grouped-date') {
      this._viewMode = 'grouped-tags';
    } else if (this._viewMode === 'grouped-tags') {
      this._viewMode = 'grouped-clients';
    } else if (this._viewMode === 'grouped-clients') {
      this._viewMode = 'cards';
    } else if (this._viewMode === 'cards') {
      this._viewMode = 'explorer';
    } else {
      this._viewMode = 'table';
    }
    
    // Сохраняем выбранный режим
    this.context.globalState.update('viewMode', this._viewMode);
    
    // Для view mode используем немедленный refresh
    this.refresh();
  }

  private async refresh() {
    if (this._view) {
      const projects = await this.projectsProvider.getProjects();
      this._view.webview.postMessage({
        command: 'updateProjects',
        projects,
        viewMode: this._viewMode
      });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 12px;
    }

    #content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state p {
      margin-bottom: 12px;
    }

    /* Стиль карточек */
    .card {
      background-color: var(--vscode-editor-background);
      border-left: 4px solid #6bcf7f;
      border-radius: 4px;
      padding: 12px;
      cursor: pointer;
      transition: box-shadow 0.2s;
    }

    .card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .card-color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .card-name {
      font-weight: 600;
      font-size: 14px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .card:hover .card-actions {
      opacity: 1;
    }

    .card-action-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 6px;
      font-size: 14px;
      opacity: 0.6;
      transition: all 0.2s;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .card-action-btn:hover {
      opacity: 1;
      background-color: var(--vscode-list-hoverBackground);
    }

    .card-action-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    }

    .card-description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }

    .tag {
      background-color: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-widget-border);
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
    }

    .client-tag {
      background-color: #ffd93d30;
      color: var(--vscode-foreground);
      border: 1px solid #ffd93d;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
      font-weight: 500;
    }

    .project-link-icon {
      width: 14px;
      height: 14px;
      opacity: 0.3;
      flex-shrink: 0;
    }

    .project-link-icon.has-link {
      opacity: 1;
      color: var(--vscode-textLink-foreground);
    }

    /* Стиль таблицы */
    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      overflow: hidden;
    }

    thead {
      background-color: var(--vscode-list-hoverBackground);
    }

    th {
      text-align: left;
      padding: 8px;
      font-weight: 600;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    tbody tr {
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    tbody tr:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    tbody tr:last-child {
      border-bottom: none;
    }

    td {
      padding: 8px;
      font-size: 12px;
    }

    .table-row {
      border-left: 4px solid transparent;
    }

    .table-name {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-description {
      color: var(--vscode-descriptionForeground);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .table-actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }

    .table-actions .card-action-btn {
      width: 24px;
      height: 24px;
      padding: 4px;
    }

    .table-actions .card-action-btn svg {
      width: 12px;
      height: 12px;
    }

    .table-expand-icon {
      display: inline-block;
      font-size: 10px;
      color: var(--vscode-foreground);
      transition: transform 0.2s;
      user-select: none;
      cursor: pointer;
    }

    .table-detail-row {
      transition: all 0.2s ease-in-out;
    }

    .table-detail-row td {
      border-top: none !important;
    }

    /* Стили для группировки */
    .group-section {
      margin-bottom: 12px;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: var(--vscode-sideBar-background);
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.2s;
    }

    .group-header:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .group-expand-icon {
      font-size: 10px;
      color: var(--vscode-foreground);
      transition: transform 0.2s;
    }

    .group-title {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      flex: 1;
    }

    .group-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .group-content {
      margin-top: 8px;
      padding-left: 4px;
    }
  </style>
</head>
<body>
  <div id="search-container" style="margin-bottom: 12px; display: none;">
    <input 
      type="text" 
      id="search-input" 
      placeholder="Поиск по названию, описанию или тегам..."
      style="
        width: 100%;
        padding: 8px 12px;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        outline: none;
      "
    />
    <div id="search-info" style="
      margin-top: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      display: none;
    "></div>
  </div>
  <div id="content">
    <div class="empty-state">
      <p>Нет проектов</p>
      <p style="font-size: 12px;">Нажмите "+" чтобы добавить проект</p>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let projects = [];
    let allProjects = [];
    let viewMode = 'cards';
    let searchQuery = '';

    // Search input debounce
    let searchTimeout;
    const searchInput = document.getElementById('search-input');
    const searchContainer = document.getElementById('search-container');
    const searchInfo = document.getElementById('search-info');

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterProjects();
      }, 200);
    });

    function filterProjects() {
      if (!searchQuery) {
        projects = allProjects;
        searchInfo.style.display = 'none';
      } else {
        projects = allProjects.filter(project => {
          const matchName = project.name.toLowerCase().includes(searchQuery);
          const matchDescription = project.description?.toLowerCase().includes(searchQuery);
          const matchTags = project.tags.some(tag => tag.toLowerCase().includes(searchQuery));
          const matchPath = project.path?.toLowerCase().includes(searchQuery);
          const matchClient = project.clientName?.toLowerCase().includes(searchQuery);
          const matchUrl = project.projectUrl?.toLowerCase().includes(searchQuery);
          return matchName || matchDescription || matchTags || matchPath || matchClient || matchUrl;
        });
        
        searchInfo.style.display = 'block';
        searchInfo.textContent = \`\u041d\u0430\u0439\u0434\u0435\u043d\u043e: \${projects.length} \u0438\u0437 \${allProjects.length} \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432\`;
      }
      render();
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'updateProjects') {
        allProjects = message.projects;
        viewMode = message.viewMode;
        
        // Show/hide search based on project count
        if (allProjects.length > 0) {
          searchContainer.style.display = 'block';
        } else {
          searchContainer.style.display = 'none';
        }
        
        filterProjects();
      }
    });

    function render() {
      const content = document.getElementById('content');
      
      if (projects.length === 0) {
        content.innerHTML = \`
          <div class="empty-state">
            <p>Нет проектов</p>
            <p style="font-size: 12px;">Нажмите "+" чтобы добавить проект</p>
          </div>
        \`;
        return;
      }

      if (viewMode === 'table') {
        renderTable(content);
      } else if (viewMode === 'grouped-date') {
        renderGroupedByDate(content);
      } else if (viewMode === 'grouped-tags') {
        renderGroupedByTags(content);
      } else if (viewMode === 'grouped-clients') {
        renderGroupedByClients(content);
      } else if (viewMode === 'cards') {
        renderCards(content);
      } else if (viewMode === 'explorer') {
        renderExplorer(content);
      }
    }

    function renderProjectTags(project) {
      let html = '';
      
      // Иконка ссылки на проект (слева)
      const hasLink = project.projectUrl ? 'has-link' : '';
      html += \`<svg class="project-link-icon \${hasLink}" viewBox="0 0 16 16" fill="currentColor">
        <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/>
      </svg>\`;
      
      // Тег клиента (если есть)
      if (project.clientName) {
        html += \`<span class="client-tag">\${escapeHtml(project.clientName)}</span>\`;
      }
      
      // Обычные теги
      if (project.tags.length > 0) {
        html += project.tags.map(tag => \`<span class="tag">\${escapeHtml(tag)}</span>\`).join('');
      }
      
      return html;
    }

    function renderProjectTagsCompact(project) {
      let html = '';
      
      // Иконка ссылки на проект (компактная для explorer view)
      if (project.projectUrl) {
        html += \`<svg class="project-link-icon has-link" viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;">
          <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/>
        </svg>\`;
      }
      
      // Тег клиента (если есть)
      if (project.clientName) {
        html += \`<span style="font-size: 10px; padding: 1px 4px; background-color: #ffd93d30; border: 1px solid #ffd93d; border-radius: 2px; margin-left: 4px;">\${escapeHtml(project.clientName)}</span>\`;
      }
      
      return html;
    }

    function renderCards(container) {
      container.innerHTML = projects.map(project => \`
        <div class="card" style="border-left-color: \${sanitizeColor(project.color)};" onclick="viewDetails('\${project.id}')" title="Кликните для просмотра деталей проекта">
          <div class="card-header">
            <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
            <div class="card-name">\${escapeHtml(project.name)}</div>
            <div class="card-actions">
              <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
              </button>
              <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
              </button>
              <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
              </button>
            </div>
          </div>
          \${project.description ? \`
            <div class="card-description">\${escapeHtml(project.description)}</div>
          \` : ''}
          <div class="card-tags">
            \${renderProjectTags(project)}
          </div>
        </div>
      \`).join('');
    }

    function renderTable(container) {
      container.innerHTML = \`
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 30px;"></th>
                <th>Название</th>
                <th style="width: 100px;">Действия</th>
              </tr>
            </thead>
            <tbody>
              \${projects.map(project => \`
                <tr class="table-row" style="border-left-color: \${sanitizeColor(project.color)};" onclick="event.target.tagName !== 'BUTTON' && toggleRow('\${project.id}')">
                  <td style="text-align: center;">
                    <span class="table-expand-icon" id="icon-\${project.id}">▶</span>
                  </td>
                  <td onclick="viewDetails('\${project.id}')" style="cursor: pointer;">
                    <div class="table-name">
                      <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
                      \${escapeHtml(project.name)}
                    </div>
                    <div class="card-tags" style="margin-top: 4px;">
                      \${renderProjectTags(project)}
                    </div>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                        <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                      </button>
                      <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                        <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                      </button>
                      <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                        <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr class="table-detail-row" id="detail-\${project.id}" style="display: none;">
                  <td colspan="3" style="padding: 12px 16px; background-color: var(--vscode-input-background);">
                    \${project.description ? \`
                      <div style="margin-bottom: 12px;">
                        <strong style="color: var(--vscode-descriptionForeground);">Описание:</strong><br>
                        <span style="color: var(--vscode-foreground);">\${escapeHtml(project.description)}</span>
                      </div>
                    \` : '<div style="color: var(--vscode-descriptionForeground); font-style: italic; margin-bottom: 12px;">Нет описания</div>'}
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    function toggleRow(projectId) {
      const detailRow = document.getElementById('detail-' + projectId);
      const icon = document.getElementById('icon-' + projectId);
      
      if (detailRow.style.display === 'none') {
        // Закрываем все открытые строки перед открытием новой
        const allDetailRows = document.querySelectorAll('.table-detail-row');
        const allIcons = document.querySelectorAll('.table-expand-icon');
        
        allDetailRows.forEach(row => {
          row.style.display = 'none';
        });
        
        allIcons.forEach(iconEl => {
          iconEl.textContent = '▶';
        });
        
        // Открываем текущую строку
        detailRow.style.display = 'table-row';
        icon.textContent = '▼';
      } else {
        detailRow.style.display = 'none';
        icon.textContent = '▶';
      }
    }

    function renderGroupedByDate(container) {
      // Группировка проектов по дате использования
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const groups = {
        today: [],
        yesterday: [],
        thisWeek: [],
        thisMonth: [],
        older: []
      };

      projects.forEach(project => {
        const dateStr = project.lastAccessedAt || project.updatedAt;
        const date = new Date(dateStr);

        if (date >= today) {
          groups.today.push(project);
        } else if (date >= yesterday) {
          groups.yesterday.push(project);
        } else if (date >= weekAgo) {
          groups.thisWeek.push(project);
        } else if (date >= monthAgo) {
          groups.thisMonth.push(project);
        } else {
          groups.older.push(project);
        }
      });

      const groupLabels = {
        today: 'Сегодня',
        yesterday: 'Вчера',
        thisWeek: 'На этой неделе',
        thisMonth: 'В этом месяце',
        older: 'Старые'
      };

      let html = '';

      Object.keys(groups).forEach(groupKey => {
        const groupProjects = groups[groupKey];
        if (groupProjects.length === 0) return;

        html += \`
          <div class="group-section">
            <div class="group-header" onclick="toggleGroup('\${groupKey}')">
              <span class="group-expand-icon" id="group-icon-\${groupKey}">▼</span>
              <span class="group-title">\${groupLabels[groupKey]}</span>
              <span class="group-count">\${groupProjects.length}</span>
            </div>
            <div class="group-content" id="group-content-\${groupKey}">
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  \${groupProjects.map(project => \`
                    <tr class="table-row" style="border-left-color: \${sanitizeColor(project.color)};" onclick="event.target.tagName !== 'BUTTON' && viewDetails('\${project.id}')">
                      <td style="padding: 8px; cursor: pointer;">
                        <div class="table-name">
                          <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
                          \${escapeHtml(project.name)}
                        </div>
                        <div class="card-tags" style="margin-top: 4px;">
                          \${renderProjectTags(project)}
                        </div>
                      </td>
                      <td style="width: 100px; padding: 8px;">
                        <div class="table-actions">
                          <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                            <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                            <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                            <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        \`;
      });

      container.innerHTML = html;
    }

    function toggleGroup(groupKey) {
      const content = document.getElementById('group-content-' + groupKey);
      const icon = document.getElementById('group-icon-' + groupKey);
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
      } else {
        content.style.display = 'none';
        icon.textContent = '▶';
      }
    }

    function renderGroupedByTags(container) {
      // Группировка проектов по тегам
      const tagGroups = new Map();
      const noTagsProjects = [];

      projects.forEach(project => {
        if (project.tags.length === 0) {
          noTagsProjects.push(project);
        } else {
          project.tags.forEach(tag => {
            if (!tagGroups.has(tag)) {
              tagGroups.set(tag, []);
            }
            tagGroups.get(tag).push(project);
          });
        }
      });

      // Сортируем теги по алфавиту
      const sortedTags = Array.from(tagGroups.keys()).sort();

      let html = '';

      // Проекты с тегами
      sortedTags.forEach(tag => {
        const tagProjects = tagGroups.get(tag);
        html += \`
          <div class="group-section">
            <div class="group-header" onclick="toggleGroup('tag-\${escapeHtml(tag)}')">
              <span class="group-expand-icon" id="group-icon-tag-\${escapeHtml(tag)}">▼</span>
              <span class="group-title">\${escapeHtml(tag)}</span>
              <span class="group-count">\${tagProjects.length}</span>
            </div>
            <div class="group-content" id="group-content-tag-\${escapeHtml(tag)}">
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  \${tagProjects.map(project => \`
                    <tr class="table-row" style="border-left-color: \${sanitizeColor(project.color)};" onclick="event.target.tagName !== 'BUTTON' && viewDetails('\${project.id}')">
                      <td style="padding: 8px; cursor: pointer;">
                        <div class="table-name">
                          <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
                          \${escapeHtml(project.name)}
                        </div>
                        \${project.description ? \`<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">\${escapeHtml(project.description)}</div>\` : ''}
                      </td>
                      <td style="width: 100px; padding: 8px;">
                        <div class="table-actions">
                          <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                            <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                            <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                            <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        \`;
      });

      // Проекты без тегов
      if (noTagsProjects.length > 0) {
        html += \`
          <div class="group-section">
            <div class="group-header" onclick="toggleGroup('no-tags')">
              <span class="group-expand-icon" id="group-icon-no-tags">▼</span>
              <span class="group-title">Без тегов</span>
              <span class="group-count">\${noTagsProjects.length}</span>
            </div>
            <div class="group-content" id="group-content-no-tags">
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  \${noTagsProjects.map(project => \`
                    <tr class="table-row" style="border-left-color: \${sanitizeColor(project.color)};" onclick="event.target.tagName !== 'BUTTON' && viewDetails('\${project.id}')">
                      <td style="padding: 8px; cursor: pointer;">
                        <div class="table-name">
                          <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
                          \${escapeHtml(project.name)}
                        </div>
                        \${project.description ? \`<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">\${escapeHtml(project.description)}</div>\` : ''}
                      </td>
                      <td style="width: 100px; padding: 8px;">
                        <div class="table-actions">
                          <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                            <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                            <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                            <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        \`;
      }

      container.innerHTML = html || '<div class="empty-state">Нет проектов для отображения</div>';
    }

    function renderGroupedByClients(container) {
      // Группировка проектов по клиентам
      const clientGroups = new Map();
      const noClientProjects = [];

      projects.forEach(project => {
        if (!project.clientName) {
          noClientProjects.push(project);
        } else {
          if (!clientGroups.has(project.clientName)) {
            clientGroups.set(project.clientName, []);
          }
          clientGroups.get(project.clientName).push(project);
        }
      });

      // Сортируем клиентов по алфавиту
      const sortedClients = Array.from(clientGroups.keys()).sort();

      let html = '';

      // Проекты с клиентами
      sortedClients.forEach(client => {
        const clientProjects = clientGroups.get(client);
        html += \`
          <div class="group-section">
            <div class="group-header" onclick="toggleGroup('client-\${escapeHtml(client)}')">
              <span class="group-expand-icon" id="group-icon-client-\${escapeHtml(client)}">▼</span>
              <span class="group-title">\${escapeHtml(client)}</span>
              <span class="group-count">\${clientProjects.length}</span>
            </div>
            <div class="group-content" id="group-content-client-\${escapeHtml(client)}">
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  \${clientProjects.map(project => \`
                    <tr class="table-row" style="border-left-color: \${sanitizeColor(project.color)};" onclick="event.target.tagName !== 'BUTTON' && viewDetails('\${project.id}')">
                      <td style="padding: 8px; cursor: pointer;">
                        <div class="table-name">
                          <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
                          \${escapeHtml(project.name)}
                        </div>
                        \${project.tags.length > 0 ? \`
                          <div class="card-tags" style="margin-top: 4px;">
                            \${project.tags.map(tag => \`<span class="tag">\${escapeHtml(tag)}</span>\`).join('')}
                          </div>
                        \` : ''}
                        \${project.description ? \`<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">\${escapeHtml(project.description)}</div>\` : ''}
                      </td>
                      <td style="width: 100px; padding: 8px;">
                        <div class="table-actions">
                          <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                            <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                            <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                            <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        \`;
      });

      // Проекты без клиента
      if (noClientProjects.length > 0) {
        html += \`
          <div class="group-section">
            <div class="group-header" onclick="toggleGroup('no-client')">
              <span class="group-expand-icon" id="group-icon-no-client">▼</span>
              <span class="group-title">Без клиента</span>
              <span class="group-count">\${noClientProjects.length}</span>
            </div>
            <div class="group-content" id="group-content-no-client">
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  \${noClientProjects.map(project => \`
                    <tr class="table-row" style="border-left-color: \${sanitizeColor(project.color)};" onclick="event.target.tagName !== 'BUTTON' && viewDetails('\${project.id}')">
                      <td style="padding: 8px; cursor: pointer;">
                        <div class="table-name">
                          <div class="card-color-dot" style="background-color: \${sanitizeColor(project.color)};"></div>
                          \${escapeHtml(project.name)}
                        </div>
                        \${project.tags.length > 0 ? \`
                          <div class="card-tags" style="margin-top: 4px;">
                            \${project.tags.map(tag => \`<span class="tag">\${escapeHtml(tag)}</span>\`).join('')}
                          </div>
                        \` : ''}
                        \${project.description ? \`<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">\${escapeHtml(project.description)}</div>\` : ''}
                      </td>
                      <td style="width: 100px; padding: 8px;">
                        <div class="table-actions">
                          <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект">
                            <svg viewBox="0 0 16 16"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать">
                            <svg viewBox="0 0 16 16"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                          </button>
                          <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить">
                            <svg viewBox="0 0 16 16"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        \`;
      }

      container.innerHTML = html || '<div class="empty-state">Нет проектов для отображения</div>';
    }

    function renderExplorer(container) {
      // Отображение в стиле Explorer VS Code - теги как папки
      const tagGroups = new Map();
      const noTagsProjects = [];

      projects.forEach(project => {
        if (project.tags.length === 0) {
          noTagsProjects.push(project);
        } else {
          project.tags.forEach(tag => {
            if (!tagGroups.has(tag)) {
              tagGroups.set(tag, []);
            }
            tagGroups.get(tag).push(project);
          });
        }
      });

      const sortedTags = Array.from(tagGroups.keys()).sort();

      let html = '<div style="padding: 8px;">';

      // Теги как папки
      sortedTags.forEach(tag => {
        const tagProjects = tagGroups.get(tag);
        html += \`
          <div style="margin-bottom: 8px;">
            <div class="explorer-folder" onclick="toggleExplorerFolder('tag-\${escapeHtml(tag)}')" style="cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.backgroundColor='var(--vscode-list-hoverBackground)'" onmouseout="this.style.backgroundColor='transparent'">
              <span class="explorer-icon" id="explorer-icon-tag-\${escapeHtml(tag)}" style="font-size: 12px; width: 12px;">▼</span>
              <svg width="16" height="16" viewBox="0 0 16 16" style="fill: var(--vscode-icon-foreground);"><path d="M7 2L8 3H14V13H2V2H7ZM8 3H3V12H13V4H8V3Z"/></svg>
              <span style="font-size: 13px;">\${escapeHtml(tag)}</span>
              <span style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: auto;">(\${tagProjects.length})</span>
            </div>
            <div class="explorer-content" id="explorer-content-tag-\${escapeHtml(tag)}" style="margin-left: 24px; margin-top: 2px;">
              \${tagProjects.map(project => \`
                <div class="explorer-item" onclick="viewDetails('\${project.id}')" style="cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px; font-size: 13px;" onmouseover="this.style.backgroundColor='var(--vscode-list-hoverBackground)'" onmouseout="this.style.backgroundColor='transparent'">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background-color: \${sanitizeColor(project.color)}; flex-shrink: 0;"></div>
                  <span style="flex: 1; display: flex; align-items: center; gap: 4px;">
                    \${escapeHtml(project.name)}
                    \${renderProjectTagsCompact(project)}
                  </span>
                  <div style="display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s;" class="explorer-actions">
                    <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект" style="padding: 2px;">
                      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                    </button>
                    <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать" style="padding: 2px;">
                      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                    </button>
                    <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить" style="padding: 2px;">
                      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                    </button>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      });

      // Проекты без тегов
      if (noTagsProjects.length > 0) {
        html += \`
          <div style="margin-bottom: 8px;">
            <div class="explorer-folder" onclick="toggleExplorerFolder('no-tags')" style="cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.backgroundColor='var(--vscode-list-hoverBackground)'" onmouseout="this.style.backgroundColor='transparent'">
              <span class="explorer-icon" id="explorer-icon-no-tags" style="font-size: 12px; width: 12px;">▼</span>
              <svg width="16" height="16" viewBox="0 0 16 16" style="fill: var(--vscode-icon-foreground);"><path d="M7 2L8 3H14V13H2V2H7ZM8 3H3V12H13V4H8V3Z"/></svg>
              <span style="font-size: 13px;">Без тегов</span>
              <span style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: auto;">(\${noTagsProjects.length})</span>
            </div>
            <div class="explorer-content" id="explorer-content-no-tags" style="margin-left: 24px; margin-top: 2px;">
              \${noTagsProjects.map(project => \`
                <div class="explorer-item" onclick="viewDetails('\${project.id}')" style="cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px; font-size: 13px;" onmouseover="this.style.backgroundColor='var(--vscode-list-hoverBackground)'" onmouseout="this.style.backgroundColor='transparent'">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background-color: \${sanitizeColor(project.color)}; flex-shrink: 0;"></div>
                  <span style="flex: 1; display: flex; align-items: center; gap: 4px;">
                    \${escapeHtml(project.name)}
                    \${renderProjectTagsCompact(project)}
                  </span>
                  <div style="display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s;" class="explorer-actions">
                    <button class="card-action-btn" onclick="event.stopPropagation(); openProject('\${project.id}')" title="Открыть проект" style="padding: 2px;">
                      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 0l8 8-8 8V9H0V7h8V0z"/></svg>
                    </button>
                    <button class="card-action-btn" onclick="event.stopPropagation(); editProject('\${project.id}')" title="Редактировать" style="padding: 2px;">
                      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M13.5 1l1.5 1.5L5.5 12 1 13.5 2.5 9 13.5 1zM4 10l1 1L2 12l1-1z"/></svg>
                    </button>
                    <button class="card-action-btn" onclick="event.stopPropagation(); deleteProject('\${project.id}')" title="Удалить" style="padding: 2px;">
                      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 3v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3H2zm2 11V6h8v8H4zM1 2h4V1h6v1h4v1H1V2z"/></svg>
                    </button>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      }

      html += '</div>';
      
      // Добавляем стили для показа кнопок при наведении
      html += \`
        <style>
          .explorer-item:hover .explorer-actions {
            opacity: 1 !important;
          }
        </style>
      \`;

      container.innerHTML = html || '<div class="empty-state">Нет проектов для отображения</div>';
    }

    function toggleExplorerFolder(folderId) {
      const content = document.getElementById('explorer-content-' + folderId);
      const icon = document.getElementById('explorer-icon-' + folderId);
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
      } else {
        content.style.display = 'none';
        icon.textContent = '▶';
      }
    }

    function editProject(projectId) {
      vscode.postMessage({
        command: 'editProject',
        projectId
      });
    }

    function deleteProject(projectId) {
      vscode.postMessage({
        command: 'deleteProject',
        projectId
      });
    }

    function viewDetails(projectId) {
      vscode.postMessage({
        command: 'viewDetails',
        projectId
      });
    }

    function openProject(projectId) {
      vscode.postMessage({
        command: 'openProject',
        projectId
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

    // Notify extension that WebView is ready to receive data
    vscode.postMessage({ command: 'webviewReady' });
  </script>
</body>
</html>`;
  }
}
