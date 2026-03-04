import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectsProvider } from './projectsProvider';
import { ProjectsViewProvider } from './projectsView';
import { SettingsViewProvider } from './settingsView';
import { ProjectDetailViewProvider } from './projectDetailView';

export function activate(context: vscode.ExtensionContext) {
  // Создаём канал вывода для логирования
  const outputChannel = vscode.window.createOutputChannel('Project Dashboard');
  outputChannel.appendLine('Project Dashboard extension activated');
  
  console.log('Project Dashboard extension is now active');

  // Инициализация провайдера данных
  const projectsProvider = new ProjectsProvider(context);

  // Инициализация WebView провайдера
  const projectsViewProvider = new ProjectsViewProvider(context, projectsProvider);

  // Инициализация провайдера настроек
  const settingsViewProvider = new SettingsViewProvider(context, projectsProvider);

  // Инициализация провайдера деталей проекта
  const projectDetailViewProvider = new ProjectDetailViewProvider(context, projectsProvider);

  // Регистрация WebView провайдера
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'projectDashboard',
      projectsViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Команда: добавить проект
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.addProject', async () => {
      // 1. Сначала выбор папки
      const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Выбрать папку проекта',
        title: 'Шаг 1: Выберите папку проекта'
      });

      if (!folderUris || folderUris.length === 0) {
        return;
      }

      const path = folderUris[0].fsPath;
      const folderName = path.split('/').pop() || 'Мой проект';

      // 2. Название проекта (по умолчанию = имя папки)
      const name = await vscode.window.showInputBox({
        prompt: 'Название проекта',
        value: folderName,
        placeHolder: folderName
      });

      if (!name) {
        return;
      }

      // 3. Описание проекта
      const description = await vscode.window.showInputBox({
        prompt: 'Описание проекта (необязательно)',
        placeHolder: 'Краткое описание...'
      });

      // 4. Теги
      const tagsInput = await vscode.window.showInputBox({
        prompt: 'Теги через запятую (необязательно)',
        placeHolder: 'frontend, react, typescript'
      });

      const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

      // 5. Цвет
      const colors = [
        { label: '🔴 Красный', value: '#ff6b6b' },
        { label: '🟠 Оранжевый', value: '#ff9f43' },
        { label: '🟡 Желтый', value: '#ffd93d' },
        { label: '🟢 Зеленый', value: '#6bcf7f' },
        { label: '🔵 Синий', value: '#4d96ff' },
        { label: '🟣 Фиолетовый', value: '#a29bfe' },
        { label: '🟤 Серый', value: '#95a5a6' }
      ];

      const colorChoice = await vscode.window.showQuickPick(colors, {
        placeHolder: 'Выберите цвет'
      });

      const color = colorChoice?.value || '#6bcf7f';

      // Получаем уникальный идентификатор папки
      let folderInode: string | undefined;
      try {
        const stats = await fs.promises.stat(path);
        folderInode = `${stats.ino}:${stats.dev}`;
        outputChannel.appendLine(`[Добавление проекта] inode: ${folderInode}, путь: ${path}`);
      } catch (error) {
        const message = `Не удалось получить inode папки: ${error}`;
        outputChannel.appendLine(`[Ошибка] ${message}`);
        console.error(message, error);
      }

      await projectsProvider.addProject({
        name,
        description: description || '',
        tags,
        color,
        path,
        folderInode
      });

      outputChannel.appendLine(`[Успех] Проект "${name}" добавлен`);
      vscode.window.showInformationMessage(`Проект "${name}" добавлен`);
    })
  );

  // Команда: удалить проект
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.deleteProject', async (projectId: string) => {
      const project = projectsProvider.getProject(projectId);
      if (!project) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Удалить проект "${project.name}"?`,
        { modal: true, detail: 'Это действие нельзя отменить' },
        'Удалить'
      );

      if (confirm === 'Удалить') {
        await projectsProvider.deleteProject(projectId);
        outputChannel.appendLine(`[Удаление] Проект "${project.name}" удален`);
        vscode.window.showInformationMessage(`Проект "${project.name}" удален`);
      }
    })
  );

  // Команда: редактировать проект
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.editProject', async (projectId: string) => {
      const project = projectsProvider.getProject(projectId);
      if (!project) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Название проекта',
        value: project.name
      });

      if (!name) {
        return;
      }

      const description = await vscode.window.showInputBox({
        prompt: 'Описание проекта',
        value: project.description
      });

      const tagsInput = await vscode.window.showInputBox({
        prompt: 'Теги (через запятую)',
        value: project.tags.join(', ')
      });

      const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

      const colors = [
        { label: '🔴 Красный', value: '#ff6b6b' },
        { label: '🟠 Оранжевый', value: '#ff9f43' },
        { label: '🟡 Желтый', value: '#ffd93d' },
        { label: '🟢 Зеленый', value: '#6bcf7f' },
        { label: '🔵 Синий', value: '#4d96ff' },
        { label: '🟣 Фиолетовый', value: '#a29bfe' },
        { label: '🟤 Серый', value: '#95a5a6' }
      ];

      const currentColor = colors.find(c => c.value === project.color);
      const colorChoice = await vscode.window.showQuickPick(colors, {
        placeHolder: 'Выберите цвет',
        ...(currentColor && { activeItems: [currentColor] })
      });

      const color = colorChoice?.value || project.color;

      // Опция изменить папку
      const changeFolder = await vscode.window.showQuickPick(
        ['Оставить текущую папку', 'Выбрать другую папку'],
        { placeHolder: project.path ? `Текущая: ${project.path}` : 'Папка не выбрана' }
      );

      let path = project.path;
      if (changeFolder === 'Выбрать другую папку') {
        const folderUris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Выбрать папку проекта',
          title: 'Выберите папку проекта'
        });
        path = folderUris?.[0]?.fsPath || project.path;
      }

      await projectsProvider.updateProject(projectId, {
        name,
        description: description || '',
        tags,
        color,
        path
      });

      vscode.window.showInformationMessage(`Проект "${name}" обновлен`);
    })
  );

  // Команда: переключить вид
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.toggleView', () => {
      projectsViewProvider.toggleView();
    })
  );

  // Команда: показать настройки и информацию
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.showSettings', () => {
      settingsViewProvider.show();
    })
  );

  // Команда: показать детали проекта
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.viewDetails', (projectId: string) => {
      projectDetailViewProvider.show(projectId);
    })
  );

  // Команда: экспорт проектов в JSON файл
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.exportProjects', async () => {
      try {
        const projects = await projectsProvider.getProjects();
        
        if (projects.length === 0) {
          vscode.window.showInformationMessage('Нет проектов для экспорта');
          return;
        }

        // Предложить выбрать место сохранения
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(require('os').homedir(), 'project-dashboard-backup.json')),
          filters: {
            'JSON': ['json']
          },
          saveLabel: 'Экспортировать'
        });

        if (!uri) {
          return; // Пользователь отменил
        }

        // Сохраняем с отступами для читаемости
        const jsonData = JSON.stringify(projects, null, 2);
        await fs.promises.writeFile(uri.fsPath, jsonData, 'utf8');

        const action = await vscode.window.showInformationMessage(
          `✅ Экспортировано ${projects.length} проектов в ${path.basename(uri.fsPath)}`,
          'Открыть файл'
        );

        if (action === 'Открыть файл') {
          await vscode.commands.executeCommand('vscode.open', uri);
        }

        outputChannel.appendLine(`[Export] Exported ${projects.length} projects to ${uri.fsPath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Ошибка экспорта: ${error}`);
        outputChannel.appendLine(`[Export Error] ${error}`);
      }
    })
  );

  // Команда: импорт проектов из JSON файла
  context.subscriptions.push(
    vscode.commands.registerCommand('projectDashboard.importProjects', async () => {
      try {
        // Предложить выбрать файл
        const uris = await vscode.window.showOpenDialog({
          defaultUri: vscode.Uri.file(require('os').homedir()),
          canSelectMany: false,
          filters: {
            'JSON': ['json']
          },
          openLabel: 'Импортировать'
        });

        if (!uris || uris.length === 0) {
          return; // Пользователь отменил
        }

        const filePath = uris[0].fsPath;
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        const importedProjects = JSON.parse(fileContent);

        // Валидация данных
        if (!Array.isArray(importedProjects)) {
          vscode.window.showErrorMessage('Некорректный формат файла: ожидается массив проектов');
          return;
        }

        // Проверяем структуру проектов
        const isValid = importedProjects.every(p => 
          p.id && p.name && typeof p.name === 'string' &&
          Array.isArray(p.tags) && typeof p.color === 'string'
        );

        if (!isValid) {
          vscode.window.showErrorMessage('Некорректная структура данных в файле');
          return;
        }

        // Получаем текущие проекты
        const existingProjects = await projectsProvider.getProjects();
        const existingIds = new Set(existingProjects.map(p => p.id));

        // Фильтруем дубликаты
        const newProjects = importedProjects.filter(p => !existingIds.has(p.id));
        const duplicatesCount = importedProjects.length - newProjects.length;

        if (newProjects.length === 0) {
          vscode.window.showInformationMessage('Все проекты из файла уже существуют');
          return;
        }

        // Спрашиваем подтверждение
        const message = duplicatesCount > 0 
          ? `Импортировать ${newProjects.length} новых проектов? (${duplicatesCount} дубликатов будет пропущено)`
          : `Импортировать ${newProjects.length} проектов?`;

        const confirm = await vscode.window.showInformationMessage(
          message,
          { modal: true },
          'Импортировать'
        );

        if (confirm !== 'Импортировать') {
          return;
        }

        // Импортируем проекты
        const allProjects = [...existingProjects, ...newProjects];
        await context.globalState.update('projects', allProjects);

        // Инвалидируем кэш и обновляем view
        (projectsProvider as any).invalidateCache?.();
        (projectsProvider as any)._onDidChangeProjects.fire();

        let successMessage = `✅ Импортировано ${newProjects.length} проектов`;
        if (duplicatesCount > 0) {
          successMessage += ` (${duplicatesCount} дубликатов пропущено)`;
        }

        vscode.window.showInformationMessage(successMessage);
        outputChannel.appendLine(`[Import] Imported ${newProjects.length} projects from ${filePath}`);
        
        if (duplicatesCount > 0) {
          outputChannel.appendLine(`[Import] Skipped ${duplicatesCount} duplicates`);
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          vscode.window.showErrorMessage('Ошибка импорта: файл не является валидным JSON');
        } else {
          vscode.window.showErrorMessage(`Ошибка импорта: ${error}`);
        }
        outputChannel.appendLine(`[Import Error] ${error}`);
      }
    })
  );
}

export function deactivate() {}
