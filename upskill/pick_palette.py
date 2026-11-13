"""Randomly pick a curated dark-mode palette for the Enterprise Upskill AI site.
Every palette keeps the CONTEXT.md structure (bg / surface / elevated / brand / hover + semantic colors),
so only the identity colors change. All brand colors are pre-checked for AA contrast on the dark bg."""
import random, json, secrets

PALETTES = {
  "Midnight Aurora":  {"bg":"#0A0F1F","surface":"#111A33","elevated":"#1A2547","brand":"#6366F1","hover":"#4F46E5","accent2":"#22D3EE"},
  "Obsidian Emerald": {"bg":"#07110F","surface":"#0E1C19","elevated":"#16302A","brand":"#10B981","hover":"#059669","accent2":"#A3E635"},
  "Ember Noir":       {"bg":"#120B0A","surface":"#1C1210","elevated":"#2B1A16","brand":"#F97316","hover":"#EA580C","accent2":"#FBBF24"},
  "Violet Nebula":    {"bg":"#0E0A1A","surface":"#161127","elevated":"#231A3D","brand":"#A855F7","hover":"#9333EA","accent2":"#F472B6"},
  "Deep Ocean":       {"bg":"#071620","surface":"#0C2331","elevated":"#133446","brand":"#0EA5E9","hover":"#0284C7","accent2":"#2DD4BF"},
  "Rose Quartz Dark": {"bg":"#130A10","surface":"#1E1119","elevated":"#2E1A26","brand":"#F43F5E","hover":"#E11D48","accent2":"#FDA4AF"},
}
seed = secrets.randbits(32)
rng = random.Random(seed)
name = rng.choice(list(PALETTES))
pal = PALETTES[name]
print(json.dumps({"seed": seed, "name": name, **pal}, indent=2))
json.dump({"seed": seed, "name": name, **pal}, open("palette.json","w"), indent=2)
