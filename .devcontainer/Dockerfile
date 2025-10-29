# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/devcontainers/java:1-17-bullseye

ARG ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} \
    ANDROID_HOME=${ANDROID_SDK_ROOT} \
    PATH=${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip zip git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools
ARG CMDLINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
RUN curl -sSL ${CMDLINE_TOOLS_URL} -o /tmp/cmdline-tools.zip \
    && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools \
    && mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip

COPY setup-android-sdk.sh /usr/local/share/genpwd/setup-android-sdk.sh
RUN chmod +x /usr/local/share/genpwd/setup-android-sdk.sh \
    && ln -s /usr/local/share/genpwd/setup-android-sdk.sh /usr/local/bin/setup-android-sdk.sh

RUN yes | sdkmanager --sdk_root=${ANDROID_SDK_ROOT} --licenses
RUN setup-android-sdk.sh --sdk-root ${ANDROID_SDK_ROOT} --skip-local-properties