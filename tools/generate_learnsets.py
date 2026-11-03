#!/usr/bin/env python3
"""Generate the offline level-up catalog from a pinned PokeAPI CSV checkout."""

import argparse
import csv
import io
import json
import urllib.request
from pathlib import Path


REVISION = "e5b79b2e15d7c50735a945936afd4cd1cfd94eae"
ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {7: "es", 9: "en", 5: "fr", 8: "it", 12: "zh-Hans", 4: "zh-Hant"}
SUPPORTED = set("""
tackle quick-attack swords-dance nasty-plot agility harden ember
flamethrower fire-spin heat-wave water-gun bubble hydro-pump aqua-ring
vine-whip razor-leaf leaf-storm giga-drain thunder-shock discharge thunderbolt
confusion psybeam psychic sludge mud-shot gust wing-attack
body-slam hyper-voice poison-sting toxic bulldoze bug-bite string-shot
bug-buzz rock-throw rock-slide ice-beam powder-snow karate-chop aura-sphere
lick shadow-ball dragon-rage dragon-dance fairy-wind dazzling-gleam metal-claw
flash-cannon bite dark-pulse night-shade bonemerang psycho-cut spikes
toxic-spikes hail meteor-mash will-o-wisp substitute aerial-ace flame-wheel
bubble-beam hex hyper-beam rapid-spin flame-charge whirlpool seed-bomb
energy-ball solar-beam thunder-wave electro-ball extrasensory mist-ball acid-spray
sand-tomb magnitude whirlwind air-slash signal-beam u-turn rock-tomb
ancient-power power-gem ice-shard freeze-dry rolling-kick vacuum-wave dynamic-punch
shadow-sneak ominous-wind dragon-breath dragon-claw outrage draining-kiss play-rough
disarming-voice mirror-shot gyro-ball sucker-punch night-slash
""".split())


def build(csv_dir=None):
    def rows(name):
        if csv_dir:
            text = (csv_dir / name).read_text(encoding="utf-8")
        else:
            url = f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{REVISION}/data/v2/csv/{name}"
            with urllib.request.urlopen(url, timeout=120) as response:
                text = response.read().decode("utf-8")
        return csv.DictReader(io.StringIO(text))

    versions = {
        int(row["id"]): {"name": row["identifier"], "order": int(row["order"])}
        for row in rows("version_groups.csv")
    }
    defaults = {
        int(row["species_id"]): int(row["id"])
        for row in rows("pokemon.csv") if row["is_default"] == "1"
    }
    species = {int(row["id"]): row for row in rows("pokemon_species.csv")}
    move_rows = {int(row["id"]): row for row in rows("moves.csv")}
    supported_ids = {
        key: row["identifier"] for key, row in move_rows.items()
        if row["identifier"] in SUPPORTED
    }
    if set(supported_ids.values()) != SUPPORTED:
        raise ValueError("A combat move has no canonical PokeAPI identifier")

    names = {}
    for row in rows("move_names.csv"):
        move_id, language = int(row["move_id"]), int(row["local_language_id"])
        if move_id in supported_ids and language in LANGUAGES:
            names.setdefault(move_id, {})[LANGUAGES[language]] = row["name"]

    level_up, machines = {}, {}
    default_ids = set(defaults.values())
    for row in rows("pokemon_moves.csv"):
        mon = int(row["pokemon_id"])
        if mon not in default_ids:
            continue
        method, version = int(row["pokemon_move_method_id"]), int(row["version_group_id"])
        if method not in (1, 4):
            continue
        move_id = int(row["move_id"])
        if method == 1:
            # Select the game's complete learnset before filtering supported moves.
            pool = level_up.setdefault(mon, {}).setdefault(version, {})
            if move_id in supported_ids:
                level = int(row["level"])
                pool[move_id] = min(level, pool.get(move_id, level))
        elif move_id in supported_ids:
            machines.setdefault(mon, {}).setdefault(version, set()).add(move_id)

    pokemon = {}
    for dex, row in species.items():
        mon = defaults[dex]
        available = level_up.get(mon, {})
        if not available:
            raise ValueError(f"No level-up source exists for species {dex}")
        version = next((v for v in (27, 26, 25) if v in available), None)
        if version is None:
            version = max(available, key=lambda v: versions[v]["order"])
        pokemon[dex] = {
            "growth": int(row["growth_rate_id"]),
            "version": version,
            "moves": sorted(
                [[supported_ids[move], level] for move, level in available[version].items()],
                key=lambda pair: (pair[1], pair[0]),
            ),
            "tms": sorted(supported_ids[move] for move in machines.get(mon, {}).get(version, set())),
        }

    growth = {}
    for row in rows("experience.csv"):
        rate = int(row["growth_rate_id"])
        growth.setdefault(rate, [0] * 101)[int(row["level"])] = int(row["experience"])

    data = {
        "revision": REVISION,
        "versions": {key: value["name"] for key, value in versions.items()},
        "growth": growth,
        "moves": {
            slug: {
                "names": names[key],
                "support": slug in {
                    "swords-dance", "nasty-plot", "agility", "harden",
                    "aqua-ring", "dragon-dance",
                },
            }
            for key, slug in sorted(supported_ids.items())
        },
        "pokemon": pokemon,
    }
    output = ROOT / "js/data/learnsets.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        "// Generated by tools/generate_learnsets.py; see CREDITS.md for data license.\n"
        "(function (data) {\n"
        "  if (typeof module === 'object' && module.exports) module.exports = data;\n"
        "  else globalThis.PS_LEARNSETS = data;\n"
        "})(" + json.dumps(data, ensure_ascii=True, separators=(",", ":")) + ");\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(pokemon)} species and {len(SUPPORTED)} combat moves to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv-dir", type=Path, help="Reuse downloaded CSV files instead of fetching them")
    build(parser.parse_args().csv_dir)
