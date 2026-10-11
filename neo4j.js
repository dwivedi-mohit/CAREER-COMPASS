const neo4j = require('neo4j-driver');

/**
 * Neo4j Graph Database Service for Pathway Career Navigator & Skill Gap Agent
 *
 * Graph Schema:
 *   (:Person {id, name, email, createdAt})
 *   (:JobRole {id, name, title, description, category})
 *   (:Skill {id, name, category, description, difficulty})
 *   (:LearningResource {id, title, type, url, provider, duration})
 *
 * Relationships:
 *   (:Person)-[:HAS_SKILL {proficiency: 'beginner'|'intermediate'|'advanced', verified: boolean}]->(:Skill)
 *   (:Person)-[:TARGETS {targetDate: string}]->(:JobRole)
 *   (:JobRole)-[:REQUIRES {importance: 'core'|'recommended'|'optional', minProficiency: string}]->(:Skill)
 *   (:Skill)-[:DEPENDS_ON {reason: string}]->(:Skill)
 *   (:Skill)-[:TAUGHT_BY {rating: float}]->(:LearningResource)
 */

let driver = null;
let connectionStatus = {
    isConnected: false,
    mode: 'demo',
    uri: null,
    database: 'neo4j',
    error: null
};

// Seed catalog used for both live Neo4j population and Demo In-Memory Graph
const SEED_CATALOG = {
    roles: [
        {
            id: 'java-backend-developer',
            name: 'Java Backend Developer',
            title: 'Java Backend Developer',
            category: 'Backend',
            description: 'Designs, builds, and maintains scalable server-side systems, microservices, and enterprise APIs using Java, Spring Boot, and relational databases.'
        },
        {
            id: 'frontend-developer',
            name: 'Frontend Developer',
            title: 'Frontend Developer',
            category: 'Frontend',
            description: 'Constructs responsive, high-performance web applications using modern JavaScript/TypeScript, React, Next.js, and CSS design systems.'
        },
        {
            id: 'data-analyst',
            name: 'Data Analyst',
            title: 'Data Analyst',
            category: 'Data',
            description: 'Transforms raw data into actionable business intelligence using SQL, Python, Pandas, statistical modeling, and interactive dashboards.'
        },
        {
            id: 'ai-engineer',
            name: 'AI Engineer',
            title: 'AI Engineer',
            category: 'AI / Machine Learning',
            description: 'Develops and deploys machine learning models, transformer architectures, LLM pipelines, RAG systems, and neural networks.'
        },
        {
            id: 'devops-engineer',
            name: 'DevOps Engineer',
            title: 'DevOps Engineer',
            category: 'Infrastructure',
            description: 'Automates deployment pipelines, cloud infrastructure, container orchestration, and observability platforms.'
        },
        {
            id: 'full-stack-developer',
            name: 'Full Stack Developer',
            title: 'Full Stack Developer',
            category: 'Full Stack',
            description: 'Masters end-to-end web architecture across frontend interfaces, backend APIs, relational & document databases, and cloud hosting.'
        }
    ],

    skills: [
        // Java Backend Skills
        { id: 'oop-basics', name: 'Object-Oriented Programming (OOP)', category: 'Fundamentals', difficulty: 'Beginner', description: 'Core principles of encapsulation, inheritance, polymorphism, and abstraction.' },
        { id: 'java-core', name: 'Java Core & Modern Syntax', category: 'Language', difficulty: 'Intermediate', description: 'Java 17/21 features, collections framework, generics, streams, and concurrency.' },
        { id: 'sql-db', name: 'SQL & Relational Databases', category: 'Databases', difficulty: 'Intermediate', description: 'Relational data modeling, indexing, joins, transactions, and ACID properties.' },
        { id: 'spring-boot', name: 'Spring Boot 3', category: 'Frameworks', difficulty: 'Intermediate', description: 'Enterprise Java framework for production-grade microservices and REST APIs.' },
        { id: 'rest-apis', name: 'RESTful API Architecture', category: 'APIs', difficulty: 'Intermediate', description: 'HTTP verbs, status codes, OpenAPI/Swagger specifications, and idempotent endpoints.' },
        { id: 'hibernate-jpa', name: 'Hibernate & Spring Data JPA', category: 'Databases', difficulty: 'Intermediate', description: 'ORM mapping, query optimization, caching levels, and entity lifecycle management.' },
        { id: 'microservices', name: 'Microservices Architecture', category: 'Architecture', difficulty: 'Advanced', description: 'Distributed systems, service discovery, API gateways, resilience, and circuit breakers.' },
        { id: 'kafka-messaging', name: 'Apache Kafka & Event Streaming', category: 'Messaging', difficulty: 'Advanced', description: 'Event-driven architecture, consumer groups, partition strategies, and fault tolerance.' },
        { id: 'docker-containers', name: 'Docker & Containerization', category: 'DevOps', difficulty: 'Intermediate', description: 'Container image building, multi-stage builds, networking, and docker-compose.' },
        { id: 'system-design', name: 'System Design & Scalability', category: 'Architecture', difficulty: 'Advanced', description: 'Horizontal scaling, Redis caching, load balancing, and database partitioning.' },

        // Frontend Skills
        { id: 'html-css', name: 'Modern HTML5 & Semantic CSS', category: 'Fundamentals', difficulty: 'Beginner', description: 'Semantic elements, responsive layout, CSS Grid, Flexbox, and accessibility (a11y).' },
        { id: 'javascript-es6', name: 'JavaScript (ES6+)', category: 'Language', difficulty: 'Intermediate', description: 'Closures, event loop, Promises, async/await, DOM APIs, and module systems.' },
        { id: 'typescript', name: 'TypeScript', category: 'Language', difficulty: 'Intermediate', description: 'Static typing, interfaces, generics, union types, and compiler configuration.' },
        { id: 'react-core', name: 'React 19 & Component Architecture', category: 'Frameworks', difficulty: 'Intermediate', description: 'Hooks, virtual DOM, component lifecycles, props, state, and custom hooks.' },
        { id: 'tailwind-css', name: 'Tailwind CSS & UI Systems', category: 'Styling', difficulty: 'Beginner', description: 'Utility-first styling, design tokens, responsiveness, and component design.' },
        { id: 'state-management', name: 'State Management (Zustand / Redux)', category: 'State', difficulty: 'Intermediate', description: 'Global state patterns, immutability, selectors, and side effect handling.' },
        { id: 'nextjs', name: 'Next.js & React Server Components', category: 'Frameworks', difficulty: 'Advanced', description: 'App router, SSR, SSG, server actions, route handlers, and streaming UI.' },
        { id: 'frontend-testing', name: 'Frontend Testing (Vitest & Playwright)', category: 'Testing', difficulty: 'Intermediate', description: 'Unit testing components, end-to-end browser automation, and integration tests.' },
        { id: 'web-performance', name: 'Web Performance & Core Web Vitals', category: 'Performance', difficulty: 'Advanced', description: 'LCP, INP, CLS optimization, bundle splitting, lazy loading, and asset caching.' },

        // Data Analyst Skills
        { id: 'excel-advanced', name: 'Advanced Excel & Spreadsheets', category: 'Fundamentals', difficulty: 'Beginner', description: 'VLOOKUP/XLOOKUP, pivot tables, data cleaning, and statistical functions.' },
        { id: 'python-data', name: 'Python for Data Analysis', category: 'Language', difficulty: 'Beginner', description: 'Python programming syntax, data structures, and script automation.' },
        { id: 'pandas-numpy', name: 'Pandas & NumPy', category: 'Data Analysis', difficulty: 'Intermediate', description: 'DataFrames, series, indexing, data transformations, handling missing data, and arrays.' },
        { id: 'data-viz', name: 'Data Visualization (Tableau & Power BI)', category: 'Visualization', difficulty: 'Intermediate', description: 'Interactive dashboard creation, storytelling with charts, and KPI modeling.' },
        { id: 'applied-stats', name: 'Applied Statistics & Probability', category: 'Math', difficulty: 'Intermediate', description: 'Hypothesis testing, A/B testing, regression analysis, and variance metrics.' },
        { id: 'eda-matplotlib', name: 'Exploratory Data Analysis (Matplotlib / Seaborn)', category: 'Visualization', difficulty: 'Intermediate', description: 'Distribution plots, correlation heatmaps, feature relations, and anomaly discovery.' },
        { id: 'data-warehousing', name: 'Data Warehousing & ETL (Snowflake / BigQuery)', category: 'Databases', difficulty: 'Advanced', description: 'Star schema, dimensional modeling, transformation pipelines, and analytical querying.' },

        // AI Engineer Skills
        { id: 'math-for-ai', name: 'Linear Algebra & Multivariable Calculus', category: 'Math', difficulty: 'Intermediate', description: 'Matrices, vectors, eigenvalues, gradient descent, and partial derivatives.' },
        { id: 'scikit-learn', name: 'Classical Machine Learning (Scikit-Learn)', category: 'Machine Learning', difficulty: 'Intermediate', description: 'Supervised/unsupervised algorithms, cross-validation, feature engineering, and metrics.' },
        { id: 'deep-learning', name: 'Deep Learning & Neural Architectures', category: 'Deep Learning', difficulty: 'Advanced', description: 'CNNs, RNNs, backpropagation, activation functions, and regularization.' },
        { id: 'pytorch', name: 'PyTorch Framework', category: 'Deep Learning', difficulty: 'Advanced', description: 'Tensors, autograd, model definitions, training loops, GPU acceleration, and DataLoader.' },
        { id: 'transformers', name: 'Transformers & Hugging Face', category: 'NLP', difficulty: 'Advanced', description: 'Attention mechanisms, BERT, GPT architectures, tokenizers, and model fine-tuning.' },
        { id: 'rag-vector-db', name: 'Vector Databases & RAG Architecture', category: 'GenAI', difficulty: 'Advanced', description: 'Embeddings, cosine similarity, ChromaDB/Pinecone, hybrid search, and context retrieval.' },
        { id: 'llm-agents', name: 'LLM Agents & Tool Calling (LangChain / LlamaIndex)', category: 'GenAI', difficulty: 'Advanced', description: 'Agent loops, function calling, memory, evaluation, and prompt optimization.' },
        { id: 'mlops-deployment', name: 'MLOps, Model Serving & Triton', category: 'MLOps', difficulty: 'Advanced', description: 'FastAPI model endpoints, ONNX runtime, model monitoring, and latency tuning.' },

        // DevOps & Infrastructure Skills
        { id: 'linux-shell', name: 'Linux Administration & Bash Scripting', category: 'OS', difficulty: 'Beginner', description: 'Shell scripting, process management, permissions, and network troubleshooting.' },
        { id: 'git-cicd', name: 'Git & CI/CD Pipelines (GitHub Actions)', category: 'DevOps', difficulty: 'Intermediate', description: 'Version control, automated build/test workflows, semantic versioning, and release pipelines.' },
        { id: 'kubernetes', name: 'Kubernetes (K8s) Orchestration', category: 'DevOps', difficulty: 'Advanced', description: 'Pods, deployments, services, ingress controllers, ConfigMaps, and Helm charts.' },
        { id: 'terraform-iac', name: 'Infrastructure as Code (Terraform)', category: 'Cloud', difficulty: 'Intermediate', description: 'Declarative cloud provisioning, state management, modules, and providers.' },
        { id: 'cloud-aws', name: 'Cloud Architecture (AWS / GCP)', category: 'Cloud', difficulty: 'Intermediate', description: 'Compute instances, VPC networking, IAM security, S3 storage, and serverless.' },
        { id: 'observability', name: 'Observability (Prometheus, Grafana, OpenTelemetry)', category: 'Monitoring', difficulty: 'Intermediate', description: 'Metrics collection, distributed tracing, alerting, and dashboard instrumentation.' }
    ],

    // Prerequisites between skills: Skill DEPENDS_ON Skill
    dependencies: [
        // Java Path
        { skill: 'Java Core & Modern Syntax', dependsOn: 'Object-Oriented Programming (OOP)', reason: 'OOP concepts are essential before understanding Java class hierarchies and inheritance.' },
        { skill: 'Spring Boot 3', dependsOn: 'Java Core & Modern Syntax', reason: 'Spring Boot requires a strong grasp of Java generics, annotations, and reflection.' },
        { skill: 'RESTful API Architecture', dependsOn: 'Spring Boot 3', reason: 'Spring MVC controllers implement RESTful endpoints.' },
        { skill: 'Hibernate & Spring Data JPA', dependsOn: 'Spring Boot 3', reason: 'Spring Data JPA integrates directly into the Spring Boot framework.' },
        { skill: 'Hibernate & Spring Data JPA', dependsOn: 'SQL & Relational Databases', reason: 'Understanding SQL queries is vital to configure ORM entities and optimize queries.' },
        { skill: 'Microservices Architecture', dependsOn: 'RESTful API Architecture', reason: 'Microservices communicate primarily over REST and event buses.' },
        { skill: 'Microservices Architecture', dependsOn: 'Docker & Containerization', reason: 'Containerization is the standard packaging method for distributed microservices.' },
        { skill: 'Apache Kafka & Event Streaming', dependsOn: 'Microservices Architecture', reason: 'Event brokers enable asynchronous decoupling in microservice topologies.' },
        { skill: 'System Design & Scalability', dependsOn: 'Microservices Architecture', reason: 'System design synthesizes caching, databases, and microservices for high throughput.' },

        // Frontend Path
        { skill: 'JavaScript (ES6+)', dependsOn: 'Modern HTML5 & Semantic CSS', reason: 'JavaScript manipulates the HTML DOM tree and CSS stylesheets.' },
        { skill: 'TypeScript', dependsOn: 'JavaScript (ES6+)', reason: 'TypeScript is a typed superset of JavaScript.' },
        { skill: 'React 19 & Component Architecture', dependsOn: 'JavaScript (ES6+)', reason: 'React relies heavily on modern JS closures, destructuring, and map/filter methods.' },
        { skill: 'Tailwind CSS & UI Systems', dependsOn: 'Modern HTML5 & Semantic CSS', reason: 'Tailwind generates utility classes targeting fundamental CSS properties.' },
        { skill: 'State Management (Zustand / Redux)', dependsOn: 'React 19 & Component Architecture', reason: 'State management manages complex state across React component trees.' },
        { skill: 'Next.js & React Server Components', dependsOn: 'React 19 & Component Architecture', reason: 'Next.js is a full-stack production framework built on React.' },
        { skill: 'Next.js & React Server Components', dependsOn: 'TypeScript', reason: 'Next.js projects in modern production environments rely on TypeScript.' },
        { skill: 'Frontend Testing (Vitest & Playwright)', dependsOn: 'React 19 & Component Architecture', reason: 'Testing suites test React components and user interaction flows.' },
        { skill: 'Web Performance & Core Web Vitals', dependsOn: 'Next.js & React Server Components', reason: 'Performance tuning optimizes SSR, image optimization, and bundle hydration.' },

        // Data Analyst Path
        { skill: 'Python for Data Analysis', dependsOn: 'Advanced Excel & Spreadsheets', reason: 'Python automates workflows and surpasses spreadsheet size limits.' },
        { skill: 'Pandas & NumPy', dependsOn: 'Python for Data Analysis', reason: 'Pandas and NumPy are Python libraries requiring core programming competence.' },
        { skill: 'Pandas & NumPy', dependsOn: 'SQL & Relational Databases', reason: 'SQL queries load raw data into Pandas DataFrames for transformation.' },
        { skill: 'Exploratory Data Analysis (Matplotlib / Seaborn)', dependsOn: 'Pandas & NumPy', reason: 'Visualizations plot transformed Pandas DataFrames.' },
        { skill: 'Data Visualization (Tableau & Power BI)', dependsOn: 'SQL & Relational Databases', reason: 'BI tools connect to SQL databases and warehouse schemas.' },
        { skill: 'Applied Statistics & Probability', dependsOn: 'Advanced Excel & Spreadsheets', reason: 'Statistical intuition guides analysis of distributions and anomalies.' },
        { skill: 'Data Warehousing & ETL (Snowflake / BigQuery)', dependsOn: 'SQL & Relational Databases', reason: 'Data warehouses use advanced analytical SQL and columnar storage.' },

        // AI Engineer Path
        { skill: 'Classical Machine Learning (Scikit-Learn)', dependsOn: 'Python for Data Analysis', reason: 'Model training pipelines are written in Python.' },
        { skill: 'Classical Machine Learning (Scikit-Learn)', dependsOn: 'Linear Algebra & Multivariable Calculus', reason: 'Loss functions and optimization algorithms require mathematical foundations.' },
        { skill: 'Deep Learning & Neural Architectures', dependsOn: 'Classical Machine Learning (Scikit-Learn)', reason: 'Deep learning builds upon fundamental ML validation and cost concepts.' },
        { skill: 'PyTorch Framework', dependsOn: 'Deep Learning & Neural Architectures', reason: 'PyTorch implements neural layers, forward passes, and backpropagation.' },
        { skill: 'Transformers & Hugging Face', dependsOn: 'PyTorch Framework', reason: 'Hugging Face Transformer models are trained and executed in PyTorch tensors.' },
        { skill: 'Vector Databases & RAG Architecture', dependsOn: 'Transformers & Hugging Face', reason: 'RAG systems generate dense embeddings using transformer models.' },
        { skill: 'LLM Agents & Tool Calling (LangChain / LlamaIndex)', dependsOn: 'Vector Databases & RAG Architecture', reason: 'Agents orchestrate vector retrievers and external tools.' },
        { skill: 'MLOps, Model Serving & Triton', dependsOn: 'PyTorch Framework', reason: 'Serving infrastructure deploys and monitors serialized PyTorch/ONNX models.' },

        // DevOps & Cloud Path
        { skill: 'Git & CI/CD Pipelines (GitHub Actions)', dependsOn: 'Linux Administration & Bash Scripting', reason: 'CI/CD runners execute bash commands in containerized Linux environments.' },
        { skill: 'Docker & Containerization', dependsOn: 'Linux Administration & Bash Scripting', reason: 'Docker relies on Linux cgroups, namespaces, and shell commands.' },
        { skill: 'Kubernetes (K8s) Orchestration', dependsOn: 'Docker & Containerization', reason: 'Kubernetes orchestrates multi-container applications across clusters.' },
        { skill: 'Infrastructure as Code (Terraform)', dependsOn: 'Cloud Architecture (AWS / GCP)', reason: 'Terraform templates provision cloud resources (VPCs, EC2, S3).' },
        { skill: 'Observability (Prometheus, Grafana, OpenTelemetry)', dependsOn: 'Kubernetes (K8s) Orchestration', reason: 'Monitoring captures metrics from containerized cluster workloads.' }
    ],

    // Job Roles to Skills: JobRole REQUIRES Skill
    roleRequirements: [
        // Java Backend Developer
        { role: 'Java Backend Developer', skill: 'Object-Oriented Programming (OOP)', importance: 'core', minProficiency: 'advanced' },
        { role: 'Java Backend Developer', skill: 'Java Core & Modern Syntax', importance: 'core', minProficiency: 'advanced' },
        { role: 'Java Backend Developer', skill: 'SQL & Relational Databases', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'Spring Boot 3', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'RESTful API Architecture', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'Hibernate & Spring Data JPA', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'Docker & Containerization', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'Microservices Architecture', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'Apache Kafka & Event Streaming', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'Java Backend Developer', skill: 'System Design & Scalability', importance: 'recommended', minProficiency: 'advanced' },

        // Frontend Developer
        { role: 'Frontend Developer', skill: 'Modern HTML5 & Semantic CSS', importance: 'core', minProficiency: 'advanced' },
        { role: 'Frontend Developer', skill: 'JavaScript (ES6+)', importance: 'core', minProficiency: 'advanced' },
        { role: 'Frontend Developer', skill: 'TypeScript', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Frontend Developer', skill: 'React 19 & Component Architecture', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Frontend Developer', skill: 'Tailwind CSS & UI Systems', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Frontend Developer', skill: 'State Management (Zustand / Redux)', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'Frontend Developer', skill: 'Next.js & React Server Components', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Frontend Developer', skill: 'Frontend Testing (Vitest & Playwright)', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'Frontend Developer', skill: 'Web Performance & Core Web Vitals', importance: 'recommended', minProficiency: 'intermediate' },

        // Data Analyst
        { role: 'Data Analyst', skill: 'Advanced Excel & Spreadsheets', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Data Analyst', skill: 'SQL & Relational Databases', importance: 'core', minProficiency: 'advanced' },
        { role: 'Data Analyst', skill: 'Python for Data Analysis', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Data Analyst', skill: 'Pandas & NumPy', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Data Analyst', skill: 'Data Visualization (Tableau & Power BI)', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Data Analyst', skill: 'Applied Statistics & Probability', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Data Analyst', skill: 'Exploratory Data Analysis (Matplotlib / Seaborn)', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'Data Analyst', skill: 'Data Warehousing & ETL (Snowflake / BigQuery)', importance: 'recommended', minProficiency: 'beginner' },

        // AI Engineer
        { role: 'AI Engineer', skill: 'Python for Data Analysis', importance: 'core', minProficiency: 'advanced' },
        { role: 'AI Engineer', skill: 'Linear Algebra & Multivariable Calculus', importance: 'core', minProficiency: 'intermediate' },
        { role: 'AI Engineer', skill: 'Classical Machine Learning (Scikit-Learn)', importance: 'core', minProficiency: 'intermediate' },
        { role: 'AI Engineer', skill: 'Deep Learning & Neural Architectures', importance: 'core', minProficiency: 'intermediate' },
        { role: 'AI Engineer', skill: 'PyTorch Framework', importance: 'core', minProficiency: 'advanced' },
        { role: 'AI Engineer', skill: 'Transformers & Hugging Face', importance: 'core', minProficiency: 'intermediate' },
        { role: 'AI Engineer', skill: 'Vector Databases & RAG Architecture', importance: 'core', minProficiency: 'intermediate' },
        { role: 'AI Engineer', skill: 'LLM Agents & Tool Calling (LangChain / LlamaIndex)', importance: 'recommended', minProficiency: 'intermediate' },
        { role: 'AI Engineer', skill: 'MLOps, Model Serving & Triton', importance: 'recommended', minProficiency: 'intermediate' },

        // Full Stack Developer
        { role: 'Full Stack Developer', skill: 'Modern HTML5 & Semantic CSS', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Full Stack Developer', skill: 'JavaScript (ES6+)', importance: 'core', minProficiency: 'advanced' },
        { role: 'Full Stack Developer', skill: 'TypeScript', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Full Stack Developer', skill: 'React 19 & Component Architecture', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Full Stack Developer', skill: 'Next.js & React Server Components', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Full Stack Developer', skill: 'SQL & Relational Databases', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Full Stack Developer', skill: 'RESTful API Architecture', importance: 'core', minProficiency: 'intermediate' },
        { role: 'Full Stack Developer', skill: 'Docker & Containerization', importance: 'recommended', minProficiency: 'beginner' },

        // DevOps Engineer
        { role: 'DevOps Engineer', skill: 'Linux Administration & Bash Scripting', importance: 'core', minProficiency: 'advanced' },
        { role: 'DevOps Engineer', skill: 'Git & CI/CD Pipelines (GitHub Actions)', importance: 'core', minProficiency: 'advanced' },
        { role: 'DevOps Engineer', skill: 'Docker & Containerization', importance: 'core', minProficiency: 'advanced' },
        { role: 'DevOps Engineer', skill: 'Kubernetes (K8s) Orchestration', importance: 'core', minProficiency: 'intermediate' },
        { role: 'DevOps Engineer', skill: 'Infrastructure as Code (Terraform)', importance: 'core', minProficiency: 'intermediate' },
        { role: 'DevOps Engineer', skill: 'Cloud Architecture (AWS / GCP)', importance: 'core', minProficiency: 'intermediate' },
        { role: 'DevOps Engineer', skill: 'Observability (Prometheus, Grafana, OpenTelemetry)', importance: 'recommended', minProficiency: 'intermediate' }
    ],

    // Learning Resources: Skill TAUGHT_BY LearningResource
    resources: [
        {
            skill: 'Object-Oriented Programming (OOP)',
            title: 'Refactoring Guru: OOP Fundamentals & Patterns',
            type: 'Interactive Guide',
            url: 'https://refactoring.guru/design-patterns',
            provider: 'Refactoring.Guru',
            duration: '4 hours'
        },
        {
            skill: 'Java Core & Modern Syntax',
            title: 'Oracle Java 21 Documentation & Tutorials',
            type: 'Documentation',
            url: 'https://dev.java/learn/',
            provider: 'Oracle',
            duration: '15 hours'
        },
        {
            skill: 'Spring Boot 3',
            title: 'Building an Application with Spring Boot',
            type: 'Hands-on Guide',
            url: 'https://spring.io/guides/gs/spring-boot/',
            provider: 'Spring.io',
            duration: '8 hours'
        },
        {
            skill: 'SQL & Relational Databases',
            title: 'SQLBolt - Interactive SQL Lessons',
            type: 'Interactive',
            url: 'https://sqlbolt.com/',
            provider: 'SQLBolt',
            duration: '5 hours'
        },
        {
            skill: 'Hibernate & Spring Data JPA',
            title: 'Accessing Data with JPA & Spring Data',
            type: 'Guide',
            url: 'https://spring.io/guides/gs/accessing-data-jpa/',
            provider: 'Spring.io',
            duration: '6 hours'
        },
        {
            skill: 'Modern HTML5 & Semantic CSS',
            title: 'MDN Web Docs: Learn Web Development',
            type: 'Documentation',
            url: 'https://developer.mozilla.org/en-US/docs/Learn',
            provider: 'MDN',
            duration: '10 hours'
        },
        {
            skill: 'JavaScript (ES6+)',
            title: 'JavaScript.info - The Modern JavaScript Tutorial',
            type: 'Interactive Tutorial',
            url: 'https://javascript.info/',
            provider: 'JavaScript.info',
            duration: '20 hours'
        },
        {
            skill: 'TypeScript',
            title: 'TypeScript for JavaScript Programmers',
            type: 'Handbook',
            url: 'https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html',
            provider: 'Microsoft',
            duration: '6 hours'
        },
        {
            skill: 'React 19 & Component Architecture',
            title: 'React Official Documentation (Learn React)',
            type: 'Interactive Docs',
            url: 'https://react.dev/learn',
            provider: 'React Core Team',
            duration: '16 hours'
        },
        {
            skill: 'Next.js & React Server Components',
            title: 'Next.js Learn Course - App Router',
            type: 'Course',
            url: 'https://nextjs.org/learn',
            provider: 'Vercel',
            duration: '10 hours'
        },
        {
            skill: 'Python for Data Analysis',
            title: 'Python for Beginners & Data Analysts',
            type: 'Tutorial',
            url: 'https://docs.python.org/3/tutorial/',
            provider: 'Python Software Foundation',
            duration: '12 hours'
        },
        {
            skill: 'Pandas & NumPy',
            title: '10 Minutes to Pandas Official Guide',
            type: 'Quickstart',
            url: 'https://pandas.pydata.org/docs/user_guide/10min.html',
            provider: 'PyData',
            duration: '8 hours'
        },
        {
            skill: 'PyTorch Framework',
            title: 'PyTorch Deep Learning Zero to Mastery',
            type: 'Course',
            url: 'https://pytorch.org/tutorials/beginner/basics/intro.html',
            provider: 'PyTorch',
            duration: '25 hours'
        },
        {
            skill: 'Transformers & Hugging Face',
            title: 'Hugging Face NLP Course',
            type: 'Interactive Course',
            url: 'https://huggingface.co/learn/nlp-course',
            provider: 'Hugging Face',
            duration: '18 hours'
        },
        {
            skill: 'Vector Databases & RAG Architecture',
            title: 'Neo4j GraphRAG & Vector Search Overview',
            type: 'Documentation',
            url: 'https://neo4j.com/docs/genai-ecosystem/',
            provider: 'Neo4j',
            duration: '6 hours'
        },
        {
            skill: 'Docker & Containerization',
            title: 'Docker Getting Started Guide',
            type: 'Interactive Tutorial',
            url: 'https://docs.docker.com/get-started/',
            provider: 'Docker',
            duration: '6 hours'
        },
        {
            skill: 'Kubernetes (K8s) Orchestration',
            title: 'Kubernetes Basics Interactive Tutorial',
            type: 'Interactive',
            url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
            provider: 'CNCF',
            duration: '12 hours'
        }
    ]
};

/**
 * Connect to Neo4j and verify connectivity.
 * Falls back cleanly to Demo Graph Mode if credentials are absent or connection fails.
 */
async function initNeo4j() {
    const uri = process.env.NEO4J_URI || process.env.NEO4J_URL;
    const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;
    const database = process.env.NEO4J_DATABASE || 'neo4j';

    if (!uri || !password) {
        console.log('ℹ️  Neo4j credentials not fully provided. Starting in Demo Graph Mode.');
        connectionStatus = {
            isConnected: false,
            mode: 'demo',
            uri: uri || 'bolt://localhost:7687 (demo mode)',
            database,
            error: 'NEO4J_URI or NEO4J_PASSWORD not set in environment.'
        };
        return connectionStatus;
    }

    try {
        console.log(`🔌 Attempting connection to Neo4j instance at: ${uri}...`);
        driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
            maxConnectionLifetime: 3 * 60 * 60 * 1000,
            maxConnectionPoolSize: 50,
            connectionAcquisitionTimeout: 10000
        });

        await driver.verifyConnectivity();
        console.log('✅ Successfully connected to Neo4j Graph Database!');

        connectionStatus = {
            isConnected: true,
            mode: 'neo4j',
            uri,
            database,
            error: null
        };

        // Seed data in Neo4j if empty or not yet seeded
        await seedNeo4jDatabase();

        return connectionStatus;
    } catch (err) {
        console.warn(`⚠️  Neo4j connection failed: ${err.message}. Falling back to Demo Graph Mode.`);
        connectionStatus = {
            isConnected: false,
            mode: 'demo',
            uri,
            database,
            error: err.message
        };
        return connectionStatus;
    }
}

/**
 * Seed live Neo4j database with Career Graph schema, nodes, and relationships.
 */
async function seedNeo4jDatabase() {
    if (!driver || connectionStatus.mode !== 'neo4j') return;

    const session = driver.session({ database: connectionStatus.database });
    try {
        console.log('🌱 Ensuring Neo4j Graph Constraints and Schema...');
        // Create uniqueness constraints
        await session.run(`CREATE CONSTRAINT jobrole_id IF NOT EXISTS FOR (j:JobRole) REQUIRE j.id IS UNIQUE`);
        await session.run(`CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE`);
        await session.run(`CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE`);

        // Check if JobRoles already exist
        const countRes = await session.run(`MATCH (j:JobRole) RETURN count(j) AS count`);
        const existingCount = countRes.records[0]?.get('count')?.toNumber?.() || 0;

        if (existingCount > 0) {
            console.log(`✅ Neo4j already populated with ${existingCount} JobRoles.`);
            return;
        }

        console.log('🌱 Seeding JobRoles, Skills, Dependencies, and Learning Resources into Neo4j...');

        // Seed Roles
        for (const role of SEED_CATALOG.roles) {
            await session.run(
                `MERGE (j:JobRole {id: $id})
                 SET j.name = $name, j.title = $title, j.category = $category, j.description = $description`,
                role
            );
        }

        // Seed Skills
        for (const skill of SEED_CATALOG.skills) {
            await session.run(
                `MERGE (s:Skill {name: $name})
                 SET s.id = $id, s.category = $category, s.difficulty = $difficulty, s.description = $description`,
                skill
            );
        }

        // Seed DEPENDS_ON relationships
        for (const dep of SEED_CATALOG.dependencies) {
            await session.run(
                `MATCH (s:Skill {name: $skill}), (prereq:Skill {name: $dependsOn})
                 MERGE (s)-[r:DEPENDS_ON]->(prereq)
                 SET r.reason = $reason`,
                dep
            );
        }

        // Seed REQUIRES relationships
        for (const req of SEED_CATALOG.roleRequirements) {
            await session.run(
                `MATCH (j:JobRole {name: $role}), (s:Skill {name: $skill})
                 MERGE (j)-[r:REQUIRES]->(s)
                 SET r.importance = $importance, r.minProficiency = $minProficiency`,
                req
            );
        }

        // Seed LearningResources and TAUGHT_BY
        for (const res of SEED_CATALOG.resources) {
            await session.run(
                `MERGE (lr:LearningResource {title: $title})
                 SET lr.type = $type, lr.url = $url, lr.provider = $provider, lr.duration = $duration
                 WITH lr
                 MATCH (s:Skill {name: $skill})
                 MERGE (s)-[r:TAUGHT_BY]->(lr)`,
                res
            );
        }

        console.log('🎉 Neo4j database successfully seeded with Career Knowledge Graph!');
    } catch (seedErr) {
        console.error('Error during Neo4j seed:', seedErr.message);
    } finally {
        await session.close();
    }
}

/**
 * Returns available job roles.
 */
async function getJobRoles() {
    if (connectionStatus.mode === 'neo4j' && driver) {
        const session = driver.session({ database: connectionStatus.database });
        try {
            const res = await session.run(`
                MATCH (j:JobRole)
                OPTIONAL MATCH (j)-[r:REQUIRES]->(s:Skill)
                RETURN j.id AS id, j.name AS name, j.title AS title, j.category AS category,
                       j.description AS description, count(s) AS requiredSkillCount
                ORDER BY j.name ASC
            `);
            return res.records.map(record => ({
                id: record.get('id'),
                name: record.get('name'),
                title: record.get('title'),
                category: record.get('category'),
                description: record.get('description'),
                requiredSkillCount: record.get('requiredSkillCount')?.toNumber?.() || 0
            }));
        } catch (e) {
            console.error('Error fetching roles from Neo4j:', e.message);
        } finally {
            await session.close();
        }
    }

    // Demo Mode fallback
    return SEED_CATALOG.roles.map(r => {
        const skillCount = SEED_CATALOG.roleRequirements.filter(req => req.role === r.name).length;
        return { ...r, requiredSkillCount: skillCount };
    });
}

/**
 * Normalizes input role name to match catalog roles.
 */
function findMatchingRoleName(inputRole) {
    if (!inputRole) return 'Java Backend Developer';
    const norm = inputRole.toLowerCase().trim();
    const exact = SEED_CATALOG.roles.find(r => r.name.toLowerCase() === norm);
    if (exact) return exact.name;

    const partial = SEED_CATALOG.roles.find(r => 
        norm.includes(r.name.toLowerCase()) || 
        r.name.toLowerCase().includes(norm) ||
        (r.category && norm.includes(r.category.toLowerCase()))
    );
    if (partial) return partial.name;

    // Keyword heuristics
    if (norm.includes('java') || norm.includes('spring')) return 'Java Backend Developer';
    if (norm.includes('front') || norm.includes('react') || norm.includes('web') || norm.includes('ui')) return 'Frontend Developer';
    if (norm.includes('data') || norm.includes('analyst') || norm.includes('sql') || norm.includes('bi')) return 'Data Analyst';
    if (norm.includes('ai') || norm.includes('ml') || norm.includes('machine') || norm.includes('deep') || norm.includes('llm')) return 'AI Engineer';
    if (norm.includes('devops') || norm.includes('cloud') || norm.includes('k8s') || norm.includes('docker')) return 'DevOps Engineer';
    if (norm.includes('full') || norm.includes('stack')) return 'Full Stack Developer';

    return 'Java Backend Developer';
}

/**
 * Standardize user skills array.
 * Converts strings or objects into { name: string, proficiency: 'beginner'|'intermediate'|'advanced' }
 */
function normalizeUserSkills(skillsInput) {
    if (!skillsInput) return [];
    let rawList = [];

    if (Array.isArray(skillsInput)) {
        rawList = skillsInput;
    } else if (typeof skillsInput === 'string') {
        rawList = skillsInput.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    return rawList.map(item => {
        if (typeof item === 'object' && item !== null) {
            return {
                name: (item.name || item.skill || '').trim(),
                proficiency: (item.proficiency || item.level || 'intermediate').toLowerCase()
            };
        }
        // String format: "Java: Intermediate" or "JavaScript (Advanced)" or just "Python"
        const str = String(item).trim();
        const colonSplit = str.split(':');
        if (colonSplit.length > 1) {
            return {
                name: colonSplit[0].trim(),
                proficiency: colonSplit[1].trim().toLowerCase()
            };
        }
        const parenMatch = str.match(/^(.*?)\s*\((beginner|intermediate|advanced)\)$/i);
        if (parenMatch) {
            return {
                name: parenMatch[1].trim(),
                proficiency: parenMatch[2].toLowerCase()
            };
        }
        return {
            name: str,
            proficiency: 'intermediate'
        };
    }).filter(s => s.name.length > 0);
}

/**
 * Persists user skills and target role into Neo4j graph.
 */
async function saveUserGraphProfile(userId, roleName, userSkills) {
    if (connectionStatus.mode === 'neo4j' && driver) {
        const session = driver.session({ database: connectionStatus.database });
        try {
            await session.run(`
                MERGE (p:Person {id: $userId})
                MERGE (j:JobRole {name: $roleName})
                MERGE (p)-[:TARGETS {updatedAt: datetime()}]->(j)
            `, { userId: userId || 'anonymous_guest', roleName });

            for (const s of userSkills) {
                await session.run(`
                    MERGE (p:Person {id: $userId})
                    MERGE (sk:Skill {name: $skillName})
                    MERGE (p)-[h:HAS_SKILL]->(sk)
                    SET h.proficiency = $proficiency, h.updatedAt = datetime()
                `, {
                    userId: userId || 'anonymous_guest',
                    skillName: s.name,
                    proficiency: s.proficiency || 'intermediate'
                });
            }
        } catch (e) {
            console.error('Failed to save user graph profile:', e.message);
        } finally {
            await session.close();
        }
    }
}

/**
 * Perform Graph-based Skill Gap Analysis.
 *
 * Traverses required skills for JobRole, resolves prerequisite dependencies (DEPENDS_ON),
 * compares with user's existing skills (HAS_SKILL), identifies missing prerequisites and
 * missing core skills, calculates actual coverage percentage, and determines the
 * mathematically next optimal skill based on topological dependency readiness.
 */
async function analyzeSkillGap({ userId = 'guest_user', targetRole, currentSkills = [] }) {
    const matchedRole = findMatchingRoleName(targetRole);
    const normalizedSkills = normalizeUserSkills(currentSkills);

    // Save profile to graph if connected
    await saveUserGraphProfile(userId, matchedRole, normalizedSkills);

    if (connectionStatus.mode === 'neo4j' && driver) {
        const session = driver.session({ database: connectionStatus.database });
        try {
            // Cypher query retrieving all required skills, their prerequisites, and learning resources
            const cypherQuery = `
                MATCH (j:JobRole {name: $role})
                MATCH (j)-[req:REQUIRES]->(s:Skill)
                OPTIONAL MATCH (s)-[dep:DEPENDS_ON]->(prereq:Skill)
                OPTIONAL MATCH (s)-[:TAUGHT_BY]->(res:LearningResource)
                RETURN s.name AS skillName,
                       s.category AS category,
                       s.difficulty AS difficulty,
                       s.description AS description,
                       req.importance AS importance,
                       req.minProficiency AS minProficiency,
                       collect(DISTINCT { name: prereq.name, reason: dep.reason }) AS prerequisites,
                       collect(DISTINCT {
                           title: res.title,
                           type: res.type,
                           url: res.url,
                           provider: res.provider,
                           duration: res.duration
                       }) AS resources
            `;

            const result = await session.run(cypherQuery, { role: matchedRole });
            const requiredSkillsData = result.records.map(r => ({
                name: r.get('skillName'),
                category: r.get('category') || 'General',
                difficulty: r.get('difficulty') || 'Intermediate',
                description: r.get('description') || '',
                importance: r.get('importance') || 'core',
                minProficiency: r.get('minProficiency') || 'intermediate',
                prerequisites: (r.get('prerequisites') || []).filter(p => p && p.name),
                resources: (r.get('resources') || []).filter(res => res && res.title)
            }));

            return computeSkillGapMetrics(matchedRole, requiredSkillsData, normalizedSkills, userId);
        } catch (cypherErr) {
            console.error('Cypher analysis failed, falling back to graph model in memory:', cypherErr.message);
        } finally {
            await session.close();
        }
    }

    // Demo / In-Memory Graph computation
    const requiredSkillsData = buildDemoRequiredSkills(matchedRole);
    return computeSkillGapMetrics(matchedRole, requiredSkillsData, normalizedSkills, userId);
}

/**
 * Helper to build skill graph structure in demo mode using SEED_CATALOG.
 */
function buildDemoRequiredSkills(roleName) {
    const roleReqs = SEED_CATALOG.roleRequirements.filter(r => r.role === roleName);
    return roleReqs.map(req => {
        const skillObj = SEED_CATALOG.skills.find(s => s.name === req.skill) || {
            name: req.skill,
            category: 'Core',
            difficulty: 'Intermediate',
            description: ''
        };

        const prereqs = SEED_CATALOG.dependencies
            .filter(d => d.skill === req.skill)
            .map(d => ({ name: d.dependsOn, reason: d.reason }));

        const resources = SEED_CATALOG.resources
            .filter(res => res.skill === req.skill)
            .map(res => ({
                title: res.title,
                type: res.type,
                url: res.url,
                provider: res.provider,
                duration: res.duration
            }));

        return {
            name: req.skill,
            category: skillObj.category,
            difficulty: skillObj.difficulty,
            description: skillObj.description,
            importance: req.importance,
            minProficiency: req.minProficiency,
            prerequisites: prereqs,
            resources
        };
    });
}

/**
 * Computes exact skill coverage, missing skills, prerequisites, and next recommended skill.
 */
function computeSkillGapMetrics(targetRole, requiredSkills, userSkills, userId = 'candidate') {
    const userSkillMap = new Map();
    userSkills.forEach(s => {
        userSkillMap.set(s.name.toLowerCase(), s.proficiency || 'intermediate');
    });

    // Helper to test if user has skill
    const hasSkillCheck = (name) => {
        const key = name.toLowerCase();
        for (const [userSkill, prof] of userSkillMap.entries()) {
            if (userSkill === key || userSkill.includes(key) || key.includes(userSkill)) {
                return { has: true, proficiency: prof };
            }
        }
        return { has: false, proficiency: null };
    };

    const knownSkills = [];
    const improvingSkills = [];
    const missingSkills = [];
    const missingPrerequisitesSet = new Set();
    const missingPrerequisiteDetails = [];

    const proficiencyRank = { beginner: 1, intermediate: 2, advanced: 3 };

    requiredSkills.forEach(req => {
        const check = hasSkillCheck(req.name);

        // Check prerequisites for this skill
        req.prerequisites.forEach(p => {
            const prereqCheck = hasSkillCheck(p.name);
            if (!prereqCheck.has) {
                if (!missingPrerequisitesSet.has(p.name)) {
                    missingPrerequisitesSet.add(p.name);
                    const prereqObj = SEED_CATALOG.skills.find(s => s.name === p.name) || {
                        name: p.name,
                        category: 'Prerequisite',
                        difficulty: 'Beginner',
                        description: p.reason
                    };
                    const res = SEED_CATALOG.resources.filter(r => r.skill === p.name);
                    missingPrerequisiteDetails.push({
                        name: p.name,
                        category: prereqObj.category,
                        difficulty: prereqObj.difficulty,
                        reason: p.reason,
                        forSkill: req.name,
                        resources: res
                    });
                }
            }
        });

        if (check.has) {
            const userRank = proficiencyRank[check.proficiency] || 2;
            const requiredRank = proficiencyRank[req.minProficiency] || 2;

            if (userRank >= requiredRank) {
                knownSkills.push({
                    name: req.name,
                    category: req.category,
                    proficiency: check.proficiency,
                    status: 'verified',
                    importance: req.importance,
                    resources: req.resources
                });
            } else {
                improvingSkills.push({
                    name: req.name,
                    category: req.category,
                    currentProficiency: check.proficiency,
                    requiredProficiency: req.minProficiency,
                    status: 'needs_improvement',
                    importance: req.importance,
                    resources: req.resources
                });
            }
        } else {
            missingSkills.push({
                name: req.name,
                category: req.category,
                difficulty: req.difficulty,
                importance: req.importance,
                requiredProficiency: req.minProficiency,
                prerequisites: req.prerequisites.map(p => p.name),
                status: 'missing',
                resources: req.resources
            });
        }
    });

    const totalRequired = requiredSkills.length;
    const knownCount = knownSkills.length;
    // Coverage considers verified skills as 1.0, improving skills as 0.5
    const coverageScore = knownCount + (improvingSkills.length * 0.5);
    const coveragePercent = totalRequired > 0 ? Math.min(100, Math.round((coverageScore / totalRequired) * 100)) : 0;

    // Determine the single next best skill:
    // 1. If any missing foundational prerequisites exist, recommend the first missing prerequisite.
    // 2. Otherwise, find the missing core skill whose prerequisites are already met.
    let recommendedNextSkill = null;

    if (missingPrerequisiteDetails.length > 0) {
        recommendedNextSkill = {
            name: missingPrerequisiteDetails[0].name,
            reason: `Essential prerequisite for ${missingPrerequisiteDetails[0].forSkill}. Building this foundational knowledge unlocks subsequent stages.`,
            isPrerequisite: true,
            resources: missingPrerequisiteDetails[0].resources
        };
    } else {
        const readySkill = missingSkills.find(s => {
            return s.prerequisites.every(p => hasSkillCheck(p).has);
        }) || missingSkills[0] || improvingSkills[0];

        if (readySkill) {
            recommendedNextSkill = {
                name: readySkill.name,
                reason: `All prerequisite dependencies are met! High-impact ${readySkill.importance || 'core'} skill for ${targetRole}.`,
                isPrerequisite: false,
                resources: readySkill.resources || []
            };
        }
    }

    // Generate graph nodes and relationships for interactive visualizer
    const graphNodes = [];
    const graphLinks = [];
    const addedNodeIds = new Set();

    // 1. Candidate Node (Person)
    const userNodeId = 'person_' + (userId || 'candidate');
    graphNodes.push({
        id: userNodeId,
        label: 'Candidate (You)',
        type: 'Person',
        group: 'user',
        radius: 36
    });
    addedNodeIds.add(userNodeId);

    // 2. JobRole Node
    const roleNodeId = 'role_' + targetRole.replace(/\s+/g, '_');
    graphNodes.push({
        id: roleNodeId,
        label: targetRole,
        type: 'JobRole',
        group: 'role',
        radius: 42
    });
    addedNodeIds.add(roleNodeId);

    // Relationship: (Person)-[:TARGETS]->(JobRole)
    graphLinks.push({
        source: userNodeId,
        target: roleNodeId,
        type: 'TARGETS',
        label: 'TARGETS'
    });

    const nextSkillName = recommendedNextSkill ? recommendedNextSkill.name.toLowerCase() : '';
    const knownSkillNames = knownSkills.map(s => s.name.toLowerCase());
    const prereqSkillNames = missingPrerequisiteDetails.map(s => s.name.toLowerCase());

    // 3. Process all required and prerequisite skills
    const allSkillsList = [...requiredSkills, ...missingPrerequisiteDetails];
    const uniqueSkills = new Map();
    allSkillsList.forEach(s => {
        if (!uniqueSkills.has(s.name.toLowerCase())) {
            uniqueSkills.set(s.name.toLowerCase(), s);
        }
    });

    uniqueSkills.forEach((skill, lowerName) => {
        const skillNodeId = 'skill_' + skill.name.replace(/\s+/g, '_');
        let group = 'missing';
        if (lowerName === nextSkillName) {
            group = 'next';
        } else if (knownSkillNames.includes(lowerName)) {
            group = 'known';
        } else if (prereqSkillNames.includes(lowerName)) {
            group = 'prereq';
        }

        if (!addedNodeIds.has(skillNodeId)) {
            graphNodes.push({
                id: skillNodeId,
                label: skill.name,
                type: 'Skill',
                group,
                category: skill.category || 'Core',
                difficulty: skill.difficulty || 'Intermediate',
                importance: skill.importance || 'essential',
                resources: skill.resources || [],
                prerequisites: skill.prerequisites || [],
                radius: group === 'next' ? 34 : group === 'known' ? 30 : 28
            });
            addedNodeIds.add(skillNodeId);
        }

        // If known: (Person)-[:HAS_SKILL]->(Skill)
        if (group === 'known') {
            graphLinks.push({
                source: userNodeId,
                target: skillNodeId,
                type: 'HAS_SKILL',
                label: 'HAS_SKILL'
            });
        }

        // If required by target role: (JobRole)-[:REQUIRES]->(Skill)
        const isCoreRequired = requiredSkills.some(rs => rs.name.toLowerCase() === lowerName);
        if (isCoreRequired) {
            graphLinks.push({
                source: roleNodeId,
                target: skillNodeId,
                type: 'REQUIRES',
                label: 'REQUIRES'
            });
        }

        // Prerequisite links: (Skill)-[:DEPENDS_ON]->(Prereq)
        if (Array.isArray(skill.prerequisites)) {
            skill.prerequisites.forEach(prereq => {
                const pName = typeof prereq === 'string' ? prereq : prereq.name;
                if (pName) {
                    const prereqNodeId = 'skill_' + pName.replace(/\s+/g, '_');
                    if (!addedNodeIds.has(prereqNodeId)) {
                        const isPrereqKnown = knownSkillNames.includes(pName.toLowerCase());
                        const isPrereqNext = pName.toLowerCase() === nextSkillName;
                        const pGroup = isPrereqNext ? 'next' : isPrereqKnown ? 'known' : 'prereq';
                        graphNodes.push({
                            id: prereqNodeId,
                            label: pName,
                            type: 'Skill',
                            group: pGroup,
                            category: 'Prerequisite',
                            difficulty: 'Foundational',
                            radius: isPrereqNext ? 34 : 28
                        });
                        addedNodeIds.add(prereqNodeId);

                        if (isPrereqKnown) {
                            graphLinks.push({
                                source: userNodeId,
                                target: prereqNodeId,
                                type: 'HAS_SKILL',
                                label: 'HAS_SKILL'
                            });
                        }
                    }

                    graphLinks.push({
                        source: skillNodeId,
                        target: prereqNodeId,
                        type: 'DEPENDS_ON',
                        label: 'DEPENDS_ON'
                    });
                }
            });
        }

        // Top 1 curated learning resource node per skill
        if (Array.isArray(skill.resources) && skill.resources.length > 0) {
            const res = skill.resources[0];
            const resNodeId = 'res_' + skill.name.replace(/\s+/g, '_');
            if (!addedNodeIds.has(resNodeId)) {
                graphNodes.push({
                    id: resNodeId,
                    label: res.title,
                    type: 'LearningResource',
                    group: 'resource',
                    url: res.url,
                    provider: res.provider || 'Course',
                    forSkill: skill.name,
                    radius: 20
                });
                addedNodeIds.add(resNodeId);
                graphLinks.push({
                    source: skillNodeId,
                    target: resNodeId,
                    type: 'TAUGHT_BY',
                    label: 'TAUGHT_BY'
                });
            }
        }
    });

    const cypherQuery = `// Neo4j Cypher Traversal for ${targetRole}
MATCH (candidate:Person {id: $userId})
MATCH (target:JobRole {name: "${targetRole}"})
OPTIONAL MATCH (candidate)-[has:HAS_SKILL]->(known:Skill)
MATCH (target)-[req:REQUIRES]->(required:Skill)
OPTIONAL MATCH (required)-[dep:DEPENDS_ON*1..2]->(prereq:Skill)
OPTIONAL MATCH (required)-[taught:TAUGHT_BY]->(res:LearningResource)
RETURN candidate, target, has, known, req, required, dep, prereq, taught, res;`;

    return {
        targetRole,
        dataSource: connectionStatus.mode === 'neo4j' ? 'Neo4j Graph Database (Live)' : 'Neo4j Graph Model (Demo Mode)',
        mode: connectionStatus.mode,
        summary: {
            totalRequiredSkills: totalRequired,
            knownSkillsCount: knownSkills.length,
            improvingSkillsCount: improvingSkills.length,
            missingSkillsCount: missingSkills.length,
            missingPrerequisitesCount: missingPrerequisitesSet.size,
            coveragePercent
        },
        recommendedNextSkill,
        knownSkills,
        improvingSkills,
        missingSkills,
        missingPrerequisites: missingPrerequisiteDetails,
        allRequiredSkills: requiredSkills,
        graphData: {
            nodes: graphNodes,
            links: graphLinks,
            cypherQuery
        }
    };
}

/**
 * Organizes the graph-derived skill gaps into structured roadmap phases.
 * Respects topological prerequisite dependencies:
 * - Phase 1: Missing Core Prerequisites & Foundations
 * - Phase 2: Core Career Capabilities
 * - Phase 3: Advanced Architectures & Systems
 * - Phase 4: Production Readiness & Ecosystem
 */
function buildGraphPersonalizedPhases(gapAnalysis) {
    const phases = [];

    // Phase 1: Missing Prerequisites or Foundation
    const p1Skills = [];
    if (gapAnalysis.missingPrerequisites.length > 0) {
        gapAnalysis.missingPrerequisites.forEach(p => p1Skills.push(p.name));
    }
    // Add beginner/fundamental required skills
    gapAnalysis.allRequiredSkills
        .filter(s => s.difficulty === 'Beginner' || s.category === 'Fundamentals')
        .forEach(s => {
            if (!p1Skills.includes(s.name)) p1Skills.push(s.name);
        });

    if (p1Skills.length === 0) {
        p1Skills.push(gapAnalysis.allRequiredSkills[0]?.name || 'Core Fundamentals');
    }

    phases.push({
        title: 'Phase 1: Foundational Prerequisites & Core Syntax',
        description: 'Master non-negotiable fundamentals and prerequisite dependencies essential for downstream mastery.',
        subtopics: p1Skills,
        skillsCount: p1Skills.length,
        status: p1Skills.every(s => gapAnalysis.knownSkills.some(k => k.name.toLowerCase() === s.toLowerCase())) ? 'completed' : 'active'
    });

    // Phase 2: Core Engineering Skills
    const p2Skills = [];
    gapAnalysis.allRequiredSkills
        .filter(s => s.importance === 'core' && !p1Skills.includes(s.name) && s.difficulty !== 'Advanced')
        .forEach(s => p2Skills.push(s.name));

    if (p2Skills.length === 0) {
        gapAnalysis.allRequiredSkills.slice(1, 4).forEach(s => {
            if (!p1Skills.includes(s.name) && !p2Skills.includes(s.name)) p2Skills.push(s.name);
        });
    }

    phases.push({
        title: 'Phase 2: Core Frameworks & Engineering Competencies',
        description: 'Build enterprise-grade components, data access pipelines, and core business architecture.',
        subtopics: p2Skills,
        skillsCount: p2Skills.length,
        status: p2Skills.every(s => gapAnalysis.knownSkills.some(k => k.name.toLowerCase() === s.toLowerCase())) ? 'completed' : 'upcoming'
    });

    // Phase 3: Advanced Architectures & Specialization
    const p3Skills = [];
    gapAnalysis.allRequiredSkills
        .filter(s => s.difficulty === 'Advanced' || s.category === 'Architecture' || s.category === 'Deep Learning')
        .forEach(s => {
            if (!p1Skills.includes(s.name) && !p2Skills.includes(s.name)) p3Skills.push(s.name);
        });

    if (p3Skills.length === 0) {
        gapAnalysis.allRequiredSkills.slice(4, 7).forEach(s => {
            if (!p1Skills.includes(s.name) && !p2Skills.includes(s.name) && !p3Skills.includes(s.name)) p3Skills.push(s.name);
        });
    }

    phases.push({
        title: 'Phase 3: Advanced Architectures & Distributed Systems',
        description: 'Scale, optimize, and secure distributed workloads, caching strategies, and advanced patterns.',
        subtopics: p3Skills,
        skillsCount: p3Skills.length,
        status: 'upcoming'
    });

    // Phase 4: Production Readiness, Tooling & Ecosystem
    const p4Skills = [];
    gapAnalysis.allRequiredSkills
        .filter(s => s.importance === 'recommended' || s.category === 'DevOps' || s.category === 'Testing' || s.category === 'Monitoring')
        .forEach(s => {
            if (!p1Skills.includes(s.name) && !p2Skills.includes(s.name) && !p3Skills.includes(s.name)) p4Skills.push(s.name);
        });

    if (p4Skills.length > 0) {
        phases.push({
            title: 'Phase 4: Production Deployment & Observability',
            description: 'Automate deployment pipelines, monitoring, containerization, and production hardening.',
            subtopics: p4Skills,
            skillsCount: p4Skills.length,
            status: 'upcoming'
        });
    }

    return phases;
}

/**
 * Generates the full roadmap object using Graph Skill Gap Analysis + AI enrichment.
 */
async function generateGraphRoadmap({ userId, role, currentSkills, groqApiKey }) {
    const gapAnalysis = await analyzeSkillGap({ userId, targetRole: role, currentSkills });
    const graphPhases = buildGraphPersonalizedPhases(gapAnalysis);

    let roadmapPhases = graphPhases;

    // If Groq AI Key is provided, use AI to synthesize high-level explanations without hallucinating skills
    if (groqApiKey) {
        try {
            console.log(`🤖 Enriching Graph Roadmap with Groq AI for ${gapAnalysis.targetRole}...`);
            const prompt = `You are a technical career architect.
I have derived the skill gaps for "${gapAnalysis.targetRole}" using a Neo4j knowledge graph.
Here are the graph-derived phases and skills:
${JSON.stringify(graphPhases, null, 2)}

User's known skills: ${JSON.stringify(gapAnalysis.knownSkills.map(s => s.name))}
Missing prerequisites: ${JSON.stringify(gapAnalysis.missingPrerequisites.map(s => s.name))}
Missing core skills: ${JSON.stringify(gapAnalysis.missingSkills.map(s => s.name))}

Return a JSON object in this exact schema:
{
  "role": "${gapAnalysis.targetRole}",
  "phases": [
    {
      "title": "Phase Title",
      "subtopics": ["Skill 1", "Skill 2"],
      "alternatives": ["Alternative tool A", "Alternative tool B"],
      "description": "2 sentence explanation of why this phase is crucial for ${gapAnalysis.targetRole}."
    }
  ]
}

STRICT INSTRUCTIONS:
- You MUST preserve all subtopics from the graph phases.
- Do NOT invent fictional technologies or unsupported concepts.
- Return ONLY valid JSON. No markdown code blocks, no other text.`;

            const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-120b",
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" }
                })
            });

            if (aiRes.ok) {
                const aiData = await aiRes.json();
                const content = aiData.choices?.[0]?.message?.content;
                const parsed = JSON.parse(content);
                if (parsed && Array.isArray(parsed.phases) && parsed.phases.length > 0) {
                    roadmapPhases = parsed.phases;
                    console.log('✅ Successfully enhanced roadmap with Groq AI!');
                }
            }
        } catch (aiErr) {
            console.warn('Groq AI enrichment encountered an error, falling back cleanly to graph synthesis:', aiErr.message);
        }
    }

    return {
        role: gapAnalysis.targetRole,
        phases: roadmapPhases,
        skillGap: gapAnalysis
    };
}

/**
 * Mark a skill as completed in the graph.
 */
async function markSkillCompleted(userId, roleName, skillName) {
    if (connectionStatus.mode === 'neo4j' && driver) {
        const session = driver.session({ database: connectionStatus.database });
        try {
            await session.run(`
                MERGE (p:Person {id: $userId})
                MERGE (s:Skill {name: $skillName})
                MERGE (p)-[h:HAS_SKILL]->(s)
                SET h.proficiency = 'advanced', h.verified = true, h.completedAt = datetime()
            `, { userId: userId || 'anonymous_guest', skillName });
        } catch (e) {
            console.error('Error marking skill completed in Neo4j:', e.message);
        } finally {
            await session.close();
        }
    }

    // Return refreshed skill gap
    return await analyzeSkillGap({ userId, targetRole: roleName, currentSkills: [{ name: skillName, proficiency: 'advanced' }] });
}

module.exports = {
    initNeo4j,
    getJobRoles,
    analyzeSkillGap,
    generateGraphRoadmap,
    markSkillCompleted,
    getStatus: () => connectionStatus,
    SEED_CATALOG
};
