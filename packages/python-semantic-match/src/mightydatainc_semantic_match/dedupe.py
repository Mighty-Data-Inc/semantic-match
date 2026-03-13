"""Semantic grouping for item lists."""

from __future__ import annotations

from typing import Any, Sequence

from mightydatainc_llm_conversation import JSONSchemaFormat, LLMConversation

from .semantic_item import SemanticItem, item_to_prompt_string


def get_semantically_distinct_groups(
    ai_client: Any,
    item_list: Sequence[SemanticItem],
    explanation: str | None = None,
) -> list[list[SemanticItem]]:
    """Group items into semantically distinct clusters."""
    groups: list[list[SemanticItem]] = []

    # Create a shallow copy of items.
    # We'll be popping it like a queue.
    item_list = list(item_list)

    if len(item_list) == 0:
        return groups

    convo_base = LLMConversation(ai_client)
    convo_base.add_system_message(
        """
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
"""
    )

    if explanation:
        convo_base.add_system_message(
            f"""
Here is some additional information that may help you make better decisions about what the
items are and what they're supposed to mean or represent.

{explanation}
"""
        )

    serialized_list = ""
    for index, item in enumerate(item_list):
        serialized_list += f"- ITEM #{index + 1}. {item_to_prompt_string(item)}\\n"

    convo_base.add_user_message(
        f"""
Here is the list of items:

{serialized_list}
"""
    )

    convo_base.add_user_message(
        """
Before we begin iterating through each of the items, I'd like you to examine this list
holistically and see if any duplicates, repetitions, synonyms, or equivalences jump out
at you. Please note them now, so that we can refer back to them as we go through the items
one by one; they'll be helpful to keep in mind for later comparisons.
"""
    )
    convo_base.submit()

    num_items_processed = 0
    while len(item_list) > 0:
        item = item_list.pop(0)
        num_items_processed += 1

        # If it's the first group, just push it without asking the model to compare, since there's nothing to compare it to yet.
        if len(groups) == 0:
            groups.append([item])
            continue

        convo = convo_base.clone()
        group_message = f"So far, we've examined {num_items_processed - 1} items.\\n\\n"
        group_message += "We've grouped them as follows:\\n"

        for group_index, group in enumerate(groups):
            group_message += f"\\n- GROUP #{group_index + 1}:\\n"

            for item_in_group in group:
                group_message += f"  - {item_to_prompt_string(item_in_group)}\\n"
        convo.add_user_message(group_message)

        convo.add_user_message(
            f"""
We now present, for your consideration, the next item to examine:

- {item_to_prompt_string(item)}
"""
        )
        convo.add_user_message(
            """
The question I ask of you is this:
Is this item semantically equal to any of the items we've already examined and grouped together so far?
In other words, is it a duplicate, synonym, alternate wording, or semantically equivalent item to any
of the items we've seen before? Or, is it so far unique -- its own entity, different and distinct
from all that came before it?
Discuss, and then respond with a conclusion.
"""
        )
        convo.submit(
            json_response=JSONSchemaFormat(
                {
                    "discussion": "A field where you talk about how this new item compares to previous ones, "
                    + "and a weighing of the pros and cons of grouping it with any of the previous items "
                    + "versus keeping it separate.\\n\\n",
                    "conclusion": "Your conclusion about whether this item is semantically equivalent to any of "
                    + "the previous items, and if so, which one(s). If it's not equivalent to any previous item, "
                    + "say that it's unique.",
                    "matches_existing_group": (
                        bool,
                        "True if you've determined that this item is indeed semantically equivalent to "
                        + "a previous item and should be grouped together with it. False if it's unique "
                        + "and should be in its own group.",
                    ),
                    "group_to_join": (
                        int,
                        "If you've determined that this item is semantically equivalent to a previous item and "
                        + "should be grouped together with it, then indicate the group number (as indicated "
                        + 'by "GROUP #") of the group that it should be added to. If you\'ve determined that '
                        + "this item is unique and should not be grouped with any previous items, set this to -1.",
                    ),
                }
            )
        )
        matches_existing_group = convo.get_last_reply_dict_field(
            "matches_existing_group"
        )
        group_to_join = convo.get_last_reply_dict_field("group_to_join")
        group_index = group_to_join - 1 if isinstance(group_to_join, int) else -1
        has_valid_group_index = (
            isinstance(group_to_join, int)
            and group_index >= 0
            and group_index < len(groups)
        )

        if matches_existing_group and has_valid_group_index:
            groups[group_index].append(item)
        else:
            groups.append([item])

    return groups
