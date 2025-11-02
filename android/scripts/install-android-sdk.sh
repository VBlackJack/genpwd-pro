#!/usr/bin/env bash
#
# Minimal Android SDK bootstrapper used for local lint runs.
#
# This script downloads the Android command line tools and the exact
# packages required by the project so that lint can be executed without
# opening Android Studio. It mirrors the setup performed in CI.
#
# Usage:
#   ./scripts/install-android-sdk.sh [sdk-root]
#
# If sdk-root is omitted, \$ANDROID_SDK_ROOT (or \$ANDROID_HOME) is used.
# When neither environment variable is set the SDK is installed into
# "\$HOME/Android/Sdk".
set -euo pipefail

SDK_ROOT="${1:-${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${HOME}/Android/Sdk}}}"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
CMDLINE_TOOLS_ARCHIVE="commandlinetools.zip"

if [[ -z "${SDK_ROOT}" ]]; then
  echo "Unable to determine SDK root" >&2
  exit 1
fi

mkdir -p "${SDK_ROOT}"

if [[ ! -d "${SDK_ROOT}/cmdline-tools/latest" ]]; then
  echo "Downloading Android command line tools…"
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "${tmpdir}"' EXIT

  curl -fLo "${tmpdir}/${CMDLINE_TOOLS_ARCHIVE}" "${CMDLINE_TOOLS_URL}"
  mkdir -p "${SDK_ROOT}/cmdline-tools"
  unzip -q "${tmpdir}/${CMDLINE_TOOLS_ARCHIVE}" -d "${tmpdir}/clt"
  mv "${tmpdir}/clt/cmdline-tools" "${SDK_ROOT}/cmdline-tools/latest"
  rm -rf "${tmpdir}"
  trap - EXIT
else
  echo "Command line tools already installed at ${SDK_ROOT}/cmdline-tools/latest"
fi

export ANDROID_SDK_ROOT="${SDK_ROOT}"
export ANDROID_HOME="${SDK_ROOT}"
export PATH="${SDK_ROOT}/cmdline-tools/latest/bin:${SDK_ROOT}/platform-tools:${PATH}"

PACKAGES=(
  "platform-tools"
  "platforms;android-34"
  "build-tools;33.0.1"
)

echo "Accepting SDK licenses…"
yes | sdkmanager --licenses >/dev/null

echo "Installing required packages: ${PACKAGES[*]}"
sdkmanager "${PACKAGES[@]}"

echo
cat <<SETUP
Android SDK bootstrap complete.
Remember to create or update android/local.properties with:

sdk.dir=${SDK_ROOT}

You can then run lint and regenerate the baseline with:
  ./gradlew :app:updateLintBaselineRelease
SETUP
