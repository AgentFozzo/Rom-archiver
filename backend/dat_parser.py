"""
Parses No-Intro and Redump DAT files (XML format) for ROM hash verification.
"""
import xml.etree.ElementTree as ET
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


KNOWN_PLATFORMS = {
    # No-Intro names -> our slugs
    "nintendo - nintendo entertainment system": "nes",
    "nintendo - super nintendo entertainment system": "snes",
    "nintendo - nintendo 64": "n64",
    "nintendo - game boy": "gb",
    "nintendo - game boy color": "gbc",
    "nintendo - game boy advance": "gba",
    "nintendo - nintendo ds": "nds",
    "nintendo - nintendo 3ds": "3ds",
    "nintendo - gamecube": "gamecube",
    "nintendo - wii": "wii",
    "sega - mega drive - genesis": "genesis",
    "sega - master system - mark iii": "mastersystem",
    "sega - game gear": "gamegear",
    "sega - saturn": "saturn",
    "sega - dreamcast": "dreamcast",
    "sony - playstation": "ps1",
    "sony - playstation 2": "ps2",
    "sony - playstation portable": "psp",
    "atari - 2600": "atari2600",
    "atari - 7800": "atari7800",
    "snk - neo geo pocket color": "ngpc",
    "bandai - wonderswan color": "wsc",
}

PLATFORM_DISPLAY_NAMES = {
    "nes": "Nintendo Entertainment System",
    "snes": "Super Nintendo",
    "n64": "Nintendo 64",
    "gb": "Game Boy",
    "gbc": "Game Boy Color",
    "gba": "Game Boy Advance",
    "nds": "Nintendo DS",
    "3ds": "Nintendo 3DS",
    "gamecube": "GameCube",
    "wii": "Wii",
    "genesis": "Sega Genesis",
    "mastersystem": "Sega Master System",
    "gamegear": "Game Gear",
    "saturn": "Sega Saturn",
    "dreamcast": "Dreamcast",
    "ps1": "PlayStation",
    "ps2": "PlayStation 2",
    "psp": "PlayStation Portable",
    "atari2600": "Atari 2600",
    "atari7800": "Atari 7800",
    "ngpc": "Neo Geo Pocket Color",
    "wsc": "WonderSwan Color",
    "arcade": "Arcade",
    "other": "Other",
}

ROM_EXTENSIONS = {
    "nes": [".nes"],
    "snes": [".sfc", ".smc"],
    "n64": [".z64", ".n64", ".v64"],
    "gb": [".gb"],
    "gbc": [".gbc"],
    "gba": [".gba"],
    "nds": [".nds"],
    "3ds": [".3ds", ".cia", ".cci"],
    "gamecube": [".iso", ".gcm", ".nrg"],
    "wii": [".iso", ".wbfs", ".wia"],
    "genesis": [".md", ".gen", ".smd", ".bin"],
    "mastersystem": [".sms"],
    "gamegear": [".gg"],
    "saturn": [".bin", ".iso", ".cue"],
    "dreamcast": [".cdi", ".gdi", ".iso"],
    "ps1": [".bin", ".iso", ".img", ".cue", ".pbp"],
    "ps2": [".iso", ".bin"],
    "psp": [".iso", ".cso", ".pbp"],
    "atari2600": [".a26", ".bin"],
    "atari7800": [".a78"],
    "ngpc": [".ngc", ".ngp"],
    "wsc": [".ws", ".wsc"],
    "arcade": [".zip", ".7z"],
}

ALL_ROM_EXTENSIONS = {ext for exts in ROM_EXTENSIONS.values() for ext in exts}

# Extension -> platform slug lookup (for auto-detection)
EXT_TO_PLATFORM: dict[str, list[str]] = {}
for _slug, _exts in ROM_EXTENSIONS.items():
    for _ext in _exts:
        EXT_TO_PLATFORM.setdefault(_ext, []).append(_slug)


def detect_platform_from_path(file_path: str) -> Optional[str]:
    """Detect platform from directory name or file extension."""
    path = Path(file_path)
    ext = path.suffix.lower()

    # Check parent directory names against known platform names
    for part in path.parts:
        part_lower = part.lower()
        for key, slug in KNOWN_PLATFORMS.items():
            if key in part_lower or slug == part_lower:
                return slug
        # Direct slug match
        if part_lower in PLATFORM_DISPLAY_NAMES:
            return part_lower

    # Fallback: extension-based detection (pick first match)
    candidates = EXT_TO_PLATFORM.get(ext, [])
    if len(candidates) == 1:
        return candidates[0]

    return None


def clean_rom_name(filename: str) -> str:
    """Strip region/revision tags from a ROM filename for IGDB search."""
    import re
    name = Path(filename).stem
    # Remove parentheses content: (USA), (Europe), (v1.0), (En), etc.
    name = re.sub(r'\s*\([^)]*\)', '', name)
    # Remove brackets content: [!], [b], [h], etc.
    name = re.sub(r'\s*\[[^\]]*\]', '', name)
    # Remove common suffixes
    name = re.sub(r'\s*-\s*$', '', name)
    return name.strip()


def extract_region(filename: str) -> Optional[str]:
    """Extract region tag from a ROM filename."""
    import re
    match = re.search(r'\((USA|Europe|Japan|World|En|Fr|De|Es|It|Nl|Pt|Sv|No|Da)\)', filename, re.IGNORECASE)
    if match:
        region_map = {
            "usa": "USA", "europe": "Europe", "japan": "Japan",
            "world": "World", "en": "USA",
        }
        return region_map.get(match.group(1).lower(), match.group(1))
    return None


def extract_revision(filename: str) -> Optional[str]:
    """Extract revision tag from a ROM filename."""
    import re
    match = re.search(r'\(Rev\s*([A-Z0-9.]+)\)', filename, re.IGNORECASE)
    if match:
        return f"Rev {match.group(1)}"
    match = re.search(r'\(v([0-9.]+)\)', filename, re.IGNORECASE)
    if match:
        return f"v{match.group(1)}"
    return None


class DatParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.header = {}
        self.entries = []

    def parse(self) -> tuple[dict, list[dict]]:
        """Parse a No-Intro/Redump DAT file. Returns (header, entries)."""
        try:
            tree = ET.parse(self.file_path)
            root = tree.getroot()

            # Parse header
            header_el = root.find("header")
            if header_el is not None:
                self.header = {
                    "name": self._get_text(header_el, "name"),
                    "description": self._get_text(header_el, "description"),
                    "version": self._get_text(header_el, "version"),
                    "date": self._get_text(header_el, "date"),
                    "author": self._get_text(header_el, "author"),
                    "homepage": self._get_text(header_el, "homepage"),
                    "url": self._get_text(header_el, "url"),
                }

            # Parse game entries
            for game_el in root.findall("game"):
                game_name = game_el.get("name", "")
                for rom_el in game_el.findall("rom"):
                    entry = {
                        "game_name": game_name,
                        "rom_name": rom_el.get("name", ""),
                        "size": self._safe_int(rom_el.get("size")),
                        "crc32": (rom_el.get("crc") or "").lower() or None,
                        "md5": (rom_el.get("md5") or "").lower() or None,
                        "sha1": (rom_el.get("sha1") or "").lower() or None,
                    }
                    self.entries.append(entry)

            logger.info(f"Parsed {len(self.entries)} entries from {self.file_path}")
            return self.header, self.entries

        except ET.ParseError as e:
            logger.error(f"Failed to parse DAT file {self.file_path}: {e}")
            raise ValueError(f"Invalid DAT file format: {e}")

    def _get_text(self, element, tag: str) -> Optional[str]:
        child = element.find(tag)
        return child.text.strip() if child is not None and child.text else None

    def _safe_int(self, value: Optional[str]) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    def detect_platform_slug(self) -> Optional[str]:
        """Try to detect platform from DAT header name."""
        name = (self.header.get("name") or "").lower()
        for key, slug in KNOWN_PLATFORMS.items():
            if key in name:
                return slug
        return None
