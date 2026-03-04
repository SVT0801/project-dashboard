import * as vscode from 'vscode';
import { ProjectsProvider } from './projectsProvider';
import { WebViewMessage } from './types';

export class SettingsViewProvider {
  private _panel?: vscode.WebviewPanel;
  private _messageDisposable?: vscode.Disposable;

  constructor(
    private context: vscode.ExtensionContext,
    private projectsProvider: ProjectsProvider
  ) {}

  public async show() {
    if (this._panel) {
      this._panel.reveal();
      await this.refreshClients();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'projectDashboardSettings',
      'Project Dashboard - Settings & Info',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this._panel.webview.html = await this.getHtmlContent();

    this._panel.onDidDispose(() => {
      this._messageDisposable?.dispose();
      this._messageDisposable = undefined;
      this._panel = undefined;
    });

    // Обработка сообщений от WebView
    this._messageDisposable?.dispose();
    this._messageDisposable = this._panel.webview.onDidReceiveMessage(async (message: WebViewMessage) => {
      if (message.command === 'getClients') {
        await this.refreshClients();
      } else if (message.command === 'addClient' && 'client' in message) {
        await this.projectsProvider.addClient(message.client);
        await this.refreshClients();
      } else if (message.command === 'deleteClient' && 'client' in message) {
        await this.projectsProvider.deleteClient(message.client);
        await this.refreshClients();
      }
    });
  }

  private async refreshClients() {
    if (this._panel) {
      const clients = await this.projectsProvider.getClients();
      this._panel.webview.postMessage({
        command: 'updateClients',
        clients
      });
    }
  }

  private async getHtmlContent(): Promise<string> {
    const clients = await this.projectsProvider.getClients();
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Dashboard - Settings & Info</title>
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
      background-color: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      padding: 32px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
      margin-bottom: 32px;
    }

    .logo {
      font-size: 48px;
      margin-bottom: 16px;
    }

    h1 {
      font-size: 32px;
      margin-bottom: 8px;
      color: var(--vscode-textLink-foreground);
    }

    .version {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .author {
      font-size: 16px;
      color: var(--vscode-textPreformat-foreground);
      font-weight: 600;
      margin-top: 16px;
      padding: 8px 16px;
      background: var(--vscode-textBlockQuote-background);
      border-left: 4px solid var(--vscode-textLink-foreground);
      display: inline-block;
    }

    .section {
      margin-bottom: 32px;
      padding: 24px;
      background-color: var(--vscode-sideBar-background);
      border-radius: 8px;
      border: 1px solid var(--vscode-widget-border);
    }

    .section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: var(--vscode-textLink-foreground);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section h3 {
      font-size: 16px;
      margin-top: 16px;
      margin-bottom: 8px;
      color: var(--vscode-textPreformat-foreground);
    }

    .section p {
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }

    .feature-list {
      list-style: none;
      padding: 0;
    }

    .feature-list li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
    }

    .feature-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: var(--vscode-textLink-foreground);
      font-weight: bold;
      font-size: 18px;
    }

    .shortcuts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .shortcut-item {
      padding: 12px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
    }

    .shortcut-key {
      font-family: var(--vscode-editor-font-family);
      background-color: var(--vscode-textCodeBlock-background);
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }

    .stats {
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
    }

    .stat-item {
      text-align: center;
      padding: 16px;
      background-color: var(--vscode-input-background);
      border-radius: 8px;
      min-width: 120px;
    }

    .stat-number {
      font-size: 32px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }

    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .footer {
      text-align: center;
      padding-top: 32px;
      margin-top: 32px;
      border-top: 1px solid var(--vscode-widget-border);
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }

    .emoji {
      font-size: 24px;
    }

    a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      font-family: var(--vscode-editor-font-family);
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }

    /* Секция управления клиентами */
    .clients-section {
      margin-top: 12px;
    }

    .clients-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      overflow: hidden;
    }

    .clients-table thead {
      background-color: var(--vscode-list-hoverBackground);
    }

    .clients-table th {
      text-align: left;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      border-bottom: 1px solid var(--vscode-input-border);
    }

    .clients-table td {
      padding: 4px 12px;
      font-size: 13px;
      color: var(--vscode-foreground);
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .clients-table tbody tr:last-child td {
      border-bottom: none;
    }

    .clients-table tbody tr:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .client-delete-btn {
      background: none;
      border: none;
      color: var(--vscode-errorForeground);
      cursor: pointer;
      padding: 2px 6px;
      font-size: 12px;
      opacity: 0.6;
      transition: opacity 0.2s;
      border-radius: 2px;
    }

    .client-delete-btn:hover {
      opacity: 1;
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .add-client-form {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .client-input {
      flex: 1;
      padding: 6px 12px;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }

    .client-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .add-client-btn {
      padding: 6px 14px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      transition: background-color 0.2s;
      white-space: nowrap;
    }

    .add-client-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .empty-clients {
      text-align: center;
      padding: 24px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">📊</div>
      <h1>Project Dashboard</h1>
      <div class="version">Version 0.0.1</div>
      <div class="author">by SVT</div>
    </div>

    <div class="section">
      <h2><span class="emoji">👥</span> Управление клиентами</h2>
      <p>
        Здесь вы можете добавить список клиентов для быстрого выбора при создании или редактировании проектов.
      </p>
      <div class="clients-section">
        <div id="clients-container">
          ${clients.length > 0 ? `
            <table class="clients-table">
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  <th>Название клиента</th>
                  <th style="width: 60px; text-align: center;"></th>
                </tr>
              </thead>
              <tbody id="clients-list">
                ${clients.map((client, index) => `
                  <tr>
                    <td style="color: var(--vscode-descriptionForeground);">${index + 1}</td>
                    <td>${this.escapeHtml(client)}</td>
                    <td style="text-align: center;">
                      <button class="client-delete-btn" onclick="deleteClient('${this.escapeHtml(client)}')" title="Удалить">
                        ✕
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty-clients" id="empty-clients">
              Нет клиентов. Добавьте первого клиента ниже.
            </div>
          `}
        </div>
        <div class="add-client-form">
          <input 
            type="text" 
            id="client-input" 
            class="client-input" 
            placeholder="Название клиента..."
            onkeydown="if(event.key === 'Enter') addClient()"
          />
          <button class="add-client-btn" onclick="addClient()">
            Добавить
          </button>
        </div>
      </div>
    </div>

    <div class="section">
      <h2><span class="emoji">🎯</span> О расширении</h2>
      <p>
        <strong>Project Dashboard</strong> — это мощное расширение для VS Code, которое позволяет 
        организовать все ваши проекты в одном удобном месте. Быстрый доступ, визуальная организация 
        и эффективное управление проектами прямо в вашем редакторе.
      </p>
    </div>

    <div class="section">
      <h2><span class="emoji">⚡</span> Основные возможности</h2>
      <ul class="feature-list">
        <li><strong>Выбор папки проекта</strong> — привязка проекта к реальной папке на диске</li>
        <li><strong>Автоматическое название</strong> — имя проекта берется из выбранной папки</li>
        <li><strong>Быстрое открытие</strong> — клик по карточке открывает папку проекта</li>
        <li><strong>Цветовая маркировка</strong> — 7 цветов для категоризации (как в macOS)</li>
        <li><strong>Теги для организации</strong> — группируйте проекты по любым критериям</li>
        <li><strong>Два режима отображения</strong> — карточки и таблица</li>
        <li><strong>Описания проектов</strong> — добавляйте заметки и важную информацию</li>
        <li><strong>Постоянное хранение</strong> — данные сохраняются между сессиями</li>
      </ul>
    </div>

    <div class="section">
      <h2><span class="emoji">🚀</span> Как использовать</h2>
      
      <h3>Добавление проекта:</h3>
      <p>
        1. Нажмите <span class="shortcut-key">+</span> в заголовке панели<br>
        2. Выберите папку проекта<br>
        3. Подтвердите или измените название (по умолчанию = имя папки)<br>
        4. Добавьте описание и теги (необязательно)<br>
        5. Выберите цвет для визуальной идентификации
      </p>

      <h3>Работа с проектами:</h3>
      <p>
        • <strong>Открыть проект</strong> — клик по карточке<br>
        • <strong>Редактировать</strong> — иконка ✏️ при наведении<br>
        • <strong>Удалить</strong> — иконка 🗑️ при наведении<br>
        • <strong>Переключить вид</strong> — кнопка списка в заголовке
      </p>

      <div class="shortcuts">
        <div class="shortcut-item">
          <div><span class="shortcut-key">+</span></div>
          <div>Добавить проект</div>
        </div>
        <div class="shortcut-item">
          <div><span class="shortcut-key">≡</span></div>
          <div>Переключить вид</div>
        </div>
        <div class="shortcut-item">
          <div><span class="shortcut-key">⚙️</span></div>
          <div>Настройки и информация</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2><span class="emoji">🎨</span> Цветовая маркировка</h2>
      <p>
        Используйте цвета для быстрой идентификации типов проектов:
      </p>
      <ul class="feature-list">
        <li>🔴 <strong>Красный</strong> — срочные или критические проекты</li>
        <li>🟠 <strong>Оранжевый</strong> — активная разработка</li>
        <li>🟡 <strong>Желтый</strong> — требуют внимания</li>
        <li>🟢 <strong>Зеленый</strong> — стабильные проекты</li>
        <li>🔵 <strong>Синий</strong> — личные проекты</li>
        <li>🟣 <strong>Фиолетовый</strong> — экспериментальные</li>
        <li>🟤 <strong>Серый</strong> — архивные или завершенные</li>
      </ul>
    </div>

    <div class="section">
      <h2><span class="emoji">💡</span> Советы по использованию</h2>
      <ul class="feature-list">
        <li>Используйте теги для группировки: <code>frontend</code>, <code>backend</code>, <code>mobile</code></li>
        <li>Добавляйте в описание важные ссылки или заметки</li>
        <li>Цвета помогают быстро находить нужный тип проектов</li>
        <li>В режиме таблицы удобно просматривать много проектов</li>
        <li>Карточки лучше подходят для детального просмотра</li>
      </ul>
    </div>

    <div class="section">
      <h2><span class="emoji">�</span> Backup и восстановление</h2>
      <p>
        Сохраняйте резервные копии ваших проектов в JSON файл. Это позволит восстановить все данные 
        при переустановке расширения или переносе на другой компьютер.
      </p>
      
      <h3>Доступные команды:</h3>
      <ul class="feature-list">
        <li><strong>Export Projects to JSON</strong> — сохранить все проекты в JSON файл</li>
        <li><strong>Import Projects from JSON</strong> — восстановить проекты из файла (дубликаты пропускаются)</li>
      </ul>

      <p style="margin-top: 16px;">
        <strong>Откройте Command Palette</strong> (<code>Cmd+Shift+P</code> / <code>Ctrl+Shift+P</code>) 
        и введите:<br>
        • <code>Project Dashboard: Export Projects to JSON</code><br>
        • <code>Project Dashboard: Import Projects from JSON</code>
      </p>

      <p style="margin-top: 16px; padding: 12px; background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textLink-foreground); border-radius: 4px;">
        💡 <strong>Совет:</strong> Регулярно сохраняйте backup перед переустановкой VS Code или расширений. 
        Экспортированный файл можно также использовать для синхронизации проектов между компьютерами.
      </p>
    </div>

    <div class="section">
      <h2><span class="emoji">🔧</span> Технические детали</h2>
      <p>
        <strong>Хранение данных:</strong> Проекты сохраняются в globalState VS Code и могут быть экспортированы в JSON<br>
        <strong>Формат:</strong> JSON с метаданными проекта<br>
        <strong>UI:</strong> WebView с нативными стилями VS Code<br>
        <strong>Совместимость:</strong> VS Code 1.85.0+
      </p>
    </div>

    <div class="footer">
      <p>Создано с ❤️ by SVT</p>
      <p style="margin-top: 8px; font-size: 12px;">
        Project Dashboard Extension for VS Code © 2026
      </p>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Добавление клиента
    function addClient() {
      const input = document.getElementById('client-input');
      const clientName = input.value.trim();
      
      if (!clientName) {
        return;
      }

      vscode.postMessage({
        command: 'addClient',
        client: clientName
      });

      input.value = '';
    }

    // Удаление клиента
    function deleteClient(clientName) {
      if (confirm('Удалить клиента "' + clientName + '"?')) {
        vscode.postMessage({
          command: 'deleteClient',
          client: clientName
        });
      }
    }

    // Обновление списка клиентов
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'updateClients') {
        updateClientsList(message.clients);
      }
    });

    function updateClientsList(clients) {
      const container = document.getElementById('clients-container');
      
      if (clients.length === 0) {
        container.innerHTML = \`
          <div class="empty-clients" id="empty-clients">
            Нет клиентов. Добавьте первого клиента ниже.
          </div>
        \`;
      } else {
        container.innerHTML = \`
          <table class="clients-table">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Название клиента</th>
                <th style="width: 60px; text-align: center;"></th>
              </tr>
            </thead>
            <tbody id="clients-list">
              \${clients.map((client, index) => \`
                <tr>
                  <td style="color: var(--vscode-descriptionForeground);">\${index + 1}</td>
                  <td>\${escapeHtml(client)}</td>
                  <td style="text-align: center;">
                    <button class="client-delete-btn" onclick="deleteClient('\${escapeHtml(client)}')" title="Удалить">
                      ✕
                    </button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Запрос клиентов при загрузке
    vscode.postMessage({ command: 'getClients' });
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
