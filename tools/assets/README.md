# Pottery asset pipeline

Run `python tools/assets/build_library.py` from the repository root to regenerate the code-authored icons, prototype audio, manifest, and catalog. Image generation is a separate built-in-tool workflow; exact prompts live in `docs/art-direction/asset-generation-v1.json`.

This pipeline owns only `public/assets/pottery-v1/` and its own source files. It does not alter the game core, content economy, renderer, or package configuration.

Raster images are first-pass sources. Single-pose characters and flattened installations are not finished animation rigs. The manifest explicitly records this distinction. Do not advertise the library as release-approved until phone-scale, motion, and audio listening reviews pass.
