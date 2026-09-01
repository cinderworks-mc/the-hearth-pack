#!/usr/bin/env python3
"""generate overrides/servers.dat so the pack pre-adds the hearth.

IT GOES UNDER config/defaultoptions/, NOT THE INSTANCE ROOT
-----------------------------------------------------------
a servers.dat at the instance root holds the player's ENTIRE multiplayer list,
and launcher overrides overwrite on update - so shipping one there replaces
whatever servers they added themselves, every time they take a pack bump.

the `default-options` mod exists for exactly this. it registers options.txt and
servers.dat (see DefaultOptionsDefaultHandlers in its source) and applies them
ONLY when the real file is missing, so a fresh install gets the hearth
pre-added and an existing player keeps their list untouched. its own docs are
explicit: "do not include the options.txt and servers.dat from the root
directory in your modpack".

so this writes to overrides/config/defaultoptions/servers.dat and the root copy
is deliberately gone.

servers.dat is UNCOMPRESSED nbt, unlike level.dat. writing it by hand rather
than taking an nbt dependency for ~40 lines of well-specified format.

the entry carries its own icon, as a base64 png in an `icon` string tag - the
same slot the client fills in itself after its first successful ping. writing
it here means the hearth shows its own art in the list from the moment the pack
is installed, before the player has ever connected. hearth-icon.png next to
this script is the source; it is NOT under overrides/, so it does not ship as a
loose file in the pack, only as those bytes inside the nbt.
"""

import base64
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "overrides", "config", "defaultoptions", "servers.dat")
ICON = os.path.join(HERE, "hearth-icon.png")

# name is what shows in the server list. keep it short - the list truncates.
SERVERS = [
    {"name": "the hearth", "ip": "mc.hartforge.dev"},
]

TAG_END, TAG_BYTE, TAG_INT, TAG_STRING, TAG_LIST, TAG_COMPOUND = 0, 1, 3, 8, 9, 10


def s(text):
    """nbt string: 2-byte big-endian length, then utf-8"""
    raw = text.encode("utf-8")
    return struct.pack(">H", len(raw)) + raw


def read_icon():
    """base64 of hearth-icon.png, checked for the size the client expects.

    png header: 8-byte magic, then the IHDR chunk - 4-byte length, "IHDR",
    then width and height as big-endian uint32."""
    with open(ICON, "rb") as fh:
        raw = fh.read()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n", f"{ICON} is not a png"
    assert raw[12:16] == b"IHDR", f"{ICON} has no IHDR where one belongs"
    w, h = struct.unpack_from(">II", raw, 16)
    assert (w, h) == (64, 64), f"{ICON} is {w}x{h}, server list icons must be 64x64"
    return base64.b64encode(raw).decode("ascii")


def build(icon_b64):
    entries = b""
    for srv in SERVERS:
        body = b""
        body += bytes([TAG_STRING]) + s("icon") + s(icon_b64)
        body += bytes([TAG_STRING]) + s("name") + s(srv["name"])
        body += bytes([TAG_STRING]) + s("ip") + s(srv["ip"])
        # acceptTextures=1: say yes to the server resource pack without a
        # prompt. we do not serve one today, but if we ever do, players who
        # never touched this get it silently instead of a modal on join.
        body += bytes([TAG_BYTE]) + s("acceptTextures") + bytes([1])
        body += bytes([TAG_END])
        entries += body

    # list payload: element type, count, then the element payloads back to back
    servers_list = bytes([TAG_COMPOUND]) + struct.pack(">i", len(SERVERS)) + entries

    out = b""
    out += bytes([TAG_COMPOUND]) + s("")            # unnamed root compound
    out += bytes([TAG_LIST]) + s("servers") + servers_list
    out += bytes([TAG_END])                          # close root
    return out


def verify(blob):
    """read it back rather than trusting the writer. a malformed servers.dat
    makes the client silently show an empty list, which would look like the
    pack simply not working."""
    i = 0

    def u16():
        nonlocal i
        v = struct.unpack_from(">H", blob, i)[0]
        i += 2
        return v

    def string():
        nonlocal i
        n = u16()
        v = blob[i:i + n].decode("utf-8")
        i += n
        return v

    assert blob[i] == TAG_COMPOUND, "root is not a compound"
    i += 1
    assert string() == "", "root should be unnamed"
    assert blob[i] == TAG_LIST, "expected a list"
    i += 1
    assert string() == "servers", "list should be named servers"
    assert blob[i] == TAG_COMPOUND, "servers should be a list of compounds"
    i += 1
    count = struct.unpack_from(">i", blob, i)[0]
    i += 4

    found = []
    for _ in range(count):
        entry = {}
        while blob[i] != TAG_END:
            tag = blob[i]
            i += 1
            key = string()
            if tag == TAG_STRING:
                entry[key] = string()
            elif tag == TAG_BYTE:
                entry[key] = blob[i]
                i += 1
            else:
                raise AssertionError(f"unexpected tag {tag} for {key}")
        i += 1
        # the icon has to survive the round trip as a real png, not just as a
        # string that happens to be there
        png = base64.b64decode(entry["icon"])
        assert png[:8] == b"\x89PNG\r\n\x1a\n", "icon did not decode to a png"
        entry["icon"] = f"<png {len(png)} bytes>"
        found.append(entry)
    assert blob[i] == TAG_END, "root not terminated"
    return found


if __name__ == "__main__":
    blob = build(read_icon())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as fh:
        fh.write(blob)
    parsed = verify(blob)
    print(f"wrote {OUT} ({len(blob)} bytes)")
    for e in parsed:
        print(f"  {e['name']:<16} {e['ip']:<24} "
              f"acceptTextures={e.get('acceptTextures')} {e['icon']}")
