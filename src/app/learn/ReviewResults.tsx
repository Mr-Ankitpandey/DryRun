import { Link } from 'wouter';
import type { ItemResult } from './review';
import { resultLine } from './review';
import { sectionTitle, textLink } from './styles';

export interface ReviewResultsProps {
  results: readonly ItemResult[];
  heading: string;
}

/** The result lines of the re-traces finished so far. */
export function ReviewResults({ results, heading }: ReviewResultsProps) {
  return (
    <div className="mt-8">
      <h2 className={sectionTitle}>{heading}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {results.map((r, i) => (
          <li key={`${r.algorithm}-${i}`} data-testid="review-result" className="text-base text-ink">
            {resultLine(r)}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-2">
        Every mistake is saved in your{' '}
        <Link href="/mistakes" className={textLink}>
          mistake bank
        </Link>
        .
      </p>
    </div>
  );
}
