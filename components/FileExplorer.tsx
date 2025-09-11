import React from 'react';

interface ProjectFile {
  path: string;
  name: string;
  isDirectory: boolean;
}

interface FileExplorerProps {
  files: ProjectFile[];
  onFileSelect: (path: string) => void;
  currentFile: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  currentFile
}) => {
  const getFileIcon = (file: ProjectFile) => {
    if (file.isDirectory) {
      return '📁';
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'tsx':
      case 'ts':
        return '🔷';
      case 'jsx':
      case 'js':
        return '🟨';
      case 'py':
        return '🐍';
      case 'rs':
        return '🦀';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      default:
        return '📄';
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    // Directories first, then files
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h3>PROJECT FILES</h3>
      </div>
      <div className="file-list">
        {sortedFiles.map((file) => (
          <div
            key={file.path}
            className={`file-item ${currentFile === file.path ? 'selected' : ''}`}
            onClick={() => onFileSelect(file.path)}
          >
            <span className="file-icon">{getFileIcon(file)}</span>
            <span className="file-name">{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};