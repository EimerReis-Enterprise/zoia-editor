# Compile authored endpoint graphs instead of only linear chains

Advanced Patch Documents may use Free Routing with explicit audio and CV endpoint identities, while safe mono authoring retains its linear Signal Chain operations. The codec validates active endpoints against the shared Module Configuration Registry, allocates hardware pages deterministically, and compiles each compatible `audio_out → audio_in` or `cv_out → cv_in` Connection. This enables stereo, branches, MIDI-derived control, clocking, and Looper workflows without weakening the simpler authoring mode.
