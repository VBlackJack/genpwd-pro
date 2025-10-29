# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

ARG ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT} \
    ANDROID_HOME=${ANDROID_SDK_ROOT} \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    PATH=${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        openjdk-17-jdk \
        unzip \
        wget \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
    && cd /tmp \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    && unzip -q commandlinetools-linux-11076708_latest.zip \
    && mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
    && mv cmdline-tools/* ${ANDROID_SDK_ROOT}/cmdline-tools/latest/ \
    && rm -rf /tmp/* \
    && chown -R vscode:vscode ${ANDROID_SDK_ROOT}

