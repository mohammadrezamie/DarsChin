# Retired one-off scripts — do not restore

The original 22 one-off legacy scripts were removed from the public source tree because several contained hardcoded authentication values or printed secrets. They are not supported build, test, smoke or deployment commands.

Old Git commits and pull request refs may still contain the files. Removing them from current HEAD does NOT erase past disclosures or revoke credentials. Do not restore or execute these scripts; use maintained synthetic tests under `tests/` and freshly generated installation secrets.
