#!/usr/bin/env bash
# Installs Ubuntu system dependencies for the StudyBuddy desktop shell:
# libnotify (OS notifications), fakeroot/dpkg (building the .deb).
set -euo pipefail

sudo apt-get update
sudo apt-get install -y \
  libnotify-bin \
  fakeroot \
  dpkg \
  libxtst6 \
  libnss3 \
  libxss1 \
  libasound2t64

echo "Ubuntu desktop-shell dependencies installed."
