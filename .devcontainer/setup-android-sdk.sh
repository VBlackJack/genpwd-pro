#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<'USAGE'
Usage: setup-android-sdk.sh [options]

Options:
  --sdk-root <path>           Android SDK root directory. Defaults to $ANDROID_SDK_ROOT or /opt/android-sdk.
  --project-root <path>       Project directory where local.properties should be written. Defaults to the
                              Android module directory relative to this script when run from the repository.
  --skip-local-properties     Do not create or update local.properties.
  -h, --help                  Show this help message.
USAGE
}

SDK_ROOT=${ANDROID_SDK_ROOT:-/opt/android-sdk}
PROJECT_ROOT=""
WRITE_LOCAL_PROPERTIES=true

CMDLINE_TOOLS_URL=${CMDLINE_TOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip}

TARGET_ANDROID_API=35
LEGACY_ANDROID_API=34
TARGET_BUILD_TOOLS_VERSION="34.0.0"
# The next API level/build-tools to prepare for. The installation will be
# attempted but ignored if not yet published by Google.
FUTURE_ANDROID_API=36
FUTURE_BUILD_TOOLS_VERSION="35.0.0"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --sdk-root)
            SDK_ROOT=$2
            shift 2
            ;;
        --project-root)
            PROJECT_ROOT=$2
            shift 2
            ;;
        --skip-local-properties)
            WRITE_LOCAL_PROPERTIES=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

if [[ -z "$PROJECT_ROOT" ]]; then
    SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
    PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)/android
fi

export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"

SDKMANAGER_BIN="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

ensure_cmdline_tools() {
    if [[ -x "$SDKMANAGER_BIN" ]]; then
        return
    fi

    echo "Android cmdline-tools not found. Downloading from $CMDLINE_TOOLS_URL ..."
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TMP_DIR"' EXIT
    curl -sSL "$CMDLINE_TOOLS_URL" -o "$TMP_DIR/cmdline-tools.zip"
    mkdir -p "$SDK_ROOT/cmdline-tools"
    unzip -q "$TMP_DIR/cmdline-tools.zip" -d "$TMP_DIR"
    rm -rf "$SDK_ROOT/cmdline-tools/latest"
    mv "$TMP_DIR/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
    rm -f "$TMP_DIR/cmdline-tools.zip"
    rm -rf "$TMP_DIR"
    trap - EXIT

    if [[ ! -x "$SDKMANAGER_BIN" ]]; then
        echo "Failed to install Android cmdline-tools." >&2
        exit 1
    fi
}

ensure_cmdline_tools

normalize_cmdline_tools() {
    local desired_dir="$SDK_ROOT/cmdline-tools/latest"
    local newest_dir
    newest_dir=$(ls -td "$SDK_ROOT"/cmdline-tools/latest* 2>/dev/null | head -n1 || true)
    if [[ -n "$newest_dir" && "$newest_dir" != "$desired_dir" ]]; then
        rm -rf "$desired_dir"
        mv "$newest_dir" "$desired_dir"
    fi
    for extra_dir in "$SDK_ROOT"/cmdline-tools/latest-*; do
        if [[ -d "$extra_dir" && "$extra_dir" != "$desired_dir" ]]; then
            rm -rf "$extra_dir"
        fi
    done
    SDKMANAGER_BIN="$desired_dir/bin/sdkmanager"
}

normalize_cmdline_tools

MANDATORY_PACKAGES=(
    "cmdline-tools;latest"
    "platform-tools"
    "build-tools;${TARGET_BUILD_TOOLS_VERSION}"
    "platforms;android-${TARGET_ANDROID_API}"
    "platforms;android-${LEGACY_ANDROID_API}"
)

OPTIONAL_PACKAGES=()
if [[ -n "${FUTURE_ANDROID_API}" ]]; then
    OPTIONAL_PACKAGES+=("platforms;android-${FUTURE_ANDROID_API}")
fi
if [[ -n "${FUTURE_BUILD_TOOLS_VERSION}" ]]; then
    OPTIONAL_PACKAGES+=("build-tools;${FUTURE_BUILD_TOOLS_VERSION}")
fi

echo "Accepting Android SDK licenses..."
set +o pipefail
yes | "$SDKMANAGER_BIN" --sdk_root="$SDK_ROOT" --licenses >/dev/null || true
set -o pipefail

echo "Updating sdkmanager..."
"$SDKMANAGER_BIN" --sdk_root="$SDK_ROOT" --update >/dev/null

echo "Installing required Android SDK packages..."
"$SDKMANAGER_BIN" --sdk_root="$SDK_ROOT" --install "${MANDATORY_PACKAGES[@]}"

normalize_cmdline_tools

if [[ ${#OPTIONAL_PACKAGES[@]} -gt 0 ]]; then
    echo "Attempting to install optional Android SDK packages: ${OPTIONAL_PACKAGES[*]}"
    set +e
    "$SDKMANAGER_BIN" --sdk_root="$SDK_ROOT" --install "${OPTIONAL_PACKAGES[@]}"
    if [[ $? -ne 0 ]]; then
        echo "Optional packages could not be installed (likely not yet available). Continuing..."
    fi
    set -e
    normalize_cmdline_tools
fi

verify_sdk_installation() {
    local missing=0

    local required_platforms=("${TARGET_ANDROID_API}" "${LEGACY_ANDROID_API}")
    for api in "${required_platforms[@]}"; do
        if [[ -z "$api" ]]; then
            continue
        fi
        local platform_dir="$SDK_ROOT/platforms/android-${api}"
        if [[ -d "$platform_dir" ]]; then
            echo "Verified platform android-${api}"
        else
            echo "ERROR: Required Android platform android-${api} is missing from $SDK_ROOT" >&2
            missing=1
        fi
    done

    local required_build_tools_dir="$SDK_ROOT/build-tools/${TARGET_BUILD_TOOLS_VERSION}"
    if [[ -d "$required_build_tools_dir" ]]; then
        echo "Verified build-tools ${TARGET_BUILD_TOOLS_VERSION}"
    else
        echo "ERROR: Required Android build-tools ${TARGET_BUILD_TOOLS_VERSION} is missing from $SDK_ROOT" >&2
        missing=1
    fi

    if [[ -n "${FUTURE_ANDROID_API}" ]]; then
        local optional_platform_dir="$SDK_ROOT/platforms/android-${FUTURE_ANDROID_API}"
        if [[ -d "$optional_platform_dir" ]]; then
            echo "Verified optional platform android-${FUTURE_ANDROID_API}"
        else
            echo "Optional platform android-${FUTURE_ANDROID_API} not installed (will be retried on next run)"
        fi
    fi

    if [[ -n "${FUTURE_BUILD_TOOLS_VERSION}" ]]; then
        local optional_build_tools_dir="$SDK_ROOT/build-tools/${FUTURE_BUILD_TOOLS_VERSION}"
        if [[ -d "$optional_build_tools_dir" ]]; then
            echo "Verified optional build-tools ${FUTURE_BUILD_TOOLS_VERSION}"
        else
            echo "Optional build-tools ${FUTURE_BUILD_TOOLS_VERSION} not installed (will be retried on next run)"
        fi
    fi

    if [[ $missing -ne 0 ]]; then
        echo "Android SDK verification failed." >&2
        exit 1
    fi
}

ensure_local_properties() {
    if [[ "$WRITE_LOCAL_PROPERTIES" != true ]]; then
        echo "Skipping local.properties generation."
        return
    fi

    mkdir -p "$PROJECT_ROOT"
    local local_properties_file="$PROJECT_ROOT/local.properties"
    local needs_update=true
    local desired_value
    desired_value=${SDK_ROOT//\\/\\\\}
    desired_value=${desired_value// /\\ }

    if [[ -f "$local_properties_file" ]]; then
        if grep -q '^sdk.dir=' "$local_properties_file"; then
            local current_value
            current_value=$(grep '^sdk.dir=' "$local_properties_file" | head -n1 | cut -d'=' -f2-)
            if [[ "$current_value" == "$desired_value" ]]; then
                needs_update=false
            fi
        fi
    fi

    if [[ "$needs_update" == true ]]; then
        cat > "$local_properties_file" <<EOF_PROPERTIES
# Generated by setup-android-sdk.sh
sdk.dir=$desired_value
EOF_PROPERTIES
        echo "local.properties updated at $local_properties_file"
    else
        echo "local.properties already up to date at $local_properties_file"
    fi
}

ensure_local_properties

verify_sdk_installation

