import { settingsStore } from '~/lib/stores/settings';

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

export function parseGitHubRepo(githubRepo: string): GitHubRepo {
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

export function getGitHubToken(): string {
  return settingsStore.getServiceToken('github');
}

function getAuthHeaders(): Record<string, string> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('GitHub token not set. Please add it in settings.');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

export async function fetchGitHubRepoFiles(repo: GitHubRepo): Promise<{ [path: string]: string }> {
  const { owner, name, branch = 'main' } = repo;
  const headers = getAuthHeaders();
  
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
      isTextFile(item.path)
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
        console.warn(`Failed to fetch file ${fileNode.path}:`, error);
        // Continue with other files
      }
    }
    
    return files;
  } catch (error) {
    console.error('Error fetching GitHub repository:', error);
    throw error;
  }
}

function isTextFile(path: string): boolean {
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

export function generateTemplatePrompt(template: { label: string; githubRepo: string; description: string }): string {
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

// Repository Management Functions
export async function createGitHubRepo(options: GitHubCreateRepoOptions): Promise<any> {
  const headers = getAuthHeaders();
  
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: options.name,
      description: options.description || '',
      private: options.private || false,
      auto_init: options.auto_init || false,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create repository: ${error.message || response.statusText}`);
  }
  
  return await response.json();
}

export async function getGitHubRepo(repo: GitHubRepo): Promise<any> {
  const { owner, name } = repo;
  const headers = getAuthHeaders();
  
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Repository not found: ${owner}/${name}`);
  }
  
  return await response.json();
}

export async function getGitHubBranches(repo: GitHubRepo): Promise<GitHubBranch[]> {
  const { owner, name } = repo;
  const headers = getAuthHeaders();
  
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/branches`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch branches: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function createGitHubBranch(repo: GitHubRepo, branchName: string, fromBranch = 'main'): Promise<any> {
  const { owner, name } = repo;
  const headers = getAuthHeaders();
  
  // First get the SHA of the source branch
  const refResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${fromBranch}`, {
    headers,
  });
  
  if (!refResponse.ok) {
    throw new Error(`Source branch '${fromBranch}' not found`);
  }
  
  const refData = await refResponse.json();
  const sha = refData.object.sha;
  
  // Create the new branch
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: sha,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create branch: ${error.message || response.statusText}`);
  }
  
  return await response.json();
}

export async function pushFilesToGitHub(
  repo: GitHubRepo, 
  files: { [path: string]: string }, 
  commitMessage: string
): Promise<GitHubCommit> {
  const { owner, name, branch = 'main' } = repo;
  const headers = getAuthHeaders();
  
  try {
    // Get the current branch reference
    const refResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${branch}`, {
      headers,
    });
    
    if (!refResponse.ok) {
      throw new Error(`Branch '${branch}' not found`);
    }
    
    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;
    
    // Get the latest commit to get the tree SHA
    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits/${latestCommitSha}`, {
      headers,
    });
    
    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;
    
    // Create blobs for all files
    const blobs: { [path: string]: string } = {};
    for (const [path, content] of Object.entries(files)) {
      const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: btoa(unescape(encodeURIComponent(content))), // Convert to base64
          encoding: 'base64',
        }),
      });
      
      if (!blobResponse.ok) {
        throw new Error(`Failed to create blob for ${path}`);
      }
      
      const blobData = await blobResponse.json();
      blobs[path] = blobData.sha;
    }
    
    // Create a new tree
    const treeData = Object.entries(blobs).map(([path, sha]) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha,
    }));
    
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeData,
      }),
    });
    
    if (!treeResponse.ok) {
      throw new Error('Failed to create tree');
    }
    
    const newTreeData = await treeResponse.json();
    
    // Create a new commit
    const newCommitResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeData.sha,
        parents: [latestCommitSha],
      }),
    });
    
    if (!newCommitResponse.ok) {
      throw new Error('Failed to create commit');
    }
    
    const newCommitData = await newCommitResponse.json();
    
    // Update the branch reference
    const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
      }),
    });
    
    if (!updateRefResponse.ok) {
      throw new Error('Failed to update branch reference');
    }
    
    return newCommitData;
  } catch (error) {
    console.error('Error pushing files to GitHub:', error);
    throw error;
  }
}

export async function forkGitHubRepo(repo: GitHubRepo): Promise<any> {
  const { owner, name } = repo;
  const headers = getAuthHeaders();
  
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/forks`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fork repository: ${error.message || response.statusText}`);
  }
  
  return await response.json();
}

export async function getUserRepos(): Promise<any[]> {
  const headers = getAuthHeaders();
  
  const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user repositories: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function getGitHubUser(): Promise<any> {
  const headers = getAuthHeaders();
  
  const response = await fetch('https://api.github.com/user', {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }
  
  return await response.json();
}

// Utility function to check if GitHub token is valid
export async function validateGitHubToken(): Promise<boolean> {
  try {
    await getGitHubUser();
    return true;
  } catch {
    return false;
  }
}
