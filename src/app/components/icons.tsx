import type { SVGProps } from 'react';
export type IconName =
  | 'dice'
  | 'sword'
  | 'shield'
  | 'spark'
  | 'feather'
  | 'more'
  | 'play'
  | 'pause'
  | 'stop'
  | 'repeat'
  | 'mic'
  | 'send'
  | 'close'
  | 'book'
  | 'bag'
  | 'check'
  | 'chevron'
  | 'download'
  | 'volume';
const paths: Record<IconName, string> = {
  dice: 'M12 2 22 8v9l-10 5L2 17V8L12 2Zm0 0L7 10l5 12 5-12-5-8ZM2 8l5 2h10l5-2M2 17l5-7m15 7-5-7',
  sword: 'm15 3 6 0 0 6-12 12-6-6L15 3Zm-8 10 4 4m-7-2-2 2 5 5 2-2m-4-1-3 3',
  shield: 'M12 2 21 6v6c0 5-6 9-9 10-3-1-9-5-9-10V6l9-4Zm0 5v10m-5-5h10',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
  feather:
    'M4 20 17 7m-9 9c-4 0-5-3-3-6S15 1 21 3c1 6-4 14-9 14H7m1-4 6 1m-2-5 5 1',
  more: 'M12 4h.01M12 12h.01M12 20h.01',
  play: 'm8 4 13 8-13 8V4Z',
  pause: 'M8 4v16M16 4v16',
  stop: 'M5 5h14v14H5V5Z',
  repeat: 'M20 7a9 9 0 1 0 1 9M20 2v5h-5',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-4 6v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8',
  send: 'm3 3 19 9-19 9 4-9-4-9Zm4 9h15',
  close: 'm5 5 14 14M5 19 19 5',
  book: 'M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v16',
  bag: 'M5 8h14l2 13H3L5 8Zm3 0V6a4 4 0 0 1 8 0v2',
  check: 'm4 12 5 5L20 6',
  chevron: 'm7 4 8 8-8 8',
  download: 'M12 2v13m-5-5 5 5 5-5M3 16v5h18v-5',
  volume: 'm11 3-6 5H2v8h3l6 5V3Zm5 3a8 8 0 0 1 0 12m3-15a12 12 0 0 1 0 18',
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 4 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
