# NTS4 Wash Return

`patches/nts4-wash-return.zoia.json` is an experimental, fully wet Euroburo wash return for the Korg NTS-4 external send/return loop. It deliberately excludes a dry-through path: the NTS-4 is the only dry-signal mixer.

## Topology

```text
NTS-4 stereo send → mono input sum → high-pass filter → 100% wet stereo reverb
                                                     → Wash Return VCA → NTS-4 stereo return
```

The stereo send is summed before the mono-input reverb. The reverb mix is fixed at 100% wet. No Patch connection routes the input directly to the output.

## Wash Macro

MIDI channel **1**, CC **2** drives one internal `Wash Macro` Value Module. This is the only MIDI-controlled parameter boundary. Its output controls three targets together:

| Target | CC 0 | CC 127 |
|---|---|---|
| Wash Return VCA | silent | raw `32768` (approximately −6 dB, not unity) |
| Wash HPF frequency | raw `12000` | raw `34000` |
| Wash Reverb decay | raw `32768` (approximately 4.1 s) | raw `49151` (approximately 8.6 s) |

The reverb remains 100% wet at every Macro position. CC 0 is therefore quiet, warm, and shorter; raising CC 2 simultaneously opens a safely capped return, thins the low end, and lengthens the tail.

## Hardware test steps

1. Connect NTS-4 external-send L/R to Euroburo inputs and Euroburo outputs L/R to the NTS-4 external return; begin with monitor levels low.
2. Set the NTS-4 external-return/mix control to its intended position and confirm CC2 at 0 produces no Euroburo return.
3. Play stereo material and raise CC2 slowly. Confirm only wet reverb appears from the Euroburo return, with no direct/dry duplicate.
4. Sweep CC2: verify the return rises gradually, low-frequency buildup reduces, and the reverb tail lengthens together.
5. At CC2 127, confirm the wash remains below the desired dry level. Lower `connection-11.strengthRaw` if necessary.
6. Check for clipping, stereo return integrity, and acceptable CPU use.

Compiler success proves only structural encoding. The Patch remains Experimental until these steps pass on the target hardware.
