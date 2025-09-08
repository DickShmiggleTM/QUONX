import React from 'react';

// A generic icon wrapper with shape-rendering for a crisp, pixelated look
const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" shapeRendering="crispEdges" {...props}>
        {props.children}
    </svg>
);

export const FileIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M6 2h10l4 4v14H6V2zm8 0v4h4L14 2zM8 9h8v2H8V9zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" /></Icon>
);

export const FolderIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M2 4h8l2 2h10v14H2V4zm2 2v10h16V8h-9l-2-2H4z" /></Icon>
);

export const SendIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M2 21L23 12 2 3v7l15 2-15 2v7z" /></Icon>
);

export const ThinkingIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
     <Icon {...props}><path d="M12 2a10 10 0 1010 10H12V2z" /></Icon>
);

export const PluginsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M16 3h-2V2h-4v1H8v1H5v3h1v1h1v1h1v1h2v-1h1v-1h1V8h1V7h1V4h-3V3zM9 8H7V6h2v2zm8 0h-2V6h2v2zm-2 5v-1h-1v-1h-2v1h-1v1h-1v1H9v1h1v1h2v-1h1v-1h2v-1h1v-1h-1zm-4 1h2v-1h-2v1z" /></Icon>
);

export const GitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
     <Icon {...props}><path d="M21.5 12a9.5 9.5 0 11-19 0 9.5 9.5 0 0119 0zM12 6a2 2 0 100 4 2 2 0 000-4zm-4 6a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-4-1l-3 3h2v4h2v-4h2l-3-3z" /></Icon>
);

export const ModifiedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 7h2v6h-2z" /></Icon>
);

export const UntrackedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" /></Icon>
);

export const ConflictIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 2l-2 4h4L12 2zM2 12l4-2v4L2 12zm20 0l-4-2v4l4-2zM12 22l2-4h-4l2 4zM9 9v6h2V9H9zm4 0v6h2V9h-2z" /></Icon>
);

export const BranchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 4a2 2 0 11-4 0 2 2 0 014 0zm0 16a2 2 0 11-4 0 2 2 0 014 0zm0-10a2 2 0 11-4 0 2 2 0 014 0zM10 7v10h8V7h-8z" /></Icon>
);

export const PushIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M11 16h2V7h3l-4-4-4 4h3v9zM4 18h16v2H4v-2z" /></Icon>
);

export const PullIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M11 8h2v9h3l-4 4-4-4h3V8zM4 4h16v2H4V4z" /></Icon>
);

export const UndoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C20.36 11.23 16.79 8 12.5 8z" /></Icon>
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M5 5h2v2H5V5zm4 4h2v2H9V9zm4 4h2v2h-2v-2zM5 17h2v2H5v-2zm12-8h2v2h-2V9zM9 5h2v2H9V5zm4 12h2v2h-2v-2zm4-8h2v2h-2V9zM7 9H5v2h2V9zm8 4h-2v2h2v-2zm-4-4h-2v2h2V9zM9 17v-2H7v2h2zm4-4v-2h-2v2h2z" /></Icon>
);

export const ClipboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M6 4h12v16H6V4zm2 2v2h8V6H8zm0 4v2h8v-2H8zm0 4v2h5v-2H8z" /></Icon>
);

export const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></Icon>
);

export const BugIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
     <Icon {...props}><path d="M14 12h-4v-2h4v2zm2-4H8v2h8V8zm-2 6v2h2v-2h-2zm-4 0v2h2v-2h-2zm6-10H8C6.9 4 6 4.9 6 6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" /></Icon>
);

export const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M8 5v14l11-7L8 5z" /></Icon>
);

export const PauseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Icon>
);

export const StepOverIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M4 18h16v-2H4v2zM13 5c-3.87 0-7 3.13-7 7h2c0-2.76 2.24-5 5-5s5 2.24 5 5h2c0-3.87-3.13-7-7-7z" /></Icon>
);

export const StepIntoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 2L2 12h7v10h6V12h7L12 2z" /></Icon>
);

export const StepOutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 22L22 12h-7V2H9v10H2l10 10z" /></Icon>
);

export const SearchIndexIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></Icon>
);

export const SwarmIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M7 2v4h4V2H7zm8 0v4h4V2h-4zM7 10v4h4v-4H7zm8 0v4h4v-4h-4zM7 18v4h4v-4H7zm8 0v4h4v-4h-4z" /></Icon>
);

export const MemoryIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Icon {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 12c-2.76 0-5-2.24-5-5h2c0 1.65 1.35 3 3 3s3-1.35 3-3h2c0 2.76-2.24 5-5 5z" /></Icon>
);
