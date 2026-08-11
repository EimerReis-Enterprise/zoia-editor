# OPXY Total Wash

`patches/opxy-total-wash.zoia.json` is an experimental Euroburo Patch for routing the OP-XY directly through a dry-to-total-wash transition. At CC2 minimum the signal is a full stereo dry passthrough; at maximum the output is completely wet reverb.

## Direct topology

```text
                               ┌→ Dry Wet Mix input A (dry L/R) ─┐
OP-XY stereo output → Euroburo inputs                            ├→ Euroburo outputs → monitors / next device
                               └→ mono sum → HPF → 100% wet reverb
                                                       → Dry Wet Mix input B (wet L/R)

CC2 ───────────────────────────────────────────────→ Dry Wet Mix
  └→ Wash Macro ────────────────────────────────────→ Wash HPF + Wash Reverb decay
```

`Dry Wet Mix` is a stereo Audio Balance Module. CC2 is connected directly to its `Mix` control. Its connection strength is hardware-calibrated to `21845`, correcting the observed three-times-fast MIDI response: approximately 33% controller travel should now produce approximately 33% Mix rather than reaching 100%.

## Wash control

MIDI channel **1**, CC **2** performs two jobs at once. Both routes use the same calibrated `21845` connection strength so the filter and decay do not reach their maximum at one-third controller travel.

| Target | CC 0 | CC 127 |
|---|---|---|
| Dry Wet Mix | 100% dry / 0% wet | 0% dry / 100% wet |
| Wash HPF frequency | raw `12000` | approximately 17 kHz at 80% CC2 travel |
| Wash Reverb decay | raw `32768` (approximately 4.1 s) | infinity at approximately 80% CC2 travel |

The reverb is fixed at 100% wet. The HPF mapping reaches approximately 17 kHz at 80% CC2 travel and clamps toward its maximum above that point. Its decay mapping starts at approximately 4.1 seconds and reaches the reverb’s infinite-decay raw value (`65535`) at approximately 80% CC2 travel; further movement remains clamped at infinity. The direct CC2-to-Mix mapping uses the proven on-device Mix taper; only its incoming strength is reduced to span the controller’s full physical travel.

## Send/return versus direct routing

A send/return setup can make the overall result fully wet only when the host device can reduce its own dry path to zero and set the external return to 100%. The original NTS-4 return Patch emits wet-only audio, but it cannot remove dry audio that the NTS-4 mixes internally in parallel.

This direct OP-XY Patch makes the crossfade inside Euroburo, so it does not rely on that host-device behavior.

## Hardware test steps

1. Connect OP-XY L/R directly to Euroburo inputs and Euroburo outputs directly to monitors, mixer, or the next device. Start with monitor levels low.
2. Play stereo OP-XY material with CC2 at 0. Confirm clean full-level stereo dry passthrough.
3. Set CC2 near 33% travel and confirm `Dry Wet Mix: Mix` is near 33%, rather than 100%.
4. Set CC2 near 50% and confirm the Mix is near halfway; then confirm CC2 127 produces fully wet output.
5. Confirm reverb decay rises gradually and reaches infinity near 80% CC2 travel; confirm HPF frequency reaches approximately 17 kHz near 80% CC2 travel.
6. Check for clipping, stereo integrity, and acceptable CPU use.

Compiler success proves only structural encoding. The Patch remains Experimental until these steps pass on the target hardware.
