import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'REMQ',
  description:
    'Redis Enhanced Message Queue - A high-performance message queue system for Deno',
  base: '/',

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.png',
    siteTitle: 'REMQ',

    nav: [
      { text: 'Docs', link: '/guide/' },
      {
        text: 'GitHub',
        link: 'https://github.com/mirairoad/tempotask',
        target: '_blank',
      },
      {
        text: 'JSR',
        link: 'https://jsr.io/@leotermine/tasker',
        target: '_blank',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Task Management', link: '/guide/task-management' },
            { text: 'Message Queues', link: '/guide/message-queues' },
            { text: 'Consumers', link: '/guide/consumers' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'TaskManager', link: '/reference/task-manager' },
            { text: 'Consumer', link: '/reference/consumer' },
            { text: 'Processor', link: '/reference/processor' },
          ],
        },
      ],
    },

    darkModeSwitchLabel: 'Appearance',

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024',
    },
  },
});

