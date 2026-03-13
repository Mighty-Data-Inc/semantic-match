import { OpenAI } from 'openai';
import { describe, expect, it } from 'vitest';

import { getSemanticallyDistinctGroups } from '../src/dedupe.js';
import { getItemName, type SemanticItem } from '../src/semanticItem.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
if (!OPENAI_API_KEY) {
  throw new Error(
    'OPENAI_API_KEY is required for getSemanticallyDistinctGroups live API tests. Configure your test environment to provide it.'
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

const normalizeGroupNames = (groups: SemanticItem[][]): string[][] =>
  groups
    .map((group) => [...group.map((item) => getItemName(item))].sort())
    .sort((a, b) => a.join(' | ').localeCompare(b.join(' | ')));

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

const expectValidPartition = (
  input: SemanticItem[],
  groups: SemanticItem[][]
): void => {
  const flattened = groups.flat();
  expect(flattened.length).toBe(input.length);
  expect(countSignatures(flattened)).toEqual(countSignatures(input));
};

describe('getSemanticallyDistinctGroups (live API)', () => {
  // IMPORTANT: These tests intentionally use live OpenAI calls and DO NOT mock LLMConversation.
  // We are validating prompt and structured-output behavior end-to-end for grouping.

  it('returns an empty result for empty input without requiring a valid API call', async () => {
    const results = await getSemanticallyDistinctGroups(
      createInvalidClient(),
      []
    );
    expect(results).toEqual([]);
  }, 180000);

  it('groups clear cloud-service synonym sets into expected semantic clusters', async () => {
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

    const groups = await getSemanticallyDistinctGroups(
      createClient(),
      itemList,
      'Treat acronym/expanded service names as equivalent only when they are the same service. ' +
        'Expected equivalence pairs are EC2 <-> Elastic Compute Cloud, ' +
        'S3 <-> Simple Storage Service, and EKS <-> Elastic Kubernetes Service. ' +
        'CloudFront and Route 53 are distinct singleton services.'
    );

    expectValidPartition(itemList, groups);
    expect(normalizeGroupNames(groups)).toEqual(
      normalizeGroupNames([
        ['EC2', 'Elastic Compute Cloud'],
        ['S3', 'Simple Storage Service'],
        ['EKS', 'Elastic Kubernetes Service'],
        ['CloudFront'],
        ['Route 53'],
      ])
    );
  }, 180000);

  it('follows explicit migration guidance to pair renamed fields', async () => {
    const itemList: SemanticItem[] = [
      'Customer ID',
      'Client Identifier',
      'Order Date',
      'Date of Order',
      'Total Amount',
      'Invoice Total',
    ];

    const groups = await getSemanticallyDistinctGroups(
      createClient(),
      itemList,
      'There are exactly three synonym pairs and no other overlaps: ' +
        'Customer ID <-> Client Identifier, ' +
        'Order Date <-> Date of Order, ' +
        'Total Amount <-> Invoice Total.'
    );

    expectValidPartition(itemList, groups);
    expect(normalizeGroupNames(groups)).toEqual(
      normalizeGroupNames([
        ['Customer ID', 'Client Identifier'],
        ['Order Date', 'Date of Order'],
        ['Total Amount', 'Invoice Total'],
      ])
    );
  }, 180000);

  it('keeps clearly unrelated canonical fields as singleton groups', async () => {
    const itemList: SemanticItem[] = [
      'Planet Name',
      'Invoice Due Date',
      'Blood Glucose Level',
      'Railway Station Code',
    ];

    const groups = await getSemanticallyDistinctGroups(
      createClient(),
      itemList,
      'All items belong to different domains and are not synonyms. Keep every item in its own group.'
    );

    expectValidPartition(itemList, groups);
    expect(normalizeGroupNames(groups)).toEqual(
      normalizeGroupNames([
        ['Planet Name'],
        ['Invoice Due Date'],
        ['Blood Glucose Level'],
        ['Railway Station Code'],
      ])
    );
  }, 180000);

  it('uses descriptions to disambiguate homonyms and place aliases into the right group', async () => {
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

    const groups = await getSemanticallyDistinctGroups(
      createClient(),
      itemList,
      'Group by referent, not by string name. ' +
        'Peach State refers to Georgia the U.S. state. ' +
        'Sakartvelo refers to Georgia the country.'
    );

    expectValidPartition(itemList, groups);
    expect(groups.length).toBe(2);

    const normalized = normalizeGroupNames(groups);
    expect(normalized).toEqual(
      normalizeGroupNames([
        ['Georgia', 'Peach State'],
        ['Georgia', 'Sakartvelo'],
      ])
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

    await getSemanticallyDistinctGroups(
      createClient(),
      itemList,
      'Legacy Plan Alpha and Modern Plan Alpha are semantically equivalent labels. Client ID and Customer Identifier are also equivalent.'
    );

    expect(itemList).toEqual(snapshot);
  }, 180000);
});
