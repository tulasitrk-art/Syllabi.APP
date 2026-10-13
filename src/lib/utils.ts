import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export const SUBJECT_METADATA = {
  DEVC: {
    code: 'DEVC',
    name: 'Development & Cloud',
    description: 'DevOps, Cloud Architectures & Deployment Pipelines',
    badgeClass: 'border-white/20 bg-white/5 text-white',
  },
  ADS: {
    code: 'ADS',
    name: 'Advanced Data Structures',
    description: 'Trees, Graphs, Geometric Algorithms & Flow Networks',
    badgeClass: 'border-white/20 bg-white/5 text-white',
  },
  AI: {
    code: 'AI',
    name: 'Artificial Intelligence',
    description: 'Heuristics, Neural Architectures & Reasoning Systems',
    badgeClass: 'border-white/20 bg-white/5 text-white',
  },
  UHV: {
    code: 'UHV',
    name: 'Universal Human Values',
    description: 'Ethics, Societal Impact & Holistic Professionalism',
    badgeClass: 'border-white/20 bg-white/5 text-white',
  },
  JAVA: {
    code: 'JAVA',
    name: 'Enterprise Java Systems',
    description: 'JVM Internals, Concurrency & Microservices Architecture',
    badgeClass: 'border-white/20 bg-white/5 text-white',
  },
} as const;

export const STATUS_CONFIG = {
  UNREAD: {
    label: 'Unread',
    badge: 'border-white/10 bg-white/5 text-white/50',
    indicator: 'bg-white/30',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badge: 'border-white/20 bg-white/10 text-white/90',
    indicator: 'bg-white',
  },
  READ: {
    label: 'Completed',
    badge: 'border-white/30 bg-white/15 text-white',
    indicator: 'bg-white',
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    badge: 'border-white/40 bg-white/10 text-white underline decoration-white/40',
    indicator: 'bg-white/80',
  },
} as const;
