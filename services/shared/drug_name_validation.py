"""Shared validation for drug / chemical / company-style search strings (path & query)."""
from __future__ import annotations

import re
from typing import Final

# Unicode letters/digits (\w), spaces, and common punctuation in drug & chemical names.
_DRUG_QUERY_RE = re.compile(r"^[\w\s\-'.,()+=%&°²³]+$", re.UNICODE)

DRUG_QUERY_MAX_LEN: Final[int] = 200
SEARCH_PREFIX_MAX_LEN: Final[int] = 80


def is_valid_drug_query(name: str) -> bool:
    if not name or len(name) > DRUG_QUERY_MAX_LEN:
        return False
    return bool(_DRUG_QUERY_RE.match(name))


def is_valid_search_prefix(prefix: str) -> bool:
    if not prefix or len(prefix) > SEARCH_PREFIX_MAX_LEN:
        return False
    return bool(_DRUG_QUERY_RE.match(prefix))
