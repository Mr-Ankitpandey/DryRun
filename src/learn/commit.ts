/** Glue between a finished trace Session and the Store: one pure call records
 *  the session, its mistakes and the Leitner update. Screens call this, then save. */

import type { MistakeRecord, ReviewItem, SessionRecord, Store } from '@/lib/storage';
import { appendMistakes, appendSession, touch, upsertReview } from '@/lib/storage';
import type { Session } from '@/trace/session';
import { mistakeRecords, sessionRecord, sessionScore } from '@/trace/session';
import { afterSession, enroll } from './scheduler';

export interface CommitResult {
  store: Store;
  record: SessionRecord;
  mistakes: MistakeRecord[];
  /** The review item after this session (unchanged when nothing was asked). */
  review: ReviewItem;
}

/** Marks an algorithm as started: enrols it for review if it is new and stamps activity at `now`. */
export function startAlgorithm(store: Store, algorithm: string, now: number): Store {
  const next = touch(store, now);
  return store.review[algorithm] ? next : upsertReview(next, enroll(algorithm, now));
}

/** Records a finished session: appends the SessionRecord and MistakeRecords, updates the review box from the score (no asks → enrol only). */
export function commitSession(store: Store, session: Session, finishedAt: number): CommitResult {
  const record = sessionRecord(session, finishedAt);
  const mistakes = mistakeRecords(session);
  const algorithm = session.meta.algorithm;
  const score = sessionScore(session);
  const existing = store.review[algorithm];
  const review = score === null ? (existing ?? enroll(algorithm, finishedAt)) : afterSession(existing, algorithm, score, finishedAt);
  const next = touch(upsertReview(appendMistakes(appendSession(store, record), mistakes), review), finishedAt);
  return { store: next, record, mistakes, review };
}
