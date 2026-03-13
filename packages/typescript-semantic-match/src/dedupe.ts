import {
  areItemsEqual,
  getItemName,
  itemToPromptString,
  SemanticItem,
} from './semanticItem.js';
import { findSemanticMatch } from './findSemanticMatch.js';
import {
  JSONSchemaFormat,
  LLMConversation,
} from '@mightydatainc/llm-conversation';

/**
 * Groups items into semantically distinct clusters.
 *
 * Starting from the first remaining item, this function repeatedly searches for
 * semantic matches among the ungrouped items and collects them into the same
 * group. Each returned inner array represents items that should be treated as
 * semantically equivalent, even if their names are not exact string matches.
 *
 * @param aiClient An instance of the AI client to use for LLM interactions.
 * @param itemList The items to partition into semantically equivalent groups.
 * The input array is not mutated.
 * @param explanation Optional explanation that provides domain context to help
 * the model determine whether items should be grouped together.
 *
 * @returns An array of groups, where each group contains items considered
 * semantically equivalent to one another.
 */
export const getSemanticallyDistinctGroups = async (
  aiClient: any,
  itemList: SemanticItem[],
  explanation?: string
): Promise<SemanticItem[][]> => {
  const groups: SemanticItem[][] = [];

  // Create a shallow copy of items.
  // We'll be popping it like a queue.
  itemList = [...itemList];

  if (itemList.length === 0) {
    return groups;
  }

  const convoBase = new LLMConversation(aiClient);
  convoBase.addSystemMessage(`
You are a data analyst who has been hired to try to preserve the integrity of a list of
data items. Your job is to group together items that represent the same thing -- i.e.
items that are synonyms or alternate wordings for the same referent.

Example: 
INPUT: [
  "butterfly", 
  "lightning bug", 
  "monarch butterfly",
  "ladybug",
  "drosophila melanogaster",
  "fruit fly",
  "firefly",
  "dragonfly"
]
OUTPUT: [
  ["butterfly", "monarch butterfly"],
  ["lightning bug", "firefly"],
  ["drosophila melanogaster", "fruit fly"],
  ["ladybug"],
  ["dragonfly"]
]

The user will show you a list of items. I will then guide you through a step-by-step process
to compare each item to the others and determine whether it should be grouped together with
any of the other items based on semantic equivalence.
`);

  if (explanation) {
    convoBase.addSystemMessage(`
Here is some additional information that may help you make better decisions about what the
items are and what they're supposed to mean or represent.

${explanation}
`);
  }

  let sList = '';
  for (let iItem = 0; iItem < itemList.length; iItem++) {
    const item = itemList[iItem];
    sList += `- ITEM #${iItem + 1}. ${itemToPromptString(item)}\n`;
  }

  convoBase.addUserMessage(`
Here is the list of items:

${sList}
`);

  convoBase.addUserMessage(`
Before we begin iterating through each of the items, I'd like you to examine this list
holistically and see if any duplicates, repetitions, synonyms, or equivalences jump out
at you. Please note them now, so that we can refer back to them as we go through the items
one by one; they'll be helpful to keep in mind for later comparisons.
`);
  await convoBase.submit();

  let numItemsProcessed = 0;
  while (itemList.length > 0) {
    const item = itemList.shift()!;
    numItemsProcessed++;

    // If it's the first group, just push it without asking the model to compare, since there's nothing to compare it to yet.
    if (groups.length === 0) {
      groups.push([item]);
      continue;
    }

    const convo = convoBase.clone();
    let sGroupMsg = `So far, we've examined ${numItemsProcessed - 1} items.\n\n`;
    sGroupMsg += `We've grouped them as follows:\n`;

    for (let iGroup = 0; iGroup < groups.length; iGroup++) {
      const group = groups[iGroup];
      sGroupMsg += `\n- GROUP #${iGroup + 1}:\n`;

      for (const itemInGroup of group) {
        sGroupMsg += `  - ${itemToPromptString(itemInGroup)}\n`;
      }
    }
    convo.addUserMessage(sGroupMsg);

    convo.addUserMessage(`
We now present, for your consideration, the next item to examine:

- ${itemToPromptString(item)}
`);
    convo.addUserMessage(`
The question I ask of you is this: 
Is this item semantically equal to any of the items we've already examined and grouped together so far?
In other words, is it a duplicate, synonym, alternate wording, or semantically equivalent item to any
of the items we've seen before? Or, is it so far unique -- its own entity, different and distinct
from all that came before it?
Discuss, and then respond with a conclusion.
`);
    await convo.submit(undefined, undefined, {
      jsonResponse: JSONSchemaFormat({
        discussion:
          `A field where you talk about how this new item compares to previous ones, ` +
          `and a weighing of the pros and cons of grouping it with any of the previous items ` +
          `versus keeping it separate.\n\n`,
        conclusion:
          `Your conclusion about whether this item is semantically equivalent to any of ` +
          `the previous items, and if so, which one(s). If it's not equivalent to any previous item, ` +
          `say that it's unique.`,
        matches_existing_group: [
          Boolean,
          `True if you've determined that this item is indeed semantically equivalent to ` +
            `a previous item and should be grouped together with it. False if it's unique ` +
            `and should be in its own group.`,
        ],
        group_to_join: [
          Number,
          `If you've determined that this item is semantically equivalent to a previous item and ` +
            `should be grouped together with it, then indicate the group number (as indicated ` +
            `by "GROUP #") of the group that it should be added to. If you've determined that ` +
            `this item is unique and should not be grouped with any previous items, set this to -1.`,
        ],
      }),
    });
    const matchesExistingGroup = convo.getLastReplyDictField(
      'matches_existing_group'
    ) as boolean;
    const groupToJoin = convo.getLastReplyDictField('group_to_join') as number;
    const groupIndex = groupToJoin - 1;
    const hasValidGroupIndex =
      Number.isInteger(groupToJoin) &&
      groupIndex >= 0 &&
      groupIndex < groups.length;

    if (matchesExistingGroup && hasValidGroupIndex) {
      groups[groupIndex].push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups;
};

/**
 * Removes semantic duplicates from a list by keeping one representative item
 * from each semantic-equivalence group.
 *
 * This function first groups items using `getSemanticallyDistinctGroups`, then
 * returns the first item from each group as the deduplicated output.
 *
 * @param aiClient An instance of the AI client to use for LLM interactions.
 * @param itemList The list of items to deduplicate semantically.
 * @param explanation Optional explanation that provides domain context to help
 * the model decide which items are semantically equivalent.
 *
 * @returns A deduplicated list containing one representative item per semantic
 * group.
 */
export const removeSemanticDuplicates = async (
  aiClient: any,
  itemList: SemanticItem[],
  explanation?: string
): Promise<SemanticItem[]> => {
  const groups = await getSemanticallyDistinctGroups(
    aiClient,
    itemList,
    explanation
  );
  const retval = groups.map((group) => group[0]);
  return retval;
};
