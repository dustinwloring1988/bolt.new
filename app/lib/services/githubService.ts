import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('githubService');

export interface GitHubRepo {
  owner: string;
  name: string;
  branch?: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  tree: {
    sha: string;
  };
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
}

export interface GitHubCreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
}

export class GitHubService {
  private static getToken(): string {
    return localStorage.getItem('bolt_token_github') || '';
  }

  private static getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('GitHub token not set. Please add it in settings.');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Parse GitHub repository URL or owner/repo format
   */
  static parseRepo(githubRepo: string): GitHubRepo {
    // Handle full GitHub URLs
    if (githubRepo.includes('github.com')) {
      const match = githubRepo.match(/github\.com[/:]([^/]+)\/([^/\.]+)/);
      if (match) {
        return {
          owner: match[1],
          name: match[2],
          branch: 'main',
        };
      }
    }
    
    // Handle owner/repo format
    const parts = githubRepo.split('/');
    if (parts.length >= 2) {
      return {
        owner: parts[0],
        name: parts[1],
        branch: 'main', // Default branch
      };
    }
    throw new Error(`Invalid GitHub repository format: ${githubRepo}`);
  }

  /**
   * Validate GitHub token
   */
  static async validateToken(): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('https://api.github.com/user', { headers });
      return response.ok;
    } catch (error) {
      logger.error('Failed to validate GitHub token:', error);
      return false;
    }
  }

  /**
   * Get user repositories
   */
  static async getUserRepos(): Promise<any[]> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch repositories: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Failed to fetch user repositories:', error);
      toast.error('Failed to fetch GitHub repositories');
      throw error;
    }
  }

  /**
   * Get repository branches
   */
  static async getBranches(repo: GitHubRepo): Promise<GitHubBranch[]> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.name}/branches`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch branches: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Failed to fetch repository branches:', error);
      toast.error('Failed to fetch repository branches');
      throw error;
    }
  }

  /**
   * Create a new repository
   */
  static async createRepo(options: GitHubCreateRepoOptions): Promise<any> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: options.name,
          description: options.description || '',
          private: options.private || false,
          auto_init: options.auto_init || true,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to create repository: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Failed to create repository:', error);
      toast.error('Failed to create GitHub repository');
      throw error;
    }
  }

  /**
   * Fetch repository files
   */
  static async fetchRepoFiles(repo: GitHubRepo): Promise<{ [path: string]: string }> {
    const { owner, name, branch = 'main' } = repo;
    const headers = this.getAuthHeaders();
    
    try {
      // First, get the branch reference to get the SHA
      const branchResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/branches/${branch}`,
        { headers }
      );
      
      if (!branchResponse.ok) {
        if (branchResponse.status === 404) {
          throw new Error(`Branch '${branch}' not found in repository ${owner}/${name}`);
        }
        throw new Error(`Failed to fetch branch: ${branchResponse.statusText}`);
      }
      
      const branchData = await branchResponse.json() as { commit: { sha: string } };
      const treeSha = branchData.commit.sha;
      
      // Now get the repository tree using the SHA
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/git/trees/${treeSha}?recursive=1`,
        { headers }
      );
      
      if (!treeResponse.ok) {
        if (treeResponse.status === 404) {
          throw new Error(`Repository ${owner}/${name} not found or you don't have access`);
        }
        throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
      }
      
      const treeData = await treeResponse.json() as { tree: Array<{ type: string; path: string }> };
      const files: { [path: string]: string } = {};
      
      // Filter for files (not directories) and common file types
      const fileNodes = treeData.tree.filter((item) => 
        item.type === 'blob' && 
        !item.path.includes('node_modules/') &&
        !item.path.startsWith('.git/') &&
        this.isTextFile(item.path)
      );
      
      // Fetch content for each file
      for (const fileNode of fileNodes) {
        try {
          const fileResponse = await fetch(
            `https://api.github.com/repos/${owner}/${name}/contents/${fileNode.path}?ref=${branch}`,
            { headers }
          );
          
          if (fileResponse.ok) {
            const fileData = await fileResponse.json() as { content?: string; encoding?: string };
            if (fileData.content && fileData.encoding === 'base64') {
              const content = atob(fileData.content);
              files[fileNode.path] = content;
            }
          }
        } catch (error) {
          logger.warn(`Failed to fetch file ${fileNode.path}:`, error);
          // Continue with other files
        }
      }
      
      return files;
    } catch (error) {
      logger.error('Error fetching GitHub repository:', error);
      throw error;
    }
  }

  /**
   * Push files to GitHub repository
   */
  static async pushFiles(
    repo: GitHubRepo, 
    files: { [path: string]: string }, 
    commitMessage: string
  ): Promise<GitHubCommit> {
    try {
      const headers = this.getAuthHeaders();
      const { owner, name, branch = 'main' } = repo;
      
      // Get the current tree SHA
      const branchResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/branches/${branch}`,
        { headers }
      );
      
      if (!branchResponse.ok) {
        throw new Error(`Failed to get branch: ${branchResponse.statusText}`);
      }
      
      const branchData = await branchResponse.json() as { commit: { sha: string } };
      const baseTreeSha = branchData.commit.sha;
      
      // Create blobs for all files
      const blobs: { [path: string]: { sha: string; url: string } } = {};
      
      for (const [path, content] of Object.entries(files)) {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${owner}/${name}/git/blobs`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              content: btoa(content),
              encoding: 'base64',
            }),
          }
        );
        
        if (!blobResponse.ok) {
          throw new Error(`Failed to create blob for ${path}: ${blobResponse.statusText}`);
        }
        
        blobs[path] = await blobResponse.json();
      }
      
      // Create tree
      const treeEntries = Object.entries(blobs).map(([path, blob]) => ({
        path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      }));
      
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/git/trees`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeEntries,
          }),
        }
      );
      
      if (!treeResponse.ok) {
        throw new Error(`Failed to create tree: ${treeResponse.statusText}`);
      }
      
      const treeData = await treeResponse.json() as { sha: string };
      
      // Create commit
      const commitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/git/commits`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: commitMessage,
            tree: treeData.sha,
            parents: [baseTreeSha],
          }),
        }
      );
      
      if (!commitResponse.ok) {
        throw new Error(`Failed to create commit: ${commitResponse.statusText}`);
      }
      
      const commitData = await commitResponse.json() as GitHubCommit;
      
      // Update branch reference
      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/git/refs/heads/${branch}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            sha: commitData.sha,
          }),
        }
      );
      
      if (!refResponse.ok) {
        throw new Error(`Failed to update branch reference: ${refResponse.statusText}`);
      }
      
      return commitData;
    } catch (error) {
      logger.error('Failed to push files to GitHub:', error);
      toast.error('Failed to push files to GitHub');
      throw error;
    }
  }

  /**
   * Check if a file is a text file based on extension
   */
  private static isTextFile(path: string): boolean {
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.yaml', '.yml',
      '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb',
      '.go', '.rs', '.swift', '.kt', '.scala', '.clj', '.hs', '.elm',
      '.sql', '.xml', '.svg', '.gitignore', '.env.example', '.dockerignore'
    ];
    
    const fileName = path.toLowerCase();
    
    // Check for specific filenames
    const textFiles = [
      'readme', 'license', 'changelog', 'contributing', 'dockerfile',
      'makefile', 'package.json', 'tsconfig.json', 'webpack.config.js',
      'vite.config.js', 'next.config.js', 'tailwind.config.js'
    ];
    
    if (textFiles.some(file => fileName.includes(file))) {
      return true;
    }
    
    // Check file extensions
    return textExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * Generate template prompt for GitHub repository
   */
  static generateTemplatePrompt(template: { label: string; githubRepo: string; description: string }): string {
    return `Create a new project based on the ${template.label} template. 

Repository: ${template.githubRepo}
Description: ${template.description}

Please:
1. Fetch the template files from the GitHub repository
2. Set up the project structure 
3. Install dependencies if there's a package.json
4. Provide any setup instructions needed

Start by creating the basic project structure based on the template.`;
  }
} 