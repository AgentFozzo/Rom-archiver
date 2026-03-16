"""
Known BIOS/firmware/system file hashes for verification.
Maps MD5 hash -> metadata.
"""

KNOWN_BIOS: dict[str, dict] = {
    # ─── PlayStation (PSX) ──────────────────────────────────────
    "924e392ed05558ffdb115408c263dccf": {
        "description": "PlayStation BIOS (SCPH-1001) — North America",
        "platform": "ps1", "category": "bios",
    },
    "e56ec1b027e00571a7c5946f2b1b8e75": {
        "description": "PlayStation BIOS (SCPH-5501) — North America",
        "platform": "ps1", "category": "bios",
    },
    "8dd7d5296a650fac7319bce665a6a53c": {
        "description": "PlayStation BIOS (SCPH-5500) — Japan",
        "platform": "ps1", "category": "bios",
    },
    "171bdcec1e25e3206b2fce5ef17fc8c1": {
        "description": "PlayStation BIOS (SCPH-5502) — Europe",
        "platform": "ps1", "category": "bios",
    },
    "6e3735ff4c7dc899ee98981385f6f3d0": {
        "description": "PlayStation BIOS (SCPH-7001) — North America",
        "platform": "ps1", "category": "bios",
    },
    "dc2b9bf8da62ec93e868cfd29f0d067d": {
        "description": "PlayStation BIOS (SCPH-1000) — Japan",
        "platform": "ps1", "category": "bios",
    },

    # ─── PlayStation 2 ──────────────────────────────────────────
    "d3f1853a16c2ec18f3cd1ae655213571": {
        "description": "PS2 BIOS (SCPH-70012) — North America",
        "platform": "ps2", "category": "bios",
    },
    "9a9e8ed5e0f22d4fe22a4be6b1ae3e0c": {
        "description": "PS2 BIOS (SCPH-39001) — North America",
        "platform": "ps2", "category": "bios",
    },
    "32f2e4d5ff5ee11072a6bc45530f5765": {
        "description": "PS2 BIOS (SCPH-77001) — North America",
        "platform": "ps2", "category": "bios",
    },

    # ─── PSP ────────────────────────────────────────────────────
    "f6bc2d1c85560e74e7e33a4d8e5efcae": {
        "description": "PSP BIOS (6.60)",
        "platform": "psp", "category": "firmware",
    },

    # ─── Game Boy Advance ───────────────────────────────────────
    "a860e8c0b6d573d191e4ec7db1b1e4f6": {
        "description": "GBA BIOS (gba_bios.bin)",
        "platform": "gba", "category": "bios",
    },

    # ─── Nintendo DS ────────────────────────────────────────────
    "145eaef5bd3037cbc247c213bb3da1b3": {
        "description": "NDS ARM7 BIOS (biosnds7.bin)",
        "platform": "nds", "category": "bios",
    },
    "1c0d0d3f8f85b91ef3677526d58a0439": {
        "description": "NDS ARM9 BIOS (biosnds9.bin)",
        "platform": "nds", "category": "bios",
    },
    "b4af267b4cbe14e2fc2b6a1027a54e2c": {
        "description": "NDS Firmware (firmware.bin)",
        "platform": "nds", "category": "firmware",
    },

    # ─── Sega Saturn ────────────────────────────────────────────
    "af5828fdff51384f99b3c4926be27762": {
        "description": "Sega Saturn BIOS — Japan",
        "platform": "saturn", "category": "bios",
    },
    "3240872c70984b6cbfda1586cab68dbe": {
        "description": "Sega Saturn BIOS — North America / Europe",
        "platform": "saturn", "category": "bios",
    },

    # ─── Dreamcast ──────────────────────────────────────────────
    "e10c53c2f8b90bab96ead2d368858623": {
        "description": "Dreamcast BIOS (dc_boot.bin)",
        "platform": "dreamcast", "category": "bios",
    },
    "0a93f7940c455905bea6e392dfde92a4": {
        "description": "Dreamcast Flash (dc_flash.bin)",
        "platform": "dreamcast", "category": "firmware",
    },

    # ─── Sega Genesis / Mega Drive ──────────────────────────────
    "d8c4431f4cc47c76b16b77ce3a5e8b9d": {
        "description": "Sega CD BIOS — North America (Model 2)",
        "platform": "genesis", "category": "bios",
    },
    "bdeb4c47da613315afbae714ae40b3c6": {
        "description": "Sega CD BIOS — Japan",
        "platform": "genesis", "category": "bios",
    },
    "278a9397d192149e84e820ac621a8edd": {
        "description": "Sega CD BIOS — Europe (Mega-CD)",
        "platform": "genesis", "category": "bios",
    },

    # ─── Nintendo GameCube ──────────────────────────────────────
    "d3363b2f8defa4fb34ab10d06d2098e8": {
        "description": "GameCube IPL BIOS — North America",
        "platform": "gamecube", "category": "bios",
    },

    # ─── Nintendo Switch (keys) ─────────────────────────────────
    # Switch uses key files rather than traditional BIOS
    # Hashes vary per firmware version, so we just recognize the filenames

    # ─── Xbox ───────────────────────────────────────────────────
    "d49c52a4102f6df7bcf8d0617ac475ed": {
        "description": "Original Xbox BIOS (Retail 5101)",
        "platform": "xbox", "category": "bios",
    },
}

# Files identified by name (for things like Switch keys where hashes vary)
KNOWN_FILENAMES: dict[str, dict] = {
    "prod.keys": {
        "description": "Nintendo Switch Production Keys",
        "platform": "switch", "category": "keys",
    },
    "title.keys": {
        "description": "Nintendo Switch Title Keys",
        "platform": "switch", "category": "keys",
    },
    "scph1001.bin": {
        "description": "PlayStation BIOS (SCPH-1001)",
        "platform": "ps1", "category": "bios",
    },
    "scph5501.bin": {
        "description": "PlayStation BIOS (SCPH-5501)",
        "platform": "ps1", "category": "bios",
    },
    "gba_bios.bin": {
        "description": "GBA BIOS",
        "platform": "gba", "category": "bios",
    },
    "dc_boot.bin": {
        "description": "Dreamcast BIOS",
        "platform": "dreamcast", "category": "bios",
    },
    "dc_flash.bin": {
        "description": "Dreamcast Flash ROM",
        "platform": "dreamcast", "category": "firmware",
    },
}

# What each platform typically needs
PLATFORM_BIOS_INFO: dict[str, dict] = {
    "ps1": {
        "name": "PlayStation",
        "needs": ["SCPH-1001 or SCPH-5501 BIOS (.bin)"],
        "emulators": ["DuckStation", "Beetle PSX", "PCSX-ReARMed"],
    },
    "ps2": {
        "name": "PlayStation 2",
        "needs": ["PS2 BIOS dump from your console (.bin, multiple files)"],
        "emulators": ["PCSX2", "AetherSX2", "Play!"],
    },
    "psp": {
        "name": "PlayStation Portable",
        "needs": ["PSP firmware (optional for most games)"],
        "emulators": ["PPSSPP"],
    },
    "saturn": {
        "name": "Sega Saturn",
        "needs": ["Saturn BIOS — region-matching (.bin)"],
        "emulators": ["Beetle Saturn", "Kronos", "Yabause"],
    },
    "dreamcast": {
        "name": "Dreamcast",
        "needs": ["dc_boot.bin", "dc_flash.bin"],
        "emulators": ["Flycast", "Redream"],
    },
    "genesis": {
        "name": "Sega CD / Mega CD",
        "needs": ["Sega CD BIOS — region-matching (.bin)"],
        "emulators": ["Genesis Plus GX", "PicoDrive"],
    },
    "gba": {
        "name": "Game Boy Advance",
        "needs": ["gba_bios.bin (optional but recommended)"],
        "emulators": ["mGBA", "VBA-M"],
    },
    "nds": {
        "name": "Nintendo DS",
        "needs": ["biosnds7.bin", "biosnds9.bin", "firmware.bin"],
        "emulators": ["melonDS", "DeSmuME"],
    },
    "gamecube": {
        "name": "Nintendo GameCube",
        "needs": ["IPL.bin (optional)"],
        "emulators": ["Dolphin"],
    },
    "switch": {
        "name": "Nintendo Switch",
        "needs": ["prod.keys", "title.keys (from your console)"],
        "emulators": ["Ryujinx", "Yuzu"],
    },
    "xbox": {
        "name": "Xbox",
        "needs": ["Xbox BIOS dump (.bin)"],
        "emulators": ["xemu", "Cxbx-Reloaded"],
    },
    "3ds": {
        "name": "Nintendo 3DS",
        "needs": ["AES keys (aes_keys.txt from your console)"],
        "emulators": ["Citra"],
    },
}


def lookup_bios_by_md5(md5: str) -> dict | None:
    return KNOWN_BIOS.get(md5.lower())


def lookup_bios_by_filename(filename: str) -> dict | None:
    return KNOWN_FILENAMES.get(filename.lower())
