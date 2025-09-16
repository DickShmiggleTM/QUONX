import React from 'react';

/**
 * @interface ProjectFile
 * @description Represents a file or directory in the project.
 * @property {string} path - The full path to the file or directory.
 * @property {string} name - The name of the file or directory.
 * @property {boolean} isDirectory - Whether the item is a directory.
 */
interface ProjectFile {
  path: string;
  name: string;
  isDirectory: boolean;
}

/**
 * @interface FileExplorerProps
 * @description Props for the FileExplorer component.
 * @property {ProjectFile[]} files - The list of files and directories in the project.
 * @property {(path: string) => void} onFileSelect - Function to handle file selection.
 * @property {string | null} currentFile - The path of the currently selected file.
 */
interface FileExplorerProps {
  files: ProjectFile[];
  onFileSelect: (path: string) => void;
  currentFile: string | null;
}

/**
 * @function FileExplorer
 * @description A component that displays a list of files and directories in the project.
 * @param {FileExplorerProps} props - The props for the component.
 * @returns {JSX.Element} The rendered FileExplorer component.
 */
export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  currentFile
}) => {
  /**
   * @function getFileIcon
   * @description Gets the appropriate icon for a file based on its extension.
   * @param {ProjectFile} file - The file to get the icon for.
   * @returns {string} The icon for the file.
   */
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