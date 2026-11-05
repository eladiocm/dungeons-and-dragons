import { Fragment, memo, useMemo } from 'react';
import { narrationWords } from '@/lib/narration-progress';
export const NarratedText = memo(function NarratedText({
  text,
  activeWord = -1,
}: {
  text: string;
  activeWord?: number;
}) {
  const words = useMemo(() => narrationWords(text), [text]);
  return (
    <div className="story-text">
      {words.map((word, index) => (
        <Fragment key={word.start}>
          {text.slice(index ? words[index - 1].end : 0, word.start)}
          <span
            className={`spoken-word${index === activeWord ? ' active' : ''}`}
            data-word={index}
          >
            {word.text}
          </span>
        </Fragment>
      ))}
      {text.slice(words.at(-1)?.end || 0)}
    </div>
  );
});
