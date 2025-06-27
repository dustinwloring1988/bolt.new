# Project Feature Implementation Plan

This document outlines actionable steps to implement the following features in this project, referencing similar implementations in [bolt.diy](https://github.com/stackblitz-labs/bolt.diy). Each section includes a summary, step-by-step plan, and example code or file references where appropriate.

---

## 1. feat: Use Starter Templates on New Projects
**Reference:** [PR #884](https://github.com/stackblitz-labs/bolt.diy/pull/884) & [PR #867](https://github.com/stackblitz-labs/bolt.diy/pull/867)

[
  {
    name: 'NextJS Shadcn',
    label: 'Next.js with shadcn/ui',
    description: 'Next.js starter fullstack template integrated with shadcn/ui components and styling system',
    githubRepo: 'xKevIsDev/bolt-nextjs-shadcn-template',
    tags: ['nextjs', 'react', 'typescript', 'shadcn', 'tailwind'],
    icon: 'i-bolt:nextjs',
  },
  {
    name: 'Vite Shadcn',
    label: 'Vite with shadcn/ui',
    description: 'Vite starter fullstack template integrated with shadcn/ui components and styling system',
    githubRepo: 'xKevIsDev/vite-shadcn',
    tags: ['vite', 'react', 'typescript', 'shadcn', 'tailwind'],
    icon: 'i-bolt:shadcn',
  },
  {
    name: 'Remix Typescript',
    label: 'Remix TypeScript',
    description: 'Remix framework starter with TypeScript for full-stack web applications',
    githubRepo: 'xKevIsDev/bolt-remix-ts-template',
    tags: ['remix', 'typescript', 'fullstack', 'react'],
    icon: 'i-bolt:remix',
  },
  {
    name: 'Vanilla Vite',
    label: 'Vanilla + Vite',
    description: 'Minimal Vite starter template for vanilla JavaScript projects',
    githubRepo: 'xKevIsDev/vanilla-vite-template',
    tags: ['vite', 'vanilla-js', 'minimal'],
    icon: 'i-bolt:vite',
  },
  {
    name: 'Vite React',
    label: 'React + Vite + typescript',
    description: 'React starter template powered by Vite for fast development experience',
    githubRepo: 'xKevIsDev/bolt-vite-react-ts-template',
    tags: ['react', 'vite', 'frontend', 'website', 'app'],
    icon: 'i-bolt:react',
  },
  {
    name: 'Vite Typescript',
    label: 'Vite + TypeScript',
    description: 'Vite starter template with TypeScript configuration for type-safe development',
    githubRepo: 'xKevIsDev/bolt-vite-ts-template',
    tags: ['vite', 'typescript', 'minimal'],
    icon: 'i-bolt:typescript',
  },
];

---

## 2. feat: Add GitHub Integration
**Reference:** https://github.com/stackblitz-labs/bolt.diy/pull/1111, https://github.com/stackblitz-labs/bolt.diy/pull/1618, https://github.com/stackblitz-labs/bolt.diy/pull/1685

---

## 3. feat: Generate Mobile Apps with Expo
**Reference:** [PR #1651](https://github.com/stackblitz-labs/bolt.diy/pull/1651)

---

## 4. feat: Diff View
**Reference:** [PR #1367](https://github.com/stackblitz-labs/bolt.diy/pull/1367)

---

## 5. feat: Discuss Mode
**Reference:** [PR #1735](https://github.com/stackblitz-labs/bolt.diy/pull/1735)

---

## 6. feat: Attach Images
**Reference:** [PR #332](https://github.com/stackblitz-labs/bolt.diy/pull/332)

---

## 7. feat: Rewind and Checkpoint
**Reference:** [PR #305](https://github.com/stackblitz-labs/bolt.diy/pull/305)

---

## 8. refactor: migrate snapshot storage from localStorage to IndexedDB 
**Reference:** [Commit fe37f5ceea48e6110fffc06996962e40796de795](https://github.com/stackblitz-labs/bolt.diy/commit/fe37f5ceea48e6110fffc06996962e40796de795)
