#!/usr/bin/env python3
"""Writes two tiny homebrew programs, assembled by hand, to test the emulator players without any commercial game:

  nes-test.nes   fills the screen RED and turns it GREEN while the A button is held
  gb-test.gb     fills the screen WHITE and turns it BLACK while the A button is held

Usage: python3 tools/make_test_roms.py <out-dir>
"""
import os
import sys


def nes_rom():
    code = bytes([
        0x78,                    # SEI
        0xD8,                    # CLD
        0xA2, 0xFF, 0x9A,        # LDX #$FF ; TXS
        0x2C, 0x02, 0x20, 0x10, 0xFB,          # vb1: BIT $2002 ; BPL vb1
        0x2C, 0x02, 0x20, 0x10, 0xFB,          # vb2: BIT $2002 ; BPL vb2
        0xA9, 0x00, 0x8D, 0x00, 0x20,          # LDA #0 ; STA $2000   (no NMI)
        0xA9, 0x1E, 0x8D, 0x01, 0x20,          # LDA #$1E ; STA $2001 (show background + sprites)
        # main: ($C019)
        0xA9, 0x01, 0x8D, 0x16, 0x40,          # LDA #1 ; STA $4016   (strobe pad)
        0xA9, 0x00, 0x8D, 0x16, 0x40,          # LDA #0 ; STA $4016
        0xAD, 0x16, 0x40,                      # LDA $4016            (button A)
        0x29, 0x01,                            # AND #1
        0xF0, 0x04,                            # BEQ notA
        0xA9, 0x2A,                            # LDA #$2A  (green)
        0xD0, 0x02,                            # BNE setc
        0xA9, 0x16,                            # notA: LDA #$16 (red)
        0x48,                                  # setc: PHA
        0x2C, 0x02, 0x20, 0x10, 0xFB,          # vb3: BIT $2002 ; BPL vb3 (wait for vblank)
        0xA9, 0x3F, 0x8D, 0x06, 0x20,          # LDA #$3F ; STA $2006
        0xA9, 0x00, 0x8D, 0x06, 0x20,          # LDA #$00 ; STA $2006  (PPU address = $3F00)
        0x68, 0x8D, 0x07, 0x20,                # PLA ; STA $2007       (background colour)
        0xA9, 0x00, 0x8D, 0x05, 0x20, 0x8D, 0x05, 0x20,   # reset scroll
        0x4C, 0x19, 0xC0,                      # JMP main
    ])
    prg = bytearray(16384)
    prg[:len(code)] = code
    prg[0x3FFA:0x3FFC] = bytes([0x00, 0xC0])   # NMI   -> $C000
    prg[0x3FFC:0x3FFE] = bytes([0x00, 0xC0])   # RESET -> $C000
    prg[0x3FFE:0x4000] = bytes([0x00, 0xC0])   # IRQ   -> $C000
    header = bytes([0x4E, 0x45, 0x53, 0x1A, 1, 1, 0, 0]) + bytes(8)
    return header + bytes(prg) + bytes(8192)    # 16 KB PRG + 8 KB (blank) CHR


def gb_rom():
    rom = bytearray(32768)
    rom[0x100:0x104] = bytes([0x00, 0xC3, 0x50, 0x01])        # NOP ; JP $0150
    rom[0x134:0x134 + 9] = b"RETROTEST"
    code = bytes([
        0xF3,                    # DI
        0x31, 0xFE, 0xFF,        # LD SP,$FFFE
        0x3E, 0x91, 0xE0, 0x40,  # LD A,$91 ; LDH ($40),A   (LCD + background on)
        # main: ($0158)
        0x3E, 0x10, 0xE0, 0x00,  # LD A,$10 ; LDH ($00),A   (select the A/B/Select/Start buttons)
        0xF0, 0x00, 0xF0, 0x00,  # LDH A,($00) twice (settle)
        0xCB, 0x47,              # BIT 0,A                  (0 = A pressed)
        0x20, 0x04,              # JR NZ,released
        0x3E, 0xFF,              # LD A,$FF  (black)
        0x18, 0x02,              # JR store
        0x3E, 0x00,              # released: LD A,$00 (white)
        0xE0, 0x47,              # store: LDH ($47),A       (background palette)
        0x18, 0xEA,              # JR main
    ])
    rom[0x150:0x150 + len(code)] = code
    chk = 0
    for i in range(0x134, 0x14D):
        chk = (chk - rom[i] - 1) & 0xFF
    rom[0x14D] = chk
    return bytes(rom)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "nes-test.nes"), "wb").write(nes_rom())
    open(os.path.join(out, "gb-test.gb"), "wb").write(gb_rom())
    print("wrote", os.path.join(out, "nes-test.nes"), "and", os.path.join(out, "gb-test.gb"))
