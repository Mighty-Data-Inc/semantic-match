import { OpenAI } from 'openai';
import { describe, expect, it } from 'vitest';

import { removeSemanticDuplicates } from '../src/dedupe.js';
import { getItemName, type SemanticItem } from '../src/semanticItem.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
if (!OPENAI_API_KEY) {
  throw new Error(
    'OPENAI_API_KEY is required for removeSemanticDuplicates live API tests. Configure your test environment to provide it.'
  );
}

const createClient = (): OpenAI =>
  new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

const createInvalidClient = (): OpenAI =>
  new OpenAI({
    apiKey: `${OPENAI_API_KEY}-INTENTIONALLY-INVALID-FOR-EMPTY-LIST-TEST`,
  });

const normalizeNames = (items: SemanticItem[]): string[] =>
  [...items.map((item) => getItemName(item))].sort();

const itemSignature = (item: SemanticItem): string => {
  if (typeof item === 'string') {
    return `string:${item}`;
  }
  return `object:${JSON.stringify(item)}`;
};

const countSignatures = (items: SemanticItem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const sig = itemSignature(item);
    counts.set(sig, (counts.get(sig) || 0) + 1);
  }
  return counts;
};

const expectItemsAreSubsetOfInput = (
  input: SemanticItem[],
  deduped: SemanticItem[]
): void => {
  const inputCounts = countSignatures(input);
  const dedupedCounts = countSignatures(deduped);

  for (const [sig, dedupedCount] of dedupedCounts.entries()) {
    expect(inputCounts.has(sig)).toBe(true);
    expect(dedupedCount).toBeLessThanOrEqual(inputCounts.get(sig) || 0);
  }
};

describe('removeSemanticDuplicates (live API)', () => {
  // IMPORTANT: These tests intentionally use live OpenAI calls and DO NOT mock LLMConversation.
  // We are validating prompt and structured-output behavior end-to-end for semantic deduplication.

  it('returns an empty result for empty input without requiring a valid API call', async () => {
    const results = await removeSemanticDuplicates(createInvalidClient(), []);
    expect(results).toEqual([]);
  }, 180000);

  it('deduplicates clear cloud-service synonym sets', async () => {
    const itemList: SemanticItem[] = [
      'EC2',
      'Elastic Compute Cloud',
      'S3',
      'Simple Storage Service',
      'EKS',
      'Elastic Kubernetes Service',
      'CloudFront',
      'Route 53',
    ];

    const deduped = await removeSemanticDuplicates(
      createClient(),
      itemList,
      'Treat acronym/expanded service names as equivalent only when they are the same service. ' +
        'Expected equivalence pairs are EC2 <-> Elastic Compute Cloud, ' +
        'S3 <-> Simple Storage Service, and EKS <-> Elastic Kubernetes Service. ' +
        'CloudFront and Route 53 are distinct singleton services.'
    );

    expectItemsAreSubsetOfInput(itemList, deduped);
    expect(normalizeNames(deduped)).toEqual(
      normalizeNames(['EC2', 'S3', 'EKS', 'CloudFront', 'Route 53'])
    );
  }, 180000);

  it('follows explicit migration guidance to remove renamed duplicates', async () => {
    const itemList: SemanticItem[] = [
      'Customer ID',
      'Client Identifier',
      'Order Date',
      'Date of Order',
      'Total Amount',
      'Invoice Total',
    ];

    const deduped = await removeSemanticDuplicates(
      createClient(),
      itemList,
      'There are exactly three synonym pairs and no other overlaps: ' +
        'Customer ID <-> Client Identifier, ' +
        'Order Date <-> Date of Order, ' +
        'Total Amount <-> Invoice Total.'
    );

    expectItemsAreSubsetOfInput(itemList, deduped);
    expect(normalizeNames(deduped)).toEqual(
      normalizeNames(['Customer ID', 'Order Date', 'Total Amount'])
    );
  }, 180000);

  it('keeps clearly unrelated canonical fields unchanged', async () => {
    const itemList: SemanticItem[] = [
      'Planet Name',
      'Invoice Due Date',
      'Blood Glucose Level',
      'Railway Station Code',
    ];

    const deduped = await removeSemanticDuplicates(
      createClient(),
      itemList,
      'All items belong to different domains and are not synonyms. Keep every item in its own group.'
    );

    expectItemsAreSubsetOfInput(itemList, deduped);
    expect(normalizeNames(deduped)).toEqual(normalizeNames(itemList));
  }, 180000);

  it('uses descriptions to disambiguate homonyms and retain one representative per referent', async () => {
    const itemList: SemanticItem[] = [
      {
        name: 'Georgia',
        description:
          'A U.S. state in the southeastern United States. Capital: Atlanta.',
      },
      {
        name: 'Georgia',
        description:
          'A sovereign country in the South Caucasus. Capital: Tbilisi.',
      },
      {
        name: 'Peach State',
        description: 'Nickname for the U.S. state of Georgia.',
      },
      {
        name: 'Sakartvelo',
        description: 'Endonym for the country of Georgia.',
      },
    ];

    const deduped = await removeSemanticDuplicates(
      createClient(),
      itemList,
      'Group by referent, not by string name. ' +
        'Peach State refers to Georgia the U.S. state. ' +
        'Sakartvelo refers to Georgia the country.'
    );

    expectItemsAreSubsetOfInput(itemList, deduped);
    expect(deduped).toHaveLength(2);
    expect(countSignatures(deduped)).toEqual(
      countSignatures([itemList[0], itemList[1]])
    );
  }, 180000);

  it('does not mutate the caller-provided input array', async () => {
    const itemList: SemanticItem[] = [
      'Legacy Plan Alpha',
      'Modern Plan Alpha',
      {
        name: 'Client ID',
        description: 'Unique identifier for a customer record.',
      },
      {
        name: 'Customer Identifier',
        description: 'Same concept as Client ID.',
      },
    ];

    const snapshot = JSON.parse(JSON.stringify(itemList));

    await removeSemanticDuplicates(
      createClient(),
      itemList,
      'Legacy Plan Alpha and Modern Plan Alpha are semantically equivalent labels. Client ID and Customer Identifier are also equivalent.'
    );

    expect(itemList).toEqual(snapshot);
  }, 180000);
});
