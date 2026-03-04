import * as vscode from 'vscode';
import { Project } from './types';
import { generateId } from './utils';

export class ProjectsProvider {
  private _onDidChangeProjects = new vscode.EventEmitter<void>();
  readonly onDidChangeProjects = this._onDidChangeProjects.event;
  private _cache: Project[] | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  async getProjects(): Promise<Project[]> {
    if (!this._cache) {
      this._cache = this.context.globalState.get<Project[]>('projects', []);
    }
    return this._cache;
  }

  getProject(id: string): Project | undefined {
    if (!this._cache) {
      this._cache = this.context.globalState.get<Project[]>('projects', []);
    }
    return this._cache.find(p => p.id === id);
  }

  private invalidateCache(): void {
    this._cache = undefined;
  }

  async addProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const projects = await this.getProjects();
    
    const newProject: Project = {
      ...projectData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    projects.push(newProject);
    await this.context.globalState.update('projects', projects);
    this.invalidateCache();
    this._onDidChangeProjects.fire();

    return newProject;
  }

  async updateProject(id: string, projectData: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
      throw new Error('Project not found');
    }

    projects[index] = {
      ...projects[index],
      ...projectData,
      updatedAt: new Date().toISOString()
    };

    await this.context.globalState.update('projects', projects);
    this.invalidateCache();
    this._onDidChangeProjects.fire();
  }

  async deleteProject(id: string): Promise<void> {
    const projects = await this.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    
    await this.context.globalState.update('projects', filtered);
    this.invalidateCache();
    this._onDidChangeProjects.fire();
  }

  async updateLastAccessed(id: string): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex(p => p.id === id);

    if (index !== -1) {
      projects[index].lastAccessedAt = new Date().toISOString();
      await this.context.globalState.update('projects', projects);
      this.invalidateCache();
    }
  }

  // Методы для работы с клиентами
  async getClients(): Promise<string[]> {
    return this.context.globalState.get<string[]>('clients', []);
  }

  async addClient(client: string): Promise<void> {
    const clients = await this.getClients();
    if (!clients.includes(client)) {
      clients.push(client);
      clients.sort(); // Сортируем по алфавиту
      await this.context.globalState.update('clients', clients);
    }
  }

  async deleteClient(client: string): Promise<void> {
    const clients = await this.getClients();
    const filtered = clients.filter(c => c !== client);
    await this.context.globalState.update('clients', filtered);
  }
}
