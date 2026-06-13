"""Canonical 48-team registry + cross-source name resolution.

Mirrors lib/names.ts: ids are FIFA trigrams, aliases cover the exact spellings
used by martj42 results.csv, the dcaribou player dump (country_of_citizenship),
and the FIFA ranking seed. resolve() returns None for non-WC2026 teams so the
Elo run (which spans every nation in history) can keep raw names as keys and
only project onto the 48 at feature time.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Team:
    id: str
    name: str
    group: str
    confederation: str
    aliases: tuple[str, ...] = field(default_factory=tuple)


# id, display name, group, confederation, alias spellings used by sources
_TEAMS: list[Team] = [
    Team("MEX", "Mexico", "A", "CONCACAF"),
    Team("RSA", "South Africa", "A", "CAF"),
    Team("KOR", "Korea Republic", "A", "AFC", ("South Korea", "Korea")),
    Team("CZE", "Czechia", "A", "UEFA", ("Czech Republic",)),
    Team("CAN", "Canada", "B", "CONCACAF"),
    Team("BIH", "Bosnia and Herzegovina", "B", "UEFA", ("Bosnia-Herzegovina", "Bosnia")),
    Team("QAT", "Qatar", "B", "AFC"),
    Team("SUI", "Switzerland", "B", "UEFA"),
    Team("BRA", "Brazil", "C", "CONMEBOL"),
    Team("MAR", "Morocco", "C", "CAF"),
    Team("HAI", "Haiti", "C", "CONCACAF"),
    Team("SCO", "Scotland", "C", "UEFA"),
    Team("USA", "USA", "D", "CONCACAF", ("United States", "United States of America")),
    Team("PAR", "Paraguay", "D", "CONMEBOL"),
    Team("AUS", "Australia", "D", "AFC"),
    Team("TUR", "Türkiye", "D", "UEFA", ("Turkey", "Turkiye")),
    Team("GER", "Germany", "E", "UEFA"),
    Team("CUW", "Curaçao", "E", "CONCACAF", ("Curacao",)),
    Team("CIV", "Côte d'Ivoire", "E", "CAF", ("Ivory Coast", "Cote d'Ivoire")),
    Team("ECU", "Ecuador", "E", "CONMEBOL"),
    Team("NED", "Netherlands", "F", "UEFA", ("Holland",)),
    Team("JPN", "Japan", "F", "AFC"),
    Team("SWE", "Sweden", "F", "UEFA"),
    Team("TUN", "Tunisia", "F", "CAF"),
    Team("BEL", "Belgium", "G", "UEFA"),
    Team("EGY", "Egypt", "G", "CAF"),
    Team("IRN", "IR Iran", "G", "AFC", ("Iran", "Iran IR")),
    Team("NZL", "New Zealand", "G", "OFC"),
    Team("ESP", "Spain", "H", "UEFA"),
    Team("URU", "Uruguay", "H", "CONMEBOL"),
    Team("KSA", "Saudi Arabia", "H", "AFC"),
    Team("CPV", "Cabo Verde", "H", "CAF", ("Cape Verde", "Cape Verde Islands")),
    Team("FRA", "France", "I", "UEFA"),
    Team("SEN", "Senegal", "I", "CAF"),
    Team("NOR", "Norway", "I", "UEFA"),
    Team("IRQ", "Iraq", "I", "AFC"),
    Team("ARG", "Argentina", "J", "CONMEBOL"),
    Team("ALG", "Algeria", "J", "CAF", ("Algérie",)),
    Team("AUT", "Austria", "J", "UEFA"),
    Team("JOR", "Jordan", "J", "AFC"),
    Team("POR", "Portugal", "K", "UEFA"),
    Team("COL", "Colombia", "K", "CONMEBOL"),
    Team("UZB", "Uzbekistan", "K", "AFC"),
    Team("COD", "Congo DR", "K", "CAF",
         ("DR Congo", "Congo, Democratic Republic of",
          "Democratic Republic of the Congo", "Zaire")),
    Team("ENG", "England", "L", "UEFA"),
    Team("CRO", "Croatia", "L", "UEFA"),
    Team("GHA", "Ghana", "L", "CAF"),
    Team("PAN", "Panama", "L", "CONCACAF"),
]

TEAMS: dict[str, Team] = {t.id: t for t in _TEAMS}
ALL_TEAM_IDS: list[str] = [t.id for t in _TEAMS]


def normalize(name: str) -> str:
    s = unicodedata.normalize("NFD", str(name))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[‘’]", "'", s)
    s = re.sub(r"[.,]", "", s)
    s = re.sub(r"[-_]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


_ALIAS_INDEX: dict[str, str] = {}
for _t in _TEAMS:
    for _name in (_t.name, _t.id, *_t.aliases):
        _key = normalize(_name)
        _existing = _ALIAS_INDEX.get(_key)
        if _existing and _existing != _t.id:
            raise ValueError(f"alias collision: {_name!r} -> {_existing} and {_t.id}")
        _ALIAS_INDEX[_key] = _t.id


def resolve(name: str) -> str | None:
    """Source name -> trigram, or None if not one of the 48 WC2026 teams."""
    return _ALIAS_INDEX.get(normalize(name))


CONFEDERATIONS = sorted({t.confederation for t in _TEAMS})
