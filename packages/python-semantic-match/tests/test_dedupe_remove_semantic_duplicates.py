import copy
import importlib
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


semantic_match_module = importlib.import_module("mightydatainc_semantic_match")
dedupe_module = importlib.import_module("mightydatainc_semantic_match.dedupe")

SemanticItem = semantic_match_module.SemanticItem
get_item_name = semantic_match_module.get_item_name
remove_semantic_duplicates = dedupe_module.remove_semantic_duplicates


print(f"Loading .env from CWD={os.getcwd()}")
load_dotenv()


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is required for remove_semantic_duplicates live API tests. "
        "Configure your test environment to provide it."
    )


def create_client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY, timeout=30.0)


def create_intentionally_invalid_client(suffix: str) -> OpenAI:
    return OpenAI(api_key=f"{OPENAI_API_KEY}-{suffix}", timeout=30.0)


def normalize_names(items: list[SemanticItem]) -> list[str]:
    return sorted([get_item_name(item) for item in items])


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


def expect_items_are_subset_of_input(
    input_items: list[SemanticItem], deduped: list[SemanticItem]
) -> None:
    input_counts = count_signatures(input_items)
    deduped_counts = count_signatures(deduped)

    for signature, deduped_count in deduped_counts.items():
        assert signature in input_counts
        assert deduped_count <= input_counts.get(signature, 0)


class RemoveSemanticDuplicatesLiveAPITests(unittest.TestCase):
    # IMPORTANT: These tests intentionally use live OpenAI calls and DO NOT mock LLMConversation.
    # We are validating prompt and structured-output behavior end-to-end for semantic deduplication.

    def test_returns_empty_result_for_empty_input_without_requiring_valid_api_call(
        self,
    ):
        results = remove_semantic_duplicates(
            create_intentionally_invalid_client(
                "INTENTIONALLY-INVALID-FOR-EMPTY-LIST-TEST"
            ),
            [],
        )
        self.assertEqual(results, [])

    def test_deduplicates_clear_cloud_service_synonym_sets(self):
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

        deduped = remove_semantic_duplicates(
            create_client(),
            item_list,
            "Treat acronym/expanded service names as equivalent only when they are the same service. "
            + "Expected equivalence pairs are EC2 <-> Elastic Compute Cloud, "
            + "S3 <-> Simple Storage Service, and EKS <-> Elastic Kubernetes Service. "
            + "CloudFront and Route 53 are distinct singleton services.",
        )

        expect_items_are_subset_of_input(item_list, deduped)
        self.assertEqual(
            normalize_names(deduped),
            normalize_names(["EC2", "S3", "EKS", "CloudFront", "Route 53"]),
        )

    def test_follows_explicit_migration_guidance_to_remove_renamed_duplicates(self):
        item_list: list[SemanticItem] = [
            "Customer ID",
            "Client Identifier",
            "Order Date",
            "Date of Order",
            "Total Amount",
            "Invoice Total",
        ]

        deduped = remove_semantic_duplicates(
            create_client(),
            item_list,
            "There are exactly three synonym pairs and no other overlaps: "
            + "Customer ID <-> Client Identifier, "
            + "Order Date <-> Date of Order, "
            + "Total Amount <-> Invoice Total.",
        )

        expect_items_are_subset_of_input(item_list, deduped)
        self.assertEqual(
            normalize_names(deduped),
            normalize_names(["Customer ID", "Order Date", "Total Amount"]),
        )

    def test_keeps_clearly_unrelated_canonical_fields_unchanged(self):
        item_list: list[SemanticItem] = [
            "Planet Name",
            "Invoice Due Date",
            "Blood Glucose Level",
            "Railway Station Code",
        ]

        deduped = remove_semantic_duplicates(
            create_client(),
            item_list,
            "All items belong to different domains and are not synonyms. Keep every item in its own group.",
        )

        expect_items_are_subset_of_input(item_list, deduped)
        self.assertEqual(normalize_names(deduped), normalize_names(item_list))

    def test_uses_descriptions_to_disambiguate_homonyms_and_retain_one_representative_per_referent(
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

        deduped = remove_semantic_duplicates(
            create_client(),
            item_list,
            "Group by referent, not by string name. "
            + "Peach State refers to Georgia the U.S. state. "
            + "Sakartvelo refers to Georgia the country.",
        )

        expect_items_are_subset_of_input(item_list, deduped)
        self.assertEqual(len(deduped), 2)
        self.assertEqual(
            count_signatures(deduped), count_signatures([item_list[0], item_list[1]])
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

        remove_semantic_duplicates(
            create_client(),
            item_list,
            "Legacy Plan Alpha and Modern Plan Alpha are semantically equivalent labels. Client ID and Customer Identifier are also equivalent.",
        )

        self.assertEqual(item_list, snapshot)


if __name__ == "__main__":
    unittest.main()
