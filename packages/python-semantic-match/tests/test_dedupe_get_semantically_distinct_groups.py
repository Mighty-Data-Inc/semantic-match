import copy
import json
import os
import sys
import unittest
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


from mightydatainc_semantic_match import SemanticItem, get_item_name
from mightydatainc_semantic_match.dedupe import get_semantically_distinct_groups


print(f"Loading .env from CWD={os.getcwd()}")
load_dotenv()


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is required for get_semantically_distinct_groups live API tests. "
        "Configure your test environment to provide it."
    )


def create_client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY, timeout=30.0)


def create_intentionally_invalid_client(suffix: str) -> OpenAI:
    return OpenAI(api_key=f"{OPENAI_API_KEY}-{suffix}", timeout=30.0)


def normalize_group_names(groups: list[list[SemanticItem]]) -> list[list[str]]:
    return sorted(
        [sorted([get_item_name(item) for item in group]) for group in groups],
        key=lambda item_names: " | ".join(item_names),
    )


def item_signature(item: SemanticItem) -> str:
    if isinstance(item, str):
        return f"string:{item}"
    return f"object:{json.dumps(item)}"


def count_signatures(items: list[SemanticItem]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        signature = item_signature(item)
        counts[signature] = counts.get(signature, 0) + 1
    return counts


def expect_valid_partition(
    input_items: list[SemanticItem], groups: list[list[SemanticItem]]
) -> None:
    flattened = [item for group in groups for item in group]
    assert len(flattened) == len(input_items)
    assert count_signatures(flattened) == count_signatures(input_items)


class GetSemanticallyDistinctGroupsLiveAPITests(unittest.TestCase):
    # IMPORTANT: These tests intentionally use live OpenAI calls and DO NOT mock LLMConversation.
    # We are validating prompt and structured-output behavior end-to-end for grouping.

    def test_returns_empty_result_for_empty_input_without_requiring_valid_api_call(
        self,
    ):
        results = get_semantically_distinct_groups(
            create_intentionally_invalid_client(
                "INTENTIONALLY-INVALID-FOR-EMPTY-LIST-TEST"
            ),
            [],
        )
        self.assertEqual(results, [])

    def test_groups_clear_cloud_service_synonym_sets_into_expected_semantic_clusters(
        self,
    ):
        item_list: list[SemanticItem] = [
            "EC2",
            "Elastic Compute Cloud",
            "S3",
            "Simple Storage Service",
            "EKS",
            "Elastic Kubernetes Service",
            "CloudFront",
            "Route 53",
        ]

        groups = get_semantically_distinct_groups(
            create_client(),
            item_list,
            "Treat acronym/expanded service names as equivalent only when they are the same service. "
            + "Expected equivalence pairs are EC2 <-> Elastic Compute Cloud, "
            + "S3 <-> Simple Storage Service, and EKS <-> Elastic Kubernetes Service. "
            + "CloudFront and Route 53 are distinct singleton services.",
        )

        expect_valid_partition(item_list, groups)
        self.assertEqual(
            normalize_group_names(groups),
            normalize_group_names(
                [
                    ["EC2", "Elastic Compute Cloud"],
                    ["S3", "Simple Storage Service"],
                    ["EKS", "Elastic Kubernetes Service"],
                    ["CloudFront"],
                    ["Route 53"],
                ]
            ),
        )

    def test_follows_explicit_migration_guidance_to_pair_renamed_fields(self):
        item_list: list[SemanticItem] = [
            "Customer ID",
            "Client Identifier",
            "Order Date",
            "Date of Order",
            "Total Amount",
            "Invoice Total",
        ]

        groups = get_semantically_distinct_groups(
            create_client(),
            item_list,
            "There are exactly three synonym pairs and no other overlaps: "
            + "Customer ID <-> Client Identifier, "
            + "Order Date <-> Date of Order, "
            + "Total Amount <-> Invoice Total.",
        )

        expect_valid_partition(item_list, groups)
        self.assertEqual(
            normalize_group_names(groups),
            normalize_group_names(
                [
                    ["Customer ID", "Client Identifier"],
                    ["Order Date", "Date of Order"],
                    ["Total Amount", "Invoice Total"],
                ]
            ),
        )

    def test_keeps_clearly_unrelated_canonical_fields_as_singleton_groups(self):
        item_list: list[SemanticItem] = [
            "Planet Name",
            "Invoice Due Date",
            "Blood Glucose Level",
            "Railway Station Code",
        ]

        groups = get_semantically_distinct_groups(
            create_client(),
            item_list,
            "All items belong to different domains and are not synonyms. Keep every item in its own group.",
        )

        expect_valid_partition(item_list, groups)
        self.assertEqual(
            normalize_group_names(groups),
            normalize_group_names(
                [
                    ["Planet Name"],
                    ["Invoice Due Date"],
                    ["Blood Glucose Level"],
                    ["Railway Station Code"],
                ]
            ),
        )

    def test_uses_descriptions_to_disambiguate_homonyms_and_place_aliases_into_the_right_group(
        self,
    ):
        item_list: list[SemanticItem] = [
            {
                "name": "Georgia",
                "description": "A U.S. state in the southeastern United States. Capital: Atlanta.",
            },
            {
                "name": "Georgia",
                "description": "A sovereign country in the South Caucasus. Capital: Tbilisi.",
            },
            {
                "name": "Peach State",
                "description": "Nickname for the U.S. state of Georgia.",
            },
            {
                "name": "Sakartvelo",
                "description": "Endonym for the country of Georgia.",
            },
        ]

        groups = get_semantically_distinct_groups(
            create_client(),
            item_list,
            "Group by referent, not by string name. "
            + "Peach State refers to Georgia the U.S. state. "
            + "Sakartvelo refers to Georgia the country.",
        )

        expect_valid_partition(item_list, groups)
        self.assertEqual(len(groups), 2)

        normalized = normalize_group_names(groups)
        self.assertEqual(
            normalized,
            normalize_group_names(
                [
                    ["Georgia", "Peach State"],
                    ["Georgia", "Sakartvelo"],
                ]
            ),
        )

    def test_does_not_mutate_caller_provided_input_array(self):
        item_list: list[SemanticItem] = [
            "Legacy Plan Alpha",
            "Modern Plan Alpha",
            {
                "name": "Client ID",
                "description": "Unique identifier for a customer record.",
            },
            {
                "name": "Customer Identifier",
                "description": "Same concept as Client ID.",
            },
        ]

        snapshot = copy.deepcopy(item_list)

        get_semantically_distinct_groups(
            create_client(),
            item_list,
            "Legacy Plan Alpha and Modern Plan Alpha are semantically equivalent labels. Client ID and Customer Identifier are also equivalent.",
        )

        self.assertEqual(item_list, snapshot)


if __name__ == "__main__":
    unittest.main()
