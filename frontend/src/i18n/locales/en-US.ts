import type { TranslationDictionary } from '../types';

const enUS: TranslationDictionary = {
  common: {
    logo: 'MindFlow',
    language: 'Language',
    chinese: '中文',
    english: 'English',
  },
  nav: {
    dailyDigest: 'Daily Digest',
    now: 'Now',
    articles: 'Articles',
    interests: 'Interests',
    sources: 'Sources',
    settings: 'Settings',
    searchPlaceholder: 'Search articles...',
    curatedBrief: 'Curated Daily Brief',
    help: 'Help',
    privacy: 'Privacy',
    user: 'User',
    curatorTier: 'Curator Tier',
  },
  now: {
    header: {
      flow: 'Daily Digest → Detail → Read Source',
      title: 'Now Workbench',
      description:
        'Prioritized reading for the items that still matter right now. Open one item, read the synthesis, decide whether it is handled, then move on to the next signal.',
    },
    errors: {
      loadWorkbench: 'Something went wrong while loading the workbench.',
      loadDetail: 'Something went wrong while loading detail content.',
      updateState: 'Unable to update state. Please try again.',
    },
    actions: {
      expandQueue: 'Expand queue',
      collapseQueue: 'Collapse queue',
      markRead: 'Mark read',
      markedRead: 'Marked read',
      markProcessed: 'Mark processed',
      readSource: 'Read Source',
      sourceUnavailable: 'Source unavailable',
      updating: 'Updating…',
    },
    labels: {
      read: 'Read',
      processed: 'Processed',
      score: 'score',
    },
    zones: {
      main: 'Main',
      explore: 'Explore',
      discover: 'Discover',
    },
    context: {
      posture: 'Workbench posture',
      title: 'Now',
      description: 'A short-horizon queue for the items that still deserve attention in the next 24–48 hours.',
      queue: 'Queue',
      activeItems: 'active items',
      unread: 'Unread',
      notMarkedRead: 'not marked read',
      lastRefresh: 'Last refresh',
      unknown: 'Unknown',
      arrivalContext: 'Arrival context',
      openedFromPrefix: 'Opened from the',
      openedFromSuffix: 'for',
      signalMap: 'Signal map',
      selectItemHint: 'Select an item to see its source context and current signal posture.',
      topTags: 'Top tags in queue',
      noTags: 'No tags available yet.',
    },
    queue: {
      title: 'Queue',
      priorityStack: 'Priority stack',
      empty: 'No active items remain in the queue.',
      noDate: 'No date',
    },
    detail: {
      title: 'Detail reader',
      chooseItem: 'Choose an item from the queue',
      chooseItemHint: 'The selected item will expand into summary, body, and action controls here.',
      unknownPublicationTime: 'Unknown publication time',
      aiSummary: 'AI Summary',
      dialecticalAnalysis: 'Dialectical analysis',
    },
  },
};

export default enUS;
