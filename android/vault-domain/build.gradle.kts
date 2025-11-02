import org.gradle.api.JavaVersion
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm")
    id("org.jlleitschuh.gradle.ktlint")
    id("io.gitlab.arturbosch.detekt")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "17"
    }
}

ktlint {
    android.set(false)
    ignoreFailures.set(false)
    filter {
        exclude("**/build/**")
        exclude("**/generated/**")
    }
}

detekt {
    buildUponDefaultConfig = true
    allRules = false
    parallel = true
    config.setFrom(
        files(
            rootProject.file("../config/detekt/detekt.yml"),
            project.file("detekt-overrides.yml")
        )
    )
    autoCorrect = false
    baseline = rootProject.file("config/detekt/detekt-baseline.xml")
}

tasks.named("check") {
    dependsOn("detekt", "ktlintCheck")
}

dependencies {
    detektPlugins("io.gitlab.arturbosch.detekt:detekt-rules-libraries:1.23.4")
    detektPlugins("io.gitlab.arturbosch.detekt:detekt-formatting:1.23.4")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    testImplementation(kotlin("test"))
}
