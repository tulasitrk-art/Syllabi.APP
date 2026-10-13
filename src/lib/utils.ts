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

export interface SyllabusSection {
  unit: number;
  title: string;
  topics: string[];
}

export interface SubjectDetail {
  code: 'DEVC' | 'ADS' | 'AI' | 'UHV' | 'JAVA';
  name: string;
  description: string;
  badgeClass: string;
  sections: SyllabusSection[];
}

export const SUBJECT_METADATA: Record<'DEVC' | 'ADS' | 'AI' | 'UHV' | 'JAVA', SubjectDetail> = {
  AI: {
    code: 'AI',
    name: 'Artificial Intelligence',
    description: 'Heuristics, Neural Architectures, Logic & Reasoning Systems',
    badgeClass: 'border-white/20 bg-white/5 text-white',
    sections: [
      {
        unit: 1,
        title: 'Problem Solving & Heuristic Search',
        topics: ['State Space Search', 'A* Algorithm', 'IDA*', 'Admissibility & Monotonicity', 'Branch & Bound'],
      },
      {
        unit: 2,
        title: 'Knowledge Representation & Logic',
        topics: ['Propositional Logic', 'First-Order Predicate Logic', 'Resolution Refutation', 'Forward & Backward Chaining'],
      },
      {
        unit: 3,
        title: 'Adversarial Search & Games',
        topics: ['Minimax Search', 'Alpha-Beta Pruning', 'Evaluation Functions', 'Stochastic Games'],
      },
      {
        unit: 4,
        title: 'Uncertainty & Probabilistic Reasoning',
        topics: ['Bayesian Networks', 'Exact Inference', 'Hidden Markov Models', 'Decision Networks'],
      },
      {
        unit: 5,
        title: 'Machine Learning & Neural Architectures',
        topics: ['Supervised Learning', 'Decision Trees', 'Perceptrons & Backpropagation', 'Deep Learning Foundations'],
      },
    ],
  },
  ADS: {
    code: 'ADS',
    name: 'Advanced Data Structures',
    description: 'Self-Balancing Trees, Graph Flows, Geometric Algorithms & Amortized Analysis',
    badgeClass: 'border-white/20 bg-white/5 text-white',
    sections: [
      {
        unit: 1,
        title: 'Self-Balancing & Multi-way Trees',
        topics: ['AVL Trees', 'Red-Black Trees', '2-3-4 Trees', 'B-Trees & B+ Trees', 'Rotations & Invariants'],
      },
      {
        unit: 2,
        title: 'Graph Theory & Network Flows',
        topics: ['Max-Flow Min-Cut', 'Ford-Fulkerson Algorithm', 'Edmonds-Karp', 'Push-Relabel Algorithm'],
      },
      {
        unit: 3,
        title: 'Heaps & Amortized Structures',
        topics: ['Fibonacci Heaps', 'Binomial Heaps', 'Splay Trees', 'Aggregate & Potential Method'],
      },
      {
        unit: 4,
        title: 'Spatial, Geometric & String Structures',
        topics: ['Segment Trees', 'Range Trees', 'KD-Trees', 'Tries & Suffix Automata', 'Aho-Corasick'],
      },
      {
        unit: 5,
        title: 'NP-Completeness & Approximations',
        topics: ['Polynomial Reductions', 'Vertex Cover', 'Traveling Salesperson', 'Knapsack Approximations'],
      },
    ],
  },
  DEVC: {
    code: 'DEVC',
    name: 'Development & Cloud',
    description: 'DevOps Pipelines, Containerization, Kubernetes Pod Networking & Cloud Infra',
    badgeClass: 'border-white/20 bg-white/5 text-white',
    sections: [
      {
        unit: 1,
        title: 'DevOps Foundations & CI/CD Pipelines',
        topics: ['Git Workflows', 'Continuous Integration', 'Automated Testing', 'Artifact Registry & Release Cycles'],
      },
      {
        unit: 2,
        title: 'Containerization & Docker Architecture',
        topics: ['Docker Engine Internals', 'Dockerfile Multi-stage Builds', 'Docker Compose', 'Container Security'],
      },
      {
        unit: 3,
        title: 'Kubernetes & Pod Networking',
        topics: ['Pods, Deployments & ReplicaSets', 'CNI Plugins (Calico/Flannel)', 'Services & Ingress Controllers', 'ConfigMaps & Secrets'],
      },
      {
        unit: 4,
        title: 'Cloud Infrastructure & Microservices',
        topics: ['Infrastructure as Code (Terraform)', 'API Gateways', 'Service Mesh (Istio)', 'Zero-Trust Architecture'],
      },
      {
        unit: 5,
        title: 'Observability & Site Reliability',
        topics: ['Prometheus & Metrics Collection', 'Grafana Dashboards', 'Distributed Tracing (OpenTelemetry)', 'SRE Principles & SLOs'],
      },
    ],
  },
  JAVA: {
    code: 'JAVA',
    name: 'Enterprise Java Systems',
    description: 'JVM Internals, Memory Model, Virtual Threads & Microservices Architecture',
    badgeClass: 'border-white/20 bg-white/5 text-white',
    sections: [
      {
        unit: 1,
        title: 'Advanced Language & Generics',
        topics: ['Generics & Type Erasure', 'Functional Interfaces', 'Streams API & Collectors', 'Reflection & Annotations'],
      },
      {
        unit: 2,
        title: 'JVM Architecture & Memory Model',
        topics: ['ClassLoader Mechanics', 'Heap & Stack Architecture', 'Garbage Collectors (ZGC/G1)', 'Java Memory Model (JMM)'],
      },
      {
        unit: 3,
        title: 'Concurrency & Virtual Threads',
        topics: ['Project Loom & Virtual Threads', 'Executors & ThreadPools', 'ForkJoin Framework', 'Locks & Synchronization'],
      },
      {
        unit: 4,
        title: 'Enterprise Spring Ecosystem',
        topics: ['Spring Boot 3 Core', 'Dependency Injection & AOP', 'Spring Data JPA & Hibernate', 'Transaction Management'],
      },
      {
        unit: 5,
        title: 'Microservices & Event-Driven Systems',
        topics: ['REST APIs & OpenAPI Spec', 'gRPC & Protocol Buffers', 'Apache Kafka Messaging', 'Resilience4j Circuit Breakers'],
      },
    ],
  },
  UHV: {
    code: 'UHV',
    name: 'Universal Human Values',
    description: 'Ethics, Societal Harmony, Nature Co-existence & Holistic Professionalism',
    badgeClass: 'border-white/20 bg-white/5 text-white',
    sections: [
      {
        unit: 1,
        title: 'Introduction to Self-Exploration',
        topics: ['Process of Self-Exploration', 'Continuous Happiness & Prosperity', 'Natural Acceptance', 'Experiential Validation'],
      },
      {
        unit: 2,
        title: 'Harmony in the Human Being',
        topics: ['Co-existence of Self (I) & Body', 'Harmony in Self Activities', 'Sanyam (Self-Control)', 'Swasthya (Health)'],
      },
      {
        unit: 3,
        title: 'Harmony in the Family & Society',
        topics: ['Trust (Vishwas) & Respect (Samman)', 'Nine Foundational Values', 'Nyaya (Justice)', 'Undivided Society (Akhand Samaj)'],
      },
      {
        unit: 4,
        title: 'Harmony in Nature & Existence',
        topics: ['Four Orders of Nature', 'Interconnectedness & Mutual Fulfillment', 'Existence as Co-existence (Sah-astitva)'],
      },
      {
        unit: 5,
        title: 'Holistic Professional Ethics',
        topics: ['Value-based Competence', 'Humanistic Constitution', 'Vision for Holistic Technologies', 'Universal Human Order'],
      },
    ],
  },
};

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
