import type { MessageKey } from './messages';
export interface FeaturedGame {
  readonly id: string;
  readonly title: MessageKey;
  readonly description: MessageKey;
  readonly emblem: string;
}
/** Playable games shown on Home so a child can start one without the world map. */
export const featuredGames: readonly FeaturedGame[] = [
  {
    id: 'defend-fairy-castle',
    title: 'fairyCastle',
    description: 'fairyBattleDescription',
    emblem: '🏰',
  },
  {
    id: 'hungry-crocodile',
    title: 'crocodileLevel',
    description: 'crocodileDescription',
    emblem: '🐊',
  },
];
